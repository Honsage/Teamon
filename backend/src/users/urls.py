# urls.py - обновите urlpatterns
from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    LoginView, LogoutView, UserProfileView, 
    RegisterView, UserSearchView, UserDetailView
)

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('profile/', UserProfileView.as_view(), name='profile'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('register/', RegisterView.as_view(), name='register'),
    
    # Новые эндпоинты для поиска пользователей
    path('users/search/', UserSearchView.as_view(), name='user-search'),
    path('users/<int:user_id>/', UserDetailView.as_view(), name='user-detail'),
]