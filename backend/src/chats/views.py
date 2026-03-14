# chats/views.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Chat, Message, ChatParticipant, Attachment
from .serializers import (
    ChatSerializer, MessageSerializer, 
    ChatParticipantSerializer, AttachmentSerializer
)
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied


User = get_user_model()

class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Возвращает чаты текущего пользователя"""
        # Упрощаем запрос - убираем сложные prefetch_related
        return Chat.objects.filter(
            participants=self.request.user
        ).order_by('-updated_at')

    def create(self, request, *args, **kwargs):
        """Создание нового чата (с возможностью создания проекта)"""
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        # Если создается личный чат, проверяем существующий
        if serializer.validated_data.get('chat_type') == 'private':
            other_user_id = request.data.get('other_user_id')
            if other_user_id:
                # Проверяем, существует ли пользователь
                try:
                    User.objects.get(id=other_user_id)
                except User.DoesNotExist:
                    return Response(
                        {'error': f'User with id {other_user_id} not found'},
                        status=status.HTTP_404_NOT_FOUND
                    )
                
                existing_chat = self.check_existing_private_chat(
                    request.user.id, 
                    other_user_id
                )
                if existing_chat:
                    serializer = self.get_serializer(existing_chat)
                    return Response(serializer.data, status=status.HTTP_200_OK)
        
        # Сохраняем чат (и возможно проект)
        chat = serializer.save()
        
        # Добавляем создателя как участника
        ChatParticipant.objects.create(
            chat=chat,
            user=request.user,
            is_admin=True
        )
        
        # Если указан другой пользователь для личного чата
        other_user_id = request.data.get('other_user_id')
        if other_user_id and chat.chat_type == 'private':
            # Проверяем существование пользователя (уже проверили выше, но для безопасности)
            try:
                User.objects.get(id=other_user_id)
                ChatParticipant.objects.create(
                    chat=chat,
                    user_id=other_user_id
                )
            except User.DoesNotExist:
                # Если пользователь не найден, удаляем созданный чат и возвращаем ошибку
                chat.delete()
                return Response(
                    {'error': f'User with id {other_user_id} not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Для группового чата добавляем участников, если указаны
        if chat.chat_type == 'group':
            participant_ids = request.data.get('participant_ids', [])
            invalid_users = []
            
            for user_id in participant_ids:
                try:
                    user = User.objects.get(id=user_id)
                    ChatParticipant.objects.get_or_create(
                        chat=chat,
                        user=user
                    )
                except User.DoesNotExist:
                    invalid_users.append(user_id)
            
            # Если есть несуществующие пользователи, возвращаем ошибку
            if invalid_users:
                # Удаляем созданный чат
                chat.delete()
                return Response(
                    {'error': f'Users with ids {invalid_users} not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        
        # Получаем обновленный чат с полными данными
        chat = Chat.objects.get(id=chat.id)
        response_serializer = self.get_serializer(chat)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def add_participant(self, request, pk=None):
        """Добавление участника в групповой чат"""
        try:
            chat = self.get_object()
            user_id = request.data.get('user_id')
            
            if not user_id:
                return Response(
                    {'error': 'user_id required'}, 
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Проверяем существование пользователя
            try:
                user_to_add = User.objects.get(id=user_id)
            except User.DoesNotExist:
                return Response(
                    {'error': 'User not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Проверяем, что чат групповой
            if chat.chat_type != 'group':
                return Response(
                    {'error': 'Only group chats can have multiple participants'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Проверяем, что текущий пользователь админ
            if not ChatParticipant.objects.filter(
                chat=chat, 
                user=request.user, 
                is_admin=True
            ).exists():
                return Response(
                    {'error': 'Only admins can add participants'},
                    status=status.HTTP_403_FORBIDDEN
                )
            
            # Проверяем, не добавлен ли уже пользователь
            if ChatParticipant.objects.filter(chat=chat, user=user_to_add).exists():
                return Response(
                    {'error': 'User is already a participant'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Добавляем участника
            participant = ChatParticipant.objects.create(
                chat=chat,
                user=user_to_add,
                is_admin=False
            )
            
            # Получаем полные данные для ответа
            participant = ChatParticipant.objects.select_related('user').get(id=participant.id)
            serializer = ChatParticipantSerializer(participant)
            
            # Отправляем уведомление через вебсокеты
            self.notify_new_participant(chat, participant)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def check_existing_private_chat(self, user1_id, user2_id):
        """Проверяет существование личного чата между двумя пользователями"""
        # Находим все личные чаты, где есть оба пользователя
        chats = Chat.objects.filter(
            chat_type='private',
            participants__id=user1_id
        ).filter(
            participants__id=user2_id
        ).distinct()
        
        # Проверяем каждый чат
        for chat in chats:
            # Считаем количество участников
            participant_count = ChatParticipant.objects.filter(chat=chat).count()
            if participant_count == 2:
                return chat
        return None

    def notify_new_participant(self, chat, participant):
        """Отправляет уведомление о новом участнике через вебсокеты"""
        try:
            channel_layer = get_channel_layer()
            
            # Получаем данные пользователя
            user = participant.user
            full_name = f"{user.first_name} {user.last_name}".strip() or user.email
            
            # Отправляем уведомление в группу чата
            async_to_sync(channel_layer.group_send)(
                f'chat_{chat.id}',
                {
                    'type': 'new_participant',
                    'user_id': user.id,
                    'username': user.username,
                    'email': user.email,
                    'full_name': full_name,
                    'display_name': full_name,
                    'joined_at': participant.joined_at.isoformat() if participant.joined_at else None
                }
            )
        except Exception as e:
            # Логируем ошибку, но не прерываем выполнение
            print(f"Error sending websocket notification: {e}")


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Возвращает сообщения из чата, если пользователь участник"""
        chat_id = self.request.query_params.get('chat_id')
        if not chat_id:
            return Message.objects.none()
        
        # Проверяем доступ к чату
        if not ChatParticipant.objects.filter(
            chat_id=chat_id,
            user=self.request.user
        ).exists():
            return Message.objects.none()
        
        return Message.objects.filter(
            chat_id=chat_id,
            is_deleted=False
        ).select_related('sender', 'reply_to')

    def perform_create(self, serializer):
        """Создание нового сообщения"""
        chat_id = self.request.data.get('chat')
        
        # Проверяем доступ к чату
        if not ChatParticipant.objects.filter(
            chat_id=chat_id,
            user=self.request.user
        ).exists():
            raise PermissionDenied("You don't have access to this chat")
        
        message = serializer.save(sender=self.request.user)
        
        # Обновляем updated_at чата
        Chat.objects.filter(id=chat_id).update(updated_at=message.created_at)
        
        # Отправляем уведомление через вебсокеты всем участникам чата
        self.notify_participants(message)
        
        return message

    def notify_participants(self, message):
        """Отправляет уведомление о новом сообщении через вебсокеты"""
        channel_layer = get_channel_layer()
        
        # Получаем всех участников чата кроме отправителя
        participants = message.chat.participants.exclude(id=message.sender.id)
        
        sender = message.sender
        # Формируем отображаемое имя отправителя
        if sender.first_name or sender.last_name:
            sender_full_name = f"{sender.first_name} {sender.last_name}".strip()
            sender_display_name = sender_full_name
        else:
            sender_full_name = sender.email
            sender_display_name = sender.email
        
        for user in participants:
            async_to_sync(channel_layer.group_send)(
                f'user_{user.id}',
                {
                    'type': 'notify_new_message',
                    'chat_id': message.chat.id,
                    'message_id': message.id,
                    'chat_name': message.chat.name or f"Chat {message.chat.id}",
                    'sender_id': sender.id,
                    'sender_username': sender.username,
                    'sender_email': sender.email,
                    'sender_full_name': sender_full_name,
                    'sender_display_name': sender_display_name,
                    'text_preview': message.text[:50],
                    'created_at': message.created_at.isoformat()
                }
            )
    
    @action(detail=True, methods=['post'])
    def mark_as_deleted(self, request, pk=None):
        """Soft delete сообщения"""
        message = self.get_object()
        
        # Проверяем, что пользователь - автор сообщения
        if message.sender != request.user:
            return Response(
                {'error': 'You can only delete your own messages'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        message.is_deleted = True
        message.save()
        
        return Response({'status': 'deleted'})