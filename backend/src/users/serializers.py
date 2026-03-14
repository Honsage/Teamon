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
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'first_name', 'last_name', 'date_joined')
        read_only_fields = ('id', 'username', 'date_joined')

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, style={'input_type': 'password'})
    password2 = serializers.CharField(write_only=True, style={'input_type': 'password'}, label='Подтверждение пароля')

    class Meta:
        model = User
        fields = ('email', 'password', 'password2', 'first_name', 'last_name')
        extra_kwargs = {
            'first_name': {'required': True},
            'last_name': {'required': True},
        }

    def validate(self, data):
        if data['password'] != data['password2']:
            raise serializers.ValidationError("Пароли не совпадают")
        return data

    def create(self, validated_data):
        validated_data.pop('password2')
        password = validated_data.pop('password')
        # username будет установлен автоматически в модели User.save()
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user

# serializers.py - добавьте в конец файла

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
        
        query = request.query_params.get('q', '').lower()
        
        # Проверяем точные совпадения
        if obj.email.lower() == query:
            return 100  # Точное совпадение email
        elif obj.email.lower().startswith(query):
            return 90   # Email начинается с запроса
        elif query in obj.email.lower():
            return 80   # Email содержит запрос
        
        # Проверяем совпадения username
        if obj.username and obj.username.lower() == query:
            return 88   # Точное совпадение username
        elif obj.username and obj.username.lower().startswith(query):
            return 78   # Username начинается с запроса
        
        # Проверяем совпадения имени/фамилии
        full_name = self.get_full_name(obj).lower()
        if full_name == query:
            return 95   # Точное совпадение полного имени
        elif full_name.startswith(query):
            return 85   # Полное имя начинается с запроса
        
        # Проверяем отдельно имя и фамилию
        first_name = (obj.first_name or '').lower()
        last_name = (obj.last_name or '').lower()
        
        if first_name == query or last_name == query:
            return 75   # Точное совпадение с именем или фамилией
        elif first_name.startswith(query) or last_name.startswith(query):
            return 65   # Имя или фамилия начинаются с запроса
        elif query in first_name or query in last_name:
            return 50   # Частичное совпадение
        
        return 40  # Другие совпадения