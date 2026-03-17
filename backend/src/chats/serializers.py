# chats/serializers.py
from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Chat, Message, ChatParticipant, Attachment
from projects.models import Project

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    display_name = serializers.SerializerMethodField()
    full_name = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'full_name', 'display_name']
    
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
        fields = ['id', 'user', 'user_id', 'joined_at', 'is_admin']
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
    participants = ChatParticipantSerializer(many=True, read_only=True)
    last_message = serializers.SerializerMethodField()
    participant_count = serializers.IntegerField(source='participants.count', read_only=True)
    project_details = ProjectSerializer(source='project', read_only=True)
    
    # Поля для создания проекта вместе с чатом
    project_name = serializers.CharField(write_only=True, required=False)
    project_description = serializers.CharField(write_only=True, required=False)
    
    class Meta:
        model = Chat
        fields = [
            'id', 'chat_type', 'name', 'project', 'project_details',
            'created_at', 'updated_at', 'participants',
            'last_message', 'participant_count',
            'project_name', 'project_description'  # write_only поля
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
    
    def validate(self, data):
        chat_type = data.get('chat_type')
        
        if chat_type == 'private' and data.get('name'):
            raise serializers.ValidationError(
                "Private chats cannot have a name"
            )
        
        if chat_type == 'group':
            # Для группового чата нужно имя
            if not data.get('name') and not data.get('project_name'):
                raise serializers.ValidationError(
                    "Group chat requires a name or project_name"
                )
        
        return data
    
    def create(self, validated_data):
        # Извлекаем поля для проекта
        project_name = validated_data.pop('project_name', None)
        project_description = validated_data.pop('project_description', '')
        
        # Создаем чат
        chat = Chat.objects.create(**validated_data)
        
        # Если это групповой чат и указано имя проекта, создаем проект
        if validated_data.get('chat_type') == 'group' and project_name:
            project = Project.objects.create(
                name=project_name,
                description=project_description,
                created_by=self.context['request'].user
            )
            # Привязываем проект к чату
            chat.project = project
            chat.name = project_name  # Используем имя проекта как имя чата
            chat.save()
        
        return chat