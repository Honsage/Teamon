from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('chats', '0002_chathidden_chatkanbanboard'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='chathidden',
            new_name='chats_chath_chat_id_e1863e_idx',
            old_name='chats_chath_chat_id_4e7700_idx',
        ),
        migrations.RenameIndex(
            model_name='chathidden',
            new_name='chats_chath_user_id_0d466b_idx',
            old_name='chats_chath_user_id_19b8f4_idx',
        ),
    ]
