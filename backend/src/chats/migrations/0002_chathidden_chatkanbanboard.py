from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('chats', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='ChatKanbanBoard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data', models.JSONField(default=dict)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('chat', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='kanban_board', to='chats.chat')),
            ],
        ),
        migrations.CreateModel(
            name='ChatHidden',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('hidden_at', models.DateTimeField(auto_now_add=True)),
                ('chat', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='hidden_for', to='chats.chat')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='hidden_chats', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'unique_together': {('chat', 'user')},
            },
        ),
        migrations.AddIndex(
            model_name='chathidden',
            index=models.Index(fields=['chat', 'user'], name='chats_chath_chat_id_4e7700_idx'),
        ),
        migrations.AddIndex(
            model_name='chathidden',
            index=models.Index(fields=['user'], name='chats_chath_user_id_19b8f4_idx'),
        ),
    ]
