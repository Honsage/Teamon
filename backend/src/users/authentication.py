# users/authentication.py
from django.contrib.auth import get_user_model
from django.contrib.auth.backends import ModelBackend
from django.db.models import Q

User = get_user_model()

class EmailOrUsernameModelBackend(ModelBackend):
    """
    Кастомный бэкенд аутентификации, который позволяет пользователям входить
    по email или username, используя пароль.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        # Поддерживаем поле 'username' в запросе, но на самом деле ищем по email или username
        # Это позволяет клиентам отправлять {'username': 'email@mail.com', 'password': '...'}
        # или {'username': 'john_doe', 'password': '...'}
        if username is None:
            username = kwargs.get(User.USERNAME_FIELD)

        # Если передан параметр 'email' (например, из другого клиента), используем его
        email = kwargs.get('email', None)

        # Ищем пользователя, у которого совпадает username ИЛИ email
        # Используем Q объекты для сложных запросов
        try:
            user = User.objects.get(
                Q(username__iexact=username) |  # Ищем по username (регистронезависимо)
                Q(email__iexact=username) |     # Ищем по email (регистронезависимо)
                Q(email__iexact=email)          # Ищем по отдельному полю email, если оно передано
            )
        except User.DoesNotExist:
            # Если пользователь не найден, запускаем базовую проверку пароля
            # для предотвращения определения существования пользователя по времени ответа
            User().set_password(password)
            return None
        except User.MultipleObjectsReturned:
            # В редком случае, если есть несколько пользователей с одинаковым email (например, если поле не уникально)
            # возвращаем первого, но лучше сделать email уникальным в модели.
            user = User.objects.filter(
                Q(email__iexact=username) | Q(email__iexact=email)
            ).first()

        # Проверяем пароль и может ли пользователь аутентифицироваться (is_active)
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        else:
            return None