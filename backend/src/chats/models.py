from django.db import models
from django.contrib.auth import get_user_model
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

User = get_user_model()

class Chat(models.Model):
    """
    Основная модель чата. Может быть личным или групповым.
    """
    CHAT_TYPES = (
        ('private', 'Личный чат 1 на 1'),
        ('group', 'Групповой чат проекта'),
    )
    
    chat_type = models.CharField(max_length=10, choices=CHAT_TYPES)
    name = models.CharField(max_length=255, blank=True, null=True)  # Для групповых чатов
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Для связи с проектом (только для групповых чатов проекта)
    project = models.ForeignKey(
        'projects.Project', 
        on_delete=models.CASCADE,
        null=True, 
        blank=True,
        related_name='chats'
    )
    
    participants = models.ManyToManyField(
        User, 
        through='ChatParticipant',
        related_name='chats'
    )
    
    class Meta:
        indexes = [
            models.Index(fields=['chat_type']),
            models.Index(fields=['project']),
        ]
    
    def __str__(self):
        if self.chat_type == 'private':
            return f"Private chat {self.id}"
        return self.name or f"Group chat {self.id}"

class ChatParticipant(models.Model):
    """
    Модель для управления участниками чата.
    """
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE)
    joined_at = models.DateTimeField(auto_now_add=True)
    is_admin = models.BooleanField(default=False)  # Для групповых чатов
    role_title = models.CharField(max_length=120, blank=True, default="")
    
    class Meta:
        unique_together = ['user', 'chat']
        indexes = [
            models.Index(fields=['user', 'chat']),
        ]
    
    def __str__(self):
        return f"{self.user.email} in {self.chat}"

class Message(models.Model):
    """
    Модель сообщения.
    """
    chat = models.ForeignKey(
        Chat, 
        on_delete=models.CASCADE,
        related_name='messages'
    )
    sender = models.ForeignKey(
        User, 
        on_delete=models.CASCADE,
        related_name='sent_messages'
    )
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)  # Soft delete
    
    # Для reply функциональности (опционально)
    reply_to = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='replies'
    )
    
    class Meta:
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['chat', '-created_at']),
            models.Index(fields=['sender', '-created_at']),
        ]
    
    def __str__(self):
        return f"Message {self.id} from {self.sender.email}"

class Attachment(models.Model):
    """
    Модель для вложений в сообщениях.
    """
    message = models.ForeignKey(
        Message,
        on_delete=models.CASCADE,
        related_name='attachments'
    )
    file = models.FileField(upload_to='chat_attachments/%Y/%m/%d/')
    filename = models.CharField(max_length=255)
    file_size = models.IntegerField()  # в байтах
    content_type = models.CharField(max_length=100)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return self.filename


class ChatHidden(models.Model):
    """Скрытый для пользователя чат (удаление только для себя)."""
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='hidden_for')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='hidden_chats')
    hidden_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['chat', 'user']
        indexes = [
            models.Index(fields=['chat', 'user']),
            models.Index(fields=['user']),
        ]


class ChatKanbanBoard(models.Model):
    """Канбан-доска, привязанная к групповому чату."""
    chat = models.OneToOneField(Chat, on_delete=models.CASCADE, related_name='kanban_board')
    data = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)