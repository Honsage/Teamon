from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('chats', '0003_rename_chats_chath_chat_id_4e7700_idx_chats_chath_chat_id_e1863e_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='chatparticipant',
            name='role_title',
            field=models.CharField(blank=True, default='', max_length=120),
        ),
    ]
