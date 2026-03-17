from rest_framework import serializers
from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from .models import User


class LoginSerializer(serializers.Serializer):
    """
    Сериализатор для входа ТОЛЬКО по email и паролю
    """
    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')

        if email and password:
            # Аутентификация по email
            user = authenticate(
                request=self.context.get('request'),
                email=email,
                password=password
            )

            if not user:
                raise serializers.ValidationError(
                    "Неверный email или пароль.", 
                    code='authorization'
                )
            
            if not user.is_active:
                raise serializers.ValidationError(
                    "Учетная запись деактивирована.",
                    code='inactive'
                )
        else:
            raise serializers.ValidationError(
                "Необходимо указать 'email' и 'password'."
            )

        data['user'] = user
        return data


class UserSerializer(serializers.ModelSerializer):
    """Сериализатор для данных пользователя"""
    full_name = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = (
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "display_name",
            "date_joined",
        )
        read_only_fields = ("id", "username", "date_joined")

    def get_full_name(self, obj):
        if obj.first_name or obj.last_name:
            return f"{obj.first_name} {obj.last_name}".strip()
        return obj.email

    def get_display_name(self, obj):
        return self.get_full_name(obj)

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(
        write_only=True, style={"input_type": "password"}
    )
    password2 = serializers.CharField(
        write_only=True,
        style={"input_type": "password"},
        label="Подтверждение пароля",
    )

    class Meta:
        model = User
        fields = (
            "email",
            "username",
            "password",
            "password2",
            "first_name",
            "last_name",
        )
        extra_kwargs = {
            "first_name": {"required": True},
            "last_name": {"required": True},
            # username опционален – если не передан, модель подставит email
            "username": {"required": False, "allow_blank": True},
        }

    def validate(self, data):
        if data["password"] != data["password2"]:
            raise serializers.ValidationError("Пароли не совпадают")
        return data

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

class UserSearchSerializer(serializers.ModelSerializer):
    """Сериализатор для поиска пользователей с дополнительной информацией"""
    full_name = serializers.SerializerMethodField()
    display_name = serializers.SerializerMethodField()
    search_relevance = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'full_name', 'display_name', 'search_relevance')
    
    def get_full_name(self, obj):
        """Возвращает полное имя пользователя"""
        if obj.first_name or obj.last_name:
            return f"{obj.first_name} {obj.last_name}".strip()
        return obj.email
    
    def get_display_name(self, obj):
        """Возвращает имя для отображения"""
        return self.get_full_name(obj)
    
    def get_search_relevance(self, obj):
        """
        Определяет релевантность результата для поиска
        (можно использовать для сортировки на фронтенде)
        """
        request = self.context.get('request')
        if not request:
            return 0
        
        # Получаем параметры запроса
        email_query = request.query_params.get('email', '').lower()
        first_name_query = request.query_params.get('first_name', '').lower()
        last_name_query = request.query_params.get('last_name', '').lower()
        username_query = request.query_params.get('username', '').lower()
        
        relevance = 0
        
        # Проверяем совпадения по email
        if email_query:
            if obj.email.lower() == email_query:
                relevance = max(relevance, 100)
            elif obj.email.lower().startswith(email_query):
                relevance = max(relevance, 90)
            elif email_query in obj.email.lower():
                relevance = max(relevance, 80)
        
        # Проверяем совпадения по username
        if username_query and obj.username:
            if obj.username.lower() == username_query:
                relevance = max(relevance, 88)
            elif obj.username.lower().startswith(username_query):
                relevance = max(relevance, 78)
            elif username_query in obj.username.lower():
                relevance = max(relevance, 68)
        
        # Проверяем совпадения по имени
        if first_name_query and obj.first_name:
            first_name = obj.first_name.lower()
            if first_name == first_name_query:
                relevance = max(relevance, 75)
            elif first_name.startswith(first_name_query):
                relevance = max(relevance, 65)
            elif first_name_query in first_name:
                relevance = max(relevance, 50)
        
        # Проверяем совпадения по фамилии
        if last_name_query and obj.last_name:
            last_name = obj.last_name.lower()
            if last_name == last_name_query:
                relevance = max(relevance, 75)
            elif last_name.startswith(last_name_query):
                relevance = max(relevance, 65)
            elif last_name_query in last_name:
                relevance = max(relevance, 50)
        
        # Проверяем комбинацию имени и фамилии (если оба параметра указаны)
        if first_name_query and last_name_query and obj.first_name and obj.last_name:
            full_name = f"{obj.first_name} {obj.last_name}".lower()
            if full_name == f"{first_name_query} {last_name_query}":
                relevance = max(relevance, 95)
            elif full_name.startswith(f"{first_name_query} {last_name_query}"):
                relevance = max(relevance, 85)
        
        return relevance