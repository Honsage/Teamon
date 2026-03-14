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
    Поиск пользователей по email, имени и фамилии с автодополнением
    GET /api/auth/users/search/?q=поисковый_запрос
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        query = request.query_params.get('q', '').strip()
        
        if not query or len(query) < 2:
            return Response([], status=status.HTTP_200_OK)
        
        # Разбиваем запрос на слова для поиска
        search_terms = query.lower().split()
        
        # Начинаем с пустого QuerySet
        users = User.objects.all()
        
        # Исключаем текущего пользователя из результатов
        users = users.exclude(id=request.user.id)
        
        # Создаем Q объекты для различных условий поиска
        from django.db.models import Q
        
        # Поиск по email (частичное совпадение)
        email_condition = Q(email__icontains=query)
        
        # Поиск по имени и фамилии
        name_condition = Q()
        for term in search_terms:
            name_condition &= (
                Q(first_name__icontains=term) | 
                Q(last_name__icontains=term) |
                Q(first_name__icontains=term) & Q(last_name__icontains=term)
            )
        
        # Поиск по полному имени (если запрос из двух слов, ищем имя+фамилия)
        full_name_condition = Q()
        if len(search_terms) >= 2:
            # Ищем exact совпадение имя + фамилия (порядок важен)
            full_name_condition = Q(
                first_name__icontains=search_terms[0],
                last_name__icontains=search_terms[1]
            ) | Q(
                first_name__icontains=search_terms[1],
                last_name__icontains=search_terms[0]
            )
        
        # Объединяем все условия
        users = users.filter(
            email_condition | name_condition | full_name_condition
        ).distinct()[:20]  # Ограничиваем результаты
        
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