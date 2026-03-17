from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import LoginSerializer, UserSerializer, RegisterSerializer, UserSearchSerializer
from django.contrib.auth import get_user_model

User = get_user_model()

class LoginView(APIView):
    """
    Вход по email и паролю
    POST /api/auth/login/
    {
        "email": "user@example.com",
        "password": "yourpassword"
    }
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)

        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    Выход из системы (блокировка refresh токена)
    POST /api/auth/logout/
    {
        "refresh": "ваш_refresh_токен"
    }
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if not refresh_token:
                return Response(
                    {"detail": "Необходимо указать refresh токен."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            token = RefreshToken(refresh_token)
            token.blacklist()  # Требует добавления 'rest_framework_simplejwt.token_blacklist' в INSTALLED_APPS
            return Response(
                {"detail": "Выход выполнен успешно."},
                status=status.HTTP_205_RESET_CONTENT
            )
        except Exception:
            return Response(
                {"detail": "Недействительный токен."},
                status=status.HTTP_400_BAD_REQUEST
            )


class UserProfileView(APIView):
    """
    Получение данных текущего пользователя
    GET /api/auth/profile/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)
    
class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        
        # Сразу генерируем токены
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'refresh': str(refresh),
            'access': str(refresh.access_token),
            'user': UserSerializer(user).data
        }, status=status.HTTP_201_CREATED)

# views.py - добавьте в конец файла

class UserSearchView(APIView):
    """
    Поиск пользователей по email, имени, фамилии и username
    GET /api/auth/users/search/
    
    Параметры (все необязательные):
    - email: частичное совпадение email
    - first_name: частичное совпадение имени
    - last_name: частичное совпадение фамилии
    - username: частичное совпадение username
    
    Если параметры не указаны, возвращается пустой список
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Получаем параметры запроса
        email_query = request.query_params.get('email', '').strip()
        first_name_query = request.query_params.get('first_name', '').strip()
        last_name_query = request.query_params.get('last_name', '').strip()
        username_query = request.query_params.get('username', '').strip()
        
        # Проверяем, есть ли хотя бы один параметр
        if not any([email_query, first_name_query, last_name_query, username_query]):
            return Response([], status=status.HTTP_200_OK)
        
        # Начинаем с QuerySet всех пользователей
        users = User.objects.all()
        
        # Исключаем текущего пользователя из результатов
        users = users.exclude(id=request.user.id)
        
        # Создаем Q объекты для условий поиска
        from django.db.models import Q
        
        conditions = Q()
        
        # Поиск по email
        if email_query:
            conditions |= Q(email__icontains=email_query)
        
        # Поиск по имени
        if first_name_query:
            conditions |= Q(first_name__icontains=first_name_query)
        
        # Поиск по фамилии
        if last_name_query:
            conditions |= Q(last_name__icontains=last_name_query)
        
        # Поиск по username
        if username_query:
            conditions |= Q(username__icontains=username_query)
        
        # Поиск по комбинации имени и фамилии (если оба указаны)
        if first_name_query and last_name_query:
            conditions |= Q(
                first_name__icontains=first_name_query,
                last_name__icontains=last_name_query
            )
        
        # Применяем условия
        users = users.filter(conditions).distinct()[:20]  # Ограничиваем результаты
        
        # Сериализуем результаты
        serializer = UserSearchSerializer(users, many=True, context={'request': request})
        
        return Response(serializer.data, status=status.HTTP_200_OK)


class UserDetailView(APIView):
    """
    Получение данных конкретного пользователя по ID
    GET /api/auth/users/{id}/
    """
    permission_classes = [IsAuthenticated]

    def get(self, request, user_id):
        try:
            user = User.objects.get(id=user_id)
            serializer = UserSerializer(user)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except User.DoesNotExist:
            return Response(
                {"detail": "Пользователь не найден."},
                status=status.HTTP_404_NOT_FOUND
            )