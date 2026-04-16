# consumers.py
import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from .models import Chat, Message, ChatParticipant

logger = logging.getLogger(__name__)
User = get_user_model()

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        try:
            self.chat_id = self.scope['url_route']['kwargs']['chat_id']
            self.chat_group_name = f'chat_{self.chat_id}'
            self.user = self.scope['user']

            logger.info(f"WebSocket connection attempt - User: {self.user}, Chat: {self.chat_id}")

            # Проверяем авторизацию
            if self.user.is_anonymous:
                logger.warning(f"Anonymous user tried to connect to chat {self.chat_id}")
                await self.close(code=4001)  # 4001 - unauthorized
                return

            # Проверяем доступ к чату
            can_join = await self.check_chat_access()
            
            if can_join:
                # Присоединяемся к группе чата
                await self.channel_layer.group_add(
                    self.chat_group_name,
                    self.channel_name
                )
                await self.accept()
                
                logger.info(f"User {self.user.email} connected to chat {self.chat_id}")
                
                # Получаем имя пользователя для отображения
                user_display = await self.get_user_display_name(self.user)
                
                # Отправляем уведомление о подключении
                await self.channel_layer.group_send(
                    self.chat_group_name,
                    {
                        'type': 'user_connected',
                        'user_id': self.user.id,
                        'email': self.user.email,
                        'full_name': user_display['full_name'],
                        'display_name': user_display['display_name']
                    }
                )
            else:
                logger.warning(f"User {self.user.email} tried to connect to chat {self.chat_id} without access")
                await self.close(code=4003)  # 4003 - forbidden
                
        except Exception as e:
            logger.error(f"Error in connect: {e}")
            await self.close(code=4000)  # 4000 - internal error

    async def disconnect(self, close_code):
        """Обработка отключения"""
        try:
            if hasattr(self, 'chat_group_name') and hasattr(self, 'user'):
                if self.user and not self.user.is_anonymous:
                    # Отправляем уведомление об отключении
                    user_display = await self.get_user_display_name(self.user)
                    
                    await self.channel_layer.group_send(
                        self.chat_group_name,
                        {
                            'type': 'user_disconnected',
                            'user_id': self.user.id,
                            'email': self.user.email,
                            'full_name': user_display['full_name'],
                            'display_name': user_display['display_name'],
                            'close_code': close_code
                        }
                    )
                
                # Отключаемся от группы
                await self.channel_layer.group_discard(
                    self.chat_group_name,
                    self.channel_name
                )
                
            logger.info(f"WebSocket disconnected: chat={getattr(self, 'chat_id', 'unknown')}, code={close_code}")
            
        except Exception as e:
            logger.error(f"Error in disconnect: {e}")

    async def receive(self, text_data):
        """Обработка входящих сообщений"""
        try:
            text_data_json = json.loads(text_data)
            message_type = text_data_json.get('type', 'message')
            
            logger.info(f"Received {message_type} from {self.user.email} in chat {self.chat_id}")

            if message_type == 'message':
                text = text_data_json['text']
                
                # Сохраняем в БД
                message = await self.save_message(text)
                
                # Получаем имя пользователя
                user_display = await self.get_user_display_name(self.user)
                
                # Отправляем всем в группу
                await self.channel_layer.group_send(
                    self.chat_group_name,
                    {
                        'type': 'chat_message',
                        'message_id': message.id,
                        'text': text,
                        'user_id': self.user.id,
                        'email': self.user.email,
                        'full_name': user_display['full_name'],
                        'display_name': user_display['display_name'],
                        'created_at': message.created_at.isoformat()
                    }
                )
                
        except json.JSONDecodeError:
            logger.error(f"Invalid JSON received: {text_data}")
        except Exception as e:
            logger.error(f"Error in receive: {e}")

    async def chat_message(self, event):
        """Отправка сообщения в WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'new_message',
            'message_id': event['message_id'],
            'text': event['text'],
            'attachments': event.get('attachments') or [],
            'user_id': event['user_id'],
            'email': event['email'],
            'full_name': event['full_name'],
            'display_name': event['display_name'],
            'created_at': event['created_at'],
            'reply_to_data': event.get('reply_to_data')
        }))

    async def chat_message_deleted(self, event):
        """Уведомление об удалении сообщения."""
        await self.send(text_data=json.dumps({
            'type': 'message_deleted',
            'message_id': event['message_id'],
        }))

    async def user_connected(self, event):
        """Уведомление о подключении пользователя"""
        await self.send(text_data=json.dumps({
            'type': 'user_connected',
            'user_id': event['user_id'],
            'email': event['email'],
            'full_name': event['full_name'],
            'display_name': event['display_name']
        }))

    async def user_disconnected(self, event):
        """Уведомление об отключении пользователя"""
        await self.send(text_data=json.dumps({
            'type': 'user_disconnected',
            'user_id': event['user_id'],
            'email': event['email'],
            'full_name': event['full_name'],
            'display_name': event['display_name'],
            'close_code': event.get('close_code', 1000)
        }))
    
    async def new_participant(self, event):
        """Уведомление о новом участнике в чате"""
        await self.send(text_data=json.dumps({
            'type': 'new_participant',
            'user_id': event['user_id'],
            'email': event['email'],
            'full_name': event['full_name'],
            'display_name': event['display_name'],
            'joined_at': event['joined_at']
        }))

    async def chat_kanban_board(self, event):
        """Обновление канбан-доски чата (для клиентов в ws/chat/{id}/)."""
        await self.send(text_data=json.dumps({
            'type': 'kanban_board_updated',
            'data': event['kanban_data'],
        }))

    @database_sync_to_async
    def check_chat_access(self):
        """Проверяет, имеет ли пользователь доступ к чату"""
        try:
            chat = Chat.objects.get(id=self.chat_id)
            return ChatParticipant.objects.filter(
                chat=chat, 
                user=self.user
            ).exists()
        except Chat.DoesNotExist:
            return False

    @database_sync_to_async
    def save_message(self, text):
        """Сохраняет сообщение в БД"""
        chat = Chat.objects.get(id=self.chat_id)
        return Message.objects.create(
            chat=chat,
            sender=self.user,
            text=text
        )
    
    @database_sync_to_async
    def get_user_display_name(self, user):
        """Возвращает отображаемое имя пользователя"""
        if user and not user.is_anonymous:
            if user.first_name or user.last_name:
                full_name = f"{user.first_name} {user.last_name}".strip()
                return {
                    'full_name': full_name,
                    'display_name': full_name
                }
            else:
                return {
                    'full_name': user.email,
                    'display_name': user.email
                }
        else:
            return {
                'full_name': 'Anonymous',
                'display_name': 'Anonymous'
            }


class UserConsumer(AsyncWebsocketConsumer):
    """
    Consumer для личных уведомлений пользователя
    """
    async def connect(self):
        self.user = self.scope['user']
        
        if self.user.is_anonymous:
            logger.warning("Anonymous user tried to connect to UserConsumer")
            await self.close(code=4001)
        else:
            self.user_group_name = f'user_{self.user.id}'
            
            await self.channel_layer.group_add(
                self.user_group_name,
                self.channel_name
            )
            await self.accept()
            logger.info(f"UserConsumer connected for user {self.user.email}")

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group_name'):
            await self.channel_layer.group_discard(
                self.user_group_name,
                self.channel_name
            )
        logger.info(f"UserConsumer disconnected for user {getattr(self.user, 'email', 'unknown')}")

    async def notify_new_message(self, event):
        """Уведомление о новом сообщении"""
        await self.send(text_data=json.dumps({
            'type': 'new_message_notification',
            'chat_id': event['chat_id'],
            'message_id': event['message_id'],
            'chat_name': event['chat_name'],
            'sender_email': event['sender_email'],
            'sender_full_name': event['sender_full_name'],
            'sender_display_name': event['sender_display_name'],
            'text_preview': event['text_preview'],
            'created_at': event['created_at']
        }))

    async def notify_chat_created(self, event):
        """Уведомление о создании/добавлении в чат."""
        await self.send(text_data=json.dumps({
            'type': 'chat_created_notification',
            'chat_id': event['chat_id'],
        }))

    async def notify_chat_participants_updated(self, event):
        """Уведомление о смене участников чата."""
        await self.send(text_data=json.dumps({
            'type': 'chat_participants_updated_notification',
            'chat_id': event['chat_id'],
        }))

    async def notify_chat_deleted(self, event):
        """Уведомление об удалении чата."""
        await self.send(text_data=json.dumps({
            'type': 'chat_deleted_notification',
            'chat_id': event['chat_id'],
        }))

    async def notify_chat_kanban_updated(self, event):
        """Уведомление об изменении канбан-доски чата."""
        payload = {
            'type': 'chat_kanban_updated_notification',
            'chat_id': event['chat_id'],
        }
        if 'kanban_data' in event:
            payload['kanban_data'] = event['kanban_data']
        await self.send(text_data=json.dumps(payload))

    async def notify_chat_unread_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_unread_updated_notification',
            'chat_id': event['chat_id'],
        }))

    async def notify_chat_mention(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_mention_notification',
            'chat_id': event['chat_id'],
        }))

    async def notify_user_profile_updated(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_profile_updated_notification',
            'user': event['user'],
        }))