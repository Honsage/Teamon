from django.contrib import admin
from .models import Chat, ChatParticipant, Message, Attachment

admin.site.register(Chat)
admin.site.register(ChatParticipant)
admin.site.register(Message)
admin.site.register(Attachment)
