# chats/serializers.py
import re
from rest_framework import serializers
from django.contrib.auth import get_user_model
from django.db.utils import OperationalError, ProgrammingError
from .models import Chat, Message, ChatParticipant, Attachment, ChatKanbanBoard
from projects.models import Project

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'display_name']
    
    def get_full_name(self, obj):
        if obj.first_name or obj.last_name:
            return f"{obj.first_name} {obj.last_name}".strip()
        return obj.email
    
    def get_display_name(self, obj):
        return self.get_full_name(obj)

class ProjectSerializer(serializers.ModelSerializer):
    class Meta:
        model = Project
        fields = ['id', 'name', 'description', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']

class ChatParticipantSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    user_id = serializers.IntegerField(write_only=True)  # Для добавления по ID
    
    class Meta:
        model = ChatParticipant
        fields = ['id', 'user', 'user_id', 'joined_at', 'is_admin', 'role_title']
        read_only_fields = ['joined_at']
    
    def create(self, validated_data):
        user_id = validated_data.pop('user_id')
        validated_data['user_id'] = user_id
        return super().create(validated_data)

class AttachmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Attachment
        fields = ['id', 'file', 'filename', 'file_size', 'content_type', 'uploaded_at']

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    attachments = AttachmentSerializer(many=True, read_only=True)
    reply_to_data = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = [
            'id', 'chat', 'sender', 'text', 'created_at', 
            'updated_at', 'is_deleted', 'reply_to', 'reply_to_data',
            'attachments'
        ]
        read_only_fields = ['sender', 'created_at', 'updated_at', 'is_deleted']
    
    def get_reply_to_data(self, obj):
        if obj.reply_to:
            sender = obj.reply_to.sender
            return {
                'id': obj.reply_to.id,
                'text': obj.reply_to.text[:100],
                'sender': {
                    'id': sender.id,
                    'email': sender.email,
                    'first_name': sender.first_name,
                    'last_name': sender.last_name,
                    'full_name': f"{sender.first_name} {sender.last_name}".strip() or sender.email
                }
            }
        return None

class ChatSerializer(serializers.ModelSerializer):
    participants = ChatParticipantSerializer(source='chatparticipant_set', many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    participant_count = serializers.IntegerField(source='chatparticipant_set.count', read_only=True)
    project_details = ProjectSerializer(source='project', read_only=True)
    has_kanban = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()
    has_unread_mention = serializers.SerializerMethodField()
    
    # Поля для создания проекта вместе с чатом
    project_name = serializers.CharField(write_only=True, required=False)
    project_description = serializers.CharField(write_only=True, required=False)
    participant_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        write_only=True,
        required=False,
        default=list
    )
    
    class Meta:
        model = Chat
        fields = [
            'id', 'chat_type', 'name', 'project', 'project_details',
            'created_at', 'updated_at', 'participants',
            'last_message', 'participant_count', 'has_kanban',
            'unread_count', 'has_unread_mention',
            'project_name', 'project_description', 'participant_ids'  # write_only поля
        ]
        read_only_fields = ['created_at', 'updated_at', 'project']
    
    def get_last_message(self, obj):
        """
        Возвращает последнее (по времени) не удалённое сообщение в чате
        для отображения превью в списке чатов.
        """
        try:
            qs = obj.messages.filter(is_deleted=False).order_by("-created_at")
        except AttributeError:
            return None

        last_msg = qs.first()
        if not last_msg:
            return None

        sender = last_msg.sender
        full_name = f"{sender.first_name} {sender.last_name}".strip() or sender.email

        return {
            "id": last_msg.id,
            "text": last_msg.text[:100],
            "sender": {
                "id": sender.id,
                "email": sender.email,
                "first_name": sender.first_name,
                "last_name": sender.last_name,
                "full_name": full_name,
            },
            "created_at": last_msg.created_at,
        }

    def get_has_kanban(self, obj):
        try:
            return hasattr(obj, 'kanban_board')
        except (OperationalError, ProgrammingError):
            return False

    def get_unread_count(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0
        try:
            cp = ChatParticipant.objects.get(chat=obj, user=request.user)
        except ChatParticipant.DoesNotExist:
            return 0
        last_id = cp.last_read_message_id
        qs = obj.messages.filter(is_deleted=False).exclude(sender=request.user)
        if last_id:
            qs = qs.filter(id__gt=last_id)
        return qs.count()

    def get_has_unread_mention(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return False
        try:
            cp = ChatParticipant.objects.get(chat=obj, user=request.user)
        except ChatParticipant.DoesNotExist:
            return False
        return bool(cp.has_unread_mention)

    def create(self, validated_data):
        # Извлекаем поля для проекта
        project_name = validated_data.pop('project_name', None)
        project_description = validated_data.pop('project_description', '')
        # Поле используется во view, в модель Chat не передаём.
        validated_data.pop('participant_ids', None)

        # Если у группового чата не задано имя, подставляем "Новый групповой чат N".
        if validated_data.get('chat_type') == 'group' and not validated_data.get('name'):
            existing_names = Chat.objects.filter(
                chat_type='group',
                name__startswith='Новый групповой чат'
            ).values_list('name', flat=True)
            max_index = 0
            for existing_name in existing_names:
                if existing_name == 'Новый групповой чат':
                    max_index = max(max_index, 1)
                    continue
                match = re.fullmatch(r'Новый групповой чат\s+(\d+)', existing_name or '')
                if match:
                    max_index = max(max_index, int(match.group(1)))
            validated_data['name'] = f'Новый групповой чат {max_index + 1}'
        
        # Создаем чат
        chat = Chat.objects.create(**validated_data)
        
        # Если это групповой чат и указано имя проекта, создаем проект
        if validated_data.get('chat_type') == 'group' and project_name:
            project = Project.objects.create(
                name=project_name,
                description=project_description,
                created_by=self.context['request'].user
            )
            # Привязываем проект к чату, но не подменяем имя чата названием проекта.
            chat.project = project
            chat.save()
        
        return chat


class ChatKanbanBoardSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatKanbanBoard
        fields = ['chat', 'data', 'created_at', 'updated_at']
        read_only_fields = ['chat', 'created_at', 'updated_at']