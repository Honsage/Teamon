# chats/views.py
import re
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from django.db import connection
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import Chat, Message, ChatParticipant, Attachment, ChatHidden, ChatKanbanBoard
from .serializers import (
    ChatSerializer, MessageSerializer, 
    ChatParticipantSerializer, AttachmentSerializer, ChatKanbanBoardSerializer
)
from django.contrib.auth import get_user_model
from django.core.exceptions import PermissionDenied
from projects.models import Project


User = get_user_model()


def attachment_dicts_for_ws(message, request):
    """Сериализация вложений для событий channels (абсолютные URL файлов)."""
    items = []
    for a in message.attachments.all():
        url = a.file.url
        if request:
            url = request.build_absolute_uri(url)
        items.append(
            {
                "id": a.id,
                "file": url,
                "filename": a.filename,
                "file_size": a.file_size,
                "content_type": a.content_type,
            }
        )
    return items


def apply_mentions_to_participants(chat, message, sender):
    """Помечает упоминания @username (никнейм или локальная часть email) для участников чата."""
    try:
        tags = set(re.findall(r"@([\w.]+)", message.text or ""))
    except Exception:
        return
    if not tags:
        return
    tags_lower = {t.lower() for t in tags}
    channel_layer = get_channel_layer()
    for cp in ChatParticipant.objects.filter(chat=chat).select_related("user"):
        u = cp.user
        if u.id == sender.id:
            continue
        uname = (u.username or "").lower()
        email_local = (u.email or "").split("@")[0].lower()
        if uname in tags_lower or email_local in tags_lower:
            ChatParticipant.objects.filter(pk=cp.pk).update(has_unread_mention=True)
            try:
                async_to_sync(channel_layer.group_send)(
                    f"user_{u.id}",
                    {"type": "notify_chat_mention", "chat_id": chat.id},
                )
            except Exception as e:
                print(f"mention notify: {e}")


def notify_chat_unread_updated_event(chat):
    """Сообщает всем участникам обновить счётчики непрочитанного в списке чатов."""
    try:
        channel_layer = get_channel_layer()
        for user_id in chat.participants.values_list("id", flat=True):
            async_to_sync(channel_layer.group_send)(
                f"user_{user_id}",
                {"type": "notify_chat_unread_updated", "chat_id": chat.id},
            )
    except Exception as e:
        print(f"Error notify_chat_unread_updated_event: {e}")


def _kanban_cards_by_id(data):
    """Собирает карточки канбана в словарь id -> карточка."""
    if not isinstance(data, dict):
        return {}
    out = {}
    for col in ("todo", "inProgress", "done"):
        for card in data.get(col) or []:
            if isinstance(card, dict) and card.get("id"):
                out[card["id"]] = card
    return out


def _norm_assignee_id(card):
    if not isinstance(card, dict):
        return None
    v = card.get("assignee_id")
    if v in (None, "", 0, "0"):
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _kanban_assignee_changed(old_data, new_data):
    old_m = _kanban_cards_by_id(old_data)
    new_m = _kanban_cards_by_id(new_data)
    for cid, nc in new_m.items():
        oc = old_m.get(cid, {})
        if _norm_assignee_id(oc) != _norm_assignee_id(nc):
            return True
    return False


def _kanban_assignees_invalid_for_chat(chat, new_data):
    user_ids = set(
        ChatParticipant.objects.filter(chat=chat).values_list("user_id", flat=True)
    )
    for card in _kanban_cards_by_id(new_data).values():
        aid = _norm_assignee_id(card)
        if aid is not None and aid not in user_ids:
            return True
    return False


class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = [IsAuthenticated]

    def _table_exists(self, table_name):
        try:
            return table_name in connection.introspection.table_names()
        except Exception:
            return False

    def get_queryset(self):
        """Возвращает чаты текущего пользователя"""
        qs = Chat.objects.filter(
            participants=self.request.user
        ).prefetch_related('chatparticipant_set__user').order_by('-updated_at')
        if self._table_exists('chats_chathidden'):
            qs = qs.exclude(hidden_for__user=self.request.user)
        return qs

    def _is_group_admin(self, chat, user):
        return ChatParticipant.objects.filter(
            chat=chat,
            user=user,
            is_admin=True
        ).exists()

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
                    # Если чат был скрыт пользователем, "возвращаем" его.
                    if self._table_exists('chats_chathidden'):
                        ChatHidden.objects.filter(chat=existing_chat, user=request.user).delete()
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

        # Уведомляем участников о новом чате в реальном времени.
        self.notify_chat_created(chat)
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
            if not self._is_group_admin(chat, request.user):
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
            self.notify_chat_created(chat, only_user_ids=[user_to_add.id])
            self.notify_chat_participants_updated(chat)
            
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def remove_participant(self, request, pk=None):
        """Удаление участника из группового чата (только админ)."""
        chat = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id required'}, status=status.HTTP_400_BAD_REQUEST)

        if chat.chat_type != 'group':
            return Response(
                {'error': 'Only group chats support participant management'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if not self._is_group_admin(chat, request.user):
            return Response(
                {'error': 'Only admins can remove participants'},
                status=status.HTTP_403_FORBIDDEN
            )

        if str(user_id) == str(request.user.id):
            return Response(
                {'error': 'Use leave_chat to leave the chat yourself'},
                status=status.HTTP_400_BAD_REQUEST
            )

        participant = ChatParticipant.objects.filter(chat=chat, user_id=user_id).first()
        if not participant:
            return Response({'error': 'Participant not found'}, status=status.HTTP_404_NOT_FOUND)

        # Чтобы в чате оставался хотя бы один админ.
        if participant.is_admin:
            admins_count = ChatParticipant.objects.filter(chat=chat, is_admin=True).count()
            if admins_count <= 1:
                return Response(
                    {'error': 'Cannot remove the last admin from chat'},
                    status=status.HTTP_400_BAD_REQUEST
                )

        removed_user_id = participant.user_id
        participant.delete()

        self.notify_chat_participants_updated(chat)
        self.notify_chat_removed_for_users(chat.id, [removed_user_id])
        return Response({'status': 'removed'})

    @action(detail=True, methods=['post'])
    def leave_chat(self, request, pk=None):
        """Покинуть чат текущим пользователем."""
        chat = self.get_object()
        participant = ChatParticipant.objects.filter(chat=chat, user=request.user).first()
        if not participant:
            return Response({'error': 'You are not a participant'}, status=status.HTTP_400_BAD_REQUEST)

        # Для личного чата трактуем как скрытие чата для себя.
        if chat.chat_type == 'private':
            if self._table_exists('chats_chathidden'):
                ChatHidden.objects.get_or_create(chat=chat, user=request.user)
            self.notify_chat_deleted(chat.id, [request.user.id])
            return Response({'status': 'left'})

        admins_count = ChatParticipant.objects.filter(chat=chat, is_admin=True).count()
        if participant.is_admin and admins_count <= 1:
            return Response(
                {'error': 'Вы являетесь единственным администратором. Назначьте другого администратора или удалите группу.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        full_name = f"{request.user.first_name} {request.user.last_name}".strip() or request.user.email
        leave_message = Message.objects.create(
            chat=chat,
            sender=request.user,
            text=f"{full_name} покинул группу"
        )
        Chat.objects.filter(id=chat.id).update(updated_at=leave_message.created_at)
        self.notify_chat_message(leave_message)

        participant.delete()
        remaining = ChatParticipant.objects.filter(chat=chat)
        if not remaining.exists():
            chat.delete()
        else:
            self.notify_chat_participants_updated(chat)

        self.notify_chat_deleted(chat.id, [request.user.id])
        return Response({'status': 'left'})

    @action(detail=True, methods=['post'])
    def rename_chat(self, request, pk=None):
        chat = self.get_object()
        if chat.chat_type != 'group':
            return Response({'error': 'Only group chats can be renamed'}, status=status.HTTP_400_BAD_REQUEST)
        if not self._is_group_admin(chat, request.user):
            return Response({'error': 'Only admins can rename chat'}, status=status.HTTP_403_FORBIDDEN)
        name = (request.data.get('name') or '').strip()
        if not name:
            return Response({'error': 'Название чата не может быть пустым'}, status=status.HTTP_400_BAD_REQUEST)
        chat.name = name
        chat.save(update_fields=['name', 'updated_at'])
        self.notify_chat_participants_updated(chat)
        return Response(self.get_serializer(chat).data)

    @action(detail=True, methods=['post'])
    def update_project_details(self, request, pk=None):
        chat = self.get_object()
        if chat.chat_type != 'group':
            return Response({'error': 'Only group chats can have project details'}, status=status.HTTP_400_BAD_REQUEST)
        if not self._is_group_admin(chat, request.user):
            return Response({'error': 'Only admins can edit project details'}, status=status.HTTP_403_FORBIDDEN)

        project_name = (request.data.get('project_name') or '').strip()
        project_description = (request.data.get('project_description') or '').strip()
        if not project_name:
            return Response({'error': 'Название проекта не может быть пустым'}, status=status.HTTP_400_BAD_REQUEST)

        project = chat.project
        if project is None:
            project = Project.objects.create(
                name=project_name,
                description=project_description,
                created_by=request.user
            )
            chat.project = project
            chat.save(update_fields=['project', 'updated_at'])
        else:
            project.name = project_name
            project.description = project_description
            project.save(update_fields=['name', 'description', 'updated_at'])
            Chat.objects.filter(id=chat.id).update(updated_at=project.updated_at)

        self.notify_chat_participants_updated(chat)
        return Response(self.get_serializer(chat).data)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        """
        Прочитать чат: без тела — до последнего сообщения (как раньше).
        С телом {"message_id": N} — продвинуть last_read не дальше N (по мере прокрутки).
        """
        chat = self.get_object()
        cp = ChatParticipant.objects.filter(chat=chat, user=request.user).first()
        if not cp:
            return Response({'error': 'Not a participant'}, status=status.HTTP_400_BAD_REQUEST)
        message_id = request.data.get('message_id')
        update_fields = []

        if message_id is not None:
            try:
                mid = int(message_id)
            except (TypeError, ValueError):
                return Response({'error': 'Invalid message_id'}, status=status.HTTP_400_BAD_REQUEST)
            msg = Message.objects.filter(chat=chat, is_deleted=False, pk=mid).first()
            if not msg:
                return Response({'error': 'Message not found'}, status=status.HTTP_404_NOT_FOUND)
            old_last_id = cp.last_read_message_id or 0
            if msg.id > old_last_id:
                cp.last_read_message = msg
                update_fields.append('last_read_message')
        else:
            last = (
                Message.objects.filter(chat=chat, is_deleted=False)
                .order_by('-id')
                .first()
            )
            cp.has_unread_mention = False
            update_fields.append('has_unread_mention')
            if last:
                cp.last_read_message = last
                update_fields.append('last_read_message')
            elif cp.last_read_message_id is not None:
                cp.last_read_message = None
                update_fields.append('last_read_message')

        last_id = cp.last_read_message_id
        unread_qs = Message.objects.filter(chat=chat, is_deleted=False).exclude(sender=request.user)
        if last_id:
            unread_qs = unread_qs.filter(id__gt=last_id)
        if unread_qs.count() == 0 and cp.has_unread_mention:
            cp.has_unread_mention = False
            if 'has_unread_mention' not in update_fields:
                update_fields.append('has_unread_mention')

        if update_fields:
            cp.save(update_fields=list(dict.fromkeys(update_fields)))
        notify_chat_unread_updated_event(chat)
        return Response(self.get_serializer(chat).data)

    @action(detail=True, methods=['post'])
    def update_participant_role(self, request, pk=None):
        chat = self.get_object()
        if chat.chat_type != 'group':
            return Response({'error': 'Only group chats support role management'}, status=status.HTTP_400_BAD_REQUEST)
        if not self._is_group_admin(chat, request.user):
            return Response({'error': 'Only admins can manage roles'}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id required'}, status=status.HTTP_400_BAD_REQUEST)
        participant = ChatParticipant.objects.filter(chat=chat, user_id=user_id).first()
        if not participant:
            return Response({'error': 'Participant not found'}, status=status.HTTP_404_NOT_FOUND)

        is_admin = request.data.get('is_admin')
        if is_admin is not None:
            next_is_admin = bool(is_admin)
            if participant.user_id == request.user.id and not next_is_admin:
                admins_count = ChatParticipant.objects.filter(chat=chat, is_admin=True).count()
                if admins_count <= 1:
                    return Response(
                        {'error': 'Нельзя снять роль единственного администратора с самого себя.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            participant.is_admin = next_is_admin

        role_title = request.data.get('role_title')
        if role_title is not None:
            participant.role_title = str(role_title).strip()[:120]

        participant.save(update_fields=['is_admin', 'role_title'])
        self.notify_chat_participants_updated(chat)
        return Response(ChatParticipantSerializer(participant).data)

    def destroy(self, request, *args, **kwargs):
        chat = self.get_object()
        participant_qs = ChatParticipant.objects.filter(chat=chat)
        participant_user_ids = list(participant_qs.values_list('user_id', flat=True))

        if chat.chat_type == 'group' and not self._is_group_admin(chat, request.user):
            return Response(
                {'error': 'Only admins can delete group chat'},
                status=status.HTTP_403_FORBIDDEN
            )

        chat_id = chat.id
        chat.delete()
        self.notify_chat_deleted(chat_id, participant_user_ids)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def delete_for_me(self, request, pk=None):
        """Скрыть чат только для текущего пользователя."""
        chat = self.get_object()
        if not self._table_exists('chats_chathidden'):
            return Response(
                {'error': 'Chat hide feature is unavailable until migrations are applied'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        ChatHidden.objects.get_or_create(chat=chat, user=request.user)
        self.notify_chat_deleted(chat.id, [request.user.id])
        return Response({'status': 'hidden'})

    @action(detail=True, methods=['post'])
    def create_kanban(self, request, pk=None):
        chat = self.get_object()
        if not self._table_exists('chats_chatkanbanboard'):
            return Response(
                {'error': 'Kanban feature is unavailable until migrations are applied'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        if chat.chat_type != 'group':
            return Response({'error': 'Kanban available only for group chats'}, status=status.HTTP_400_BAD_REQUEST)
        if not self._is_group_admin(chat, request.user):
            return Response({'error': 'Only admins can create kanban'}, status=status.HTTP_403_FORBIDDEN)

        board, _ = ChatKanbanBoard.objects.get_or_create(
            chat=chat,
            defaults={
                'data': {
                    'todo': [],
                    'inProgress': [],
                    'done': []
                }
            }
        )
        self.notify_kanban_updated(chat)
        return Response(ChatKanbanBoardSerializer(board).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['get', 'put'])
    def kanban(self, request, pk=None):
        chat = self.get_object()
        if not self._table_exists('chats_chatkanbanboard'):
            return Response(
                {'error': 'Kanban feature is unavailable until migrations are applied'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )
        if chat.chat_type != 'group':
            return Response({'error': 'Kanban available only for group chats'}, status=status.HTTP_400_BAD_REQUEST)

        board = ChatKanbanBoard.objects.filter(chat=chat).first()
        if request.method == 'GET':
            if not board:
                return Response({'error': 'Kanban not found'}, status=status.HTTP_404_NOT_FOUND)
            return Response(ChatKanbanBoardSerializer(board).data)

        if not board:
            return Response({'error': 'Kanban not found'}, status=status.HTTP_404_NOT_FOUND)

        serializer = ChatKanbanBoardSerializer(board, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        new_data = serializer.validated_data.get("data")
        old_data = board.data if isinstance(board.data, dict) else {}
        if new_data is not None:
            if _kanban_assignees_invalid_for_chat(chat, new_data):
                return Response(
                    {"error": "Исполнитель должен быть участником чата."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if _kanban_assignee_changed(old_data, new_data) and not self._is_group_admin(
                chat, request.user
            ):
                return Response(
                    {"error": "Только администратор может назначать исполнителей задач."},
                    status=status.HTTP_403_FORBIDDEN,
                )
        serializer.save()
        self.notify_kanban_updated(chat)
        return Response(serializer.data)

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
                f"chat_{chat.id}",
                {
                    "type": "new_participant",
                    "user_id": user.id,
                    "email": user.email,
                    "full_name": full_name,
                    "display_name": full_name,
                    "joined_at": participant.joined_at.isoformat()
                    if participant.joined_at
                    else None,
                },
            )
        except Exception as e:
            # Логируем ошибку, но не прерываем выполнение
            print(f"Error sending websocket notification: {e}")

    def notify_chat_created(self, chat, only_user_ids=None):
        """Уведомляет участников о создании/подключении к чату."""
        try:
            channel_layer = get_channel_layer()
            user_ids = (
                list(only_user_ids)
                if only_user_ids is not None
                else list(chat.participants.values_list("id", flat=True))
            )
            for user_id in user_ids:
                async_to_sync(channel_layer.group_send)(
                    f"user_{user_id}",
                    {
                        "type": "notify_chat_created",
                        "chat_id": chat.id,
                    },
                )
        except Exception as e:
            print(f"Error sending chat created notification: {e}")

    def notify_chat_participants_updated(self, chat):
        """Уведомляет всех участников о смене состава чата."""
        try:
            channel_layer = get_channel_layer()
            user_ids = list(chat.participants.values_list("id", flat=True))
            for user_id in user_ids:
                async_to_sync(channel_layer.group_send)(
                    f"user_{user_id}",
                    {
                        "type": "notify_chat_participants_updated",
                        "chat_id": chat.id,
                    },
                )
        except Exception as e:
            print(f"Error sending participants update notification: {e}")

    def notify_chat_deleted(self, chat_id, user_ids):
        """Уведомляет пользователей, что чат удален."""
        try:
            channel_layer = get_channel_layer()
            for user_id in user_ids:
                async_to_sync(channel_layer.group_send)(
                    f"user_{user_id}",
                    {
                        "type": "notify_chat_deleted",
                        "chat_id": chat_id,
                    },
                )
        except Exception as e:
            print(f"Error sending chat deleted notification: {e}")

    def notify_chat_removed_for_users(self, chat_id, user_ids):
        """Уведомляет удаленных участников о потере доступа к чату."""
        self.notify_chat_deleted(chat_id, user_ids)

    def notify_kanban_updated(self, chat):
        """Уведомляет участников об обновлении канбан-доски (payload + группа чата для realtime)."""
        try:
            channel_layer = get_channel_layer()
            board = ChatKanbanBoard.objects.filter(chat=chat).first()
            board_data = (
                board.data
                if board
                else {"todo": [], "inProgress": [], "done": []}
            )
            user_ids = list(chat.participants.values_list("id", flat=True))
            for user_id in user_ids:
                async_to_sync(channel_layer.group_send)(
                    f"user_{user_id}",
                    {
                        "type": "notify_chat_kanban_updated",
                        "chat_id": chat.id,
                        "kanban_data": board_data,
                    },
                )
            async_to_sync(channel_layer.group_send)(
                f"chat_{chat.id}",
                {
                    "type": "chat_kanban_board",
                    "kanban_data": board_data,
                },
            )
        except Exception as e:
            print(f"Error sending kanban updated notification: {e}")

    def notify_chat_message(self, message):
        """Шлет системное сообщение в realtime всем участникам чата."""
        try:
            channel_layer = get_channel_layer()
            sender = message.sender
            sender_full_name = f"{sender.first_name} {sender.last_name}".strip() or sender.email
            async_to_sync(channel_layer.group_send)(
                f"chat_{message.chat.id}",
                {
                    "type": "chat_message",
                    "message_id": message.id,
                    "text": message.text,
                    "attachments": [],
                    "user_id": sender.id,
                    "email": sender.email,
                    "full_name": sender_full_name,
                    "display_name": sender_full_name,
                    "created_at": message.created_at.isoformat(),
                    "reply_to_data": None,
                },
            )
        except Exception as e:
            print(f"Error sending chat message notification: {e}")


class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """Возвращает сообщения из чата, если пользователь участник"""
        chat_id = self.request.query_params.get('chat_id')
        if not chat_id:
            if getattr(self, 'action', None) == 'list':
                return Message.objects.none()
            return Message.objects.filter(
                chat__participants=self.request.user
            ).select_related('sender', 'reply_to').prefetch_related('attachments')
        
        # Проверяем доступ к чату
        if not ChatParticipant.objects.filter(
            chat_id=chat_id,
            user=self.request.user
        ).exists():
            return Message.objects.none()
        
        return Message.objects.filter(
            chat_id=chat_id,
            is_deleted=False
        ).select_related('sender', 'reply_to').prefetch_related('attachments')

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

        uploaded_list = list(self.request.FILES.getlist("file"))
        if not uploaded_list:
            single = self.request.FILES.get("file")
            if single:
                uploaded_list = [single]
        for uploaded in uploaded_list:
            safe_name = (getattr(uploaded, "name", None) or "file")[:255]
            Attachment.objects.create(
                message=message,
                file=uploaded,
                filename=safe_name,
                file_size=getattr(uploaded, "size", 0) or 0,
                content_type=getattr(uploaded, "content_type", None)
                or "application/octet-stream",
            )
        
        # Обновляем updated_at чата
        Chat.objects.filter(id=chat_id).update(updated_at=message.created_at)

        apply_mentions_to_participants(message.chat, message, self.request.user)
        
        # Отправляем уведомление через вебсокеты всем участникам чата
        self.notify_participants(message)
        notify_chat_unread_updated_event(message.chat)
        
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

        created_at = message.created_at.isoformat()
        request = getattr(self, "request", None)
        attachments_ws = attachment_dicts_for_ws(message, request)

        preview = (message.text or "").strip()[:50]
        if not preview:
            first_att = message.attachments.first()
            if first_att:
                preview = f"📎 {(first_att.filename or 'файл')[:44]}"
            else:
                preview = "…"

        # Обновление открытого чата в реальном времени для всех его участников.
        async_to_sync(channel_layer.group_send)(
            f"chat_{message.chat.id}",
            {
                "type": "chat_message",
                "message_id": message.id,
                "text": message.text,
                "attachments": attachments_ws,
                "user_id": sender.id,
                "email": sender.email,
                "full_name": sender_full_name,
                "display_name": sender_display_name,
                "created_at": created_at,
                "reply_to_data": (
                    {
                        "id": message.reply_to.id,
                        "text": message.reply_to.text[:100],
                        "sender": {
                            "id": message.reply_to.sender.id,
                            "full_name": (
                                f"{message.reply_to.sender.first_name} {message.reply_to.sender.last_name}".strip()
                                or message.reply_to.sender.email
                            ),
                            "display_name": (
                                f"{message.reply_to.sender.first_name} {message.reply_to.sender.last_name}".strip()
                                or message.reply_to.sender.email
                            ),
                        },
                    }
                    if message.reply_to_id
                    else None
                ),
            },
        )

        # Параллельно отправляем персональные уведомления (например, для сайдбара/бейджей).
        for user in participants:
            async_to_sync(channel_layer.group_send)(
                f"user_{user.id}",
                {
                    "type": "notify_new_message",
                    "chat_id": message.chat.id,
                    "message_id": message.id,
                    "chat_name": message.chat.name or f"Chat {message.chat.id}",
                    "sender_id": sender.id,
                    "sender_email": sender.email,
                    "sender_full_name": sender_full_name,
                    "sender_display_name": sender_display_name,
                    "text_preview": preview,
                    "created_at": created_at,
                },
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
        self.notify_message_deleted(message)
        
        return Response({'status': 'deleted'})

    def notify_message_deleted(self, message):
        """Уведомляет участников чата об удалении сообщения в реальном времени."""
        try:
            channel_layer = get_channel_layer()
            async_to_sync(channel_layer.group_send)(
                f"chat_{message.chat.id}",
                {
                    "type": "chat_message_deleted",
                    "message_id": message.id,
                },
            )
        except Exception as e:
            print(f"Error sending message deleted notification: {e}")