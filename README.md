# Teamon – Web Messenger for Full-Fledged Teamwork

## Бэкенд
Предварительно необходимо перейти в папку `backend`
### Запуск:
Создайте виртуальное окружение (и зайдите в него)
```
python -m venv venv
```
Установите зависимости
```
pip install -r requirements.txt
```
Сделайте миграции (перейдя в папку `src`)
```
python manage.py migrate
```
Запустите бэкенд
```
python manage.py runserver
```
### Эндпоинты
Регистрация  
URL: `/api/auth/register/`  
Тело запроса:  
<img width="85" height="128" alt="изображение" src="https://github.com/user-attachments/assets/c344a415-f852-45b7-866a-3fd19273ac87" />  
Ответ:  
<img width="766" height="322" alt="изображение" src="https://github.com/user-attachments/assets/20bbcb23-bdc7-400a-b7f9-cc2774e5560b" />  

Логин  
URL: `/api/auth/login/`  
Тело запроса:  
<img width="177" height="51" alt="изображение" src="https://github.com/user-attachments/assets/e8a83ea9-61a7-4772-a997-5fc72c139550" />  
Ответ:  
<img width="758" height="324" alt="изображение" src="https://github.com/user-attachments/assets/6c0936aa-b36b-44ea-8593-915f938686bb" />  

Информация о пользователе  
URL: `/api/auth/profile`  
Важно использовать access_token пользователя. Auth Type: Bearer Token
Ответ:  
<img width="467" height="144" alt="изображение" src="https://github.com/user-attachments/assets/1ea40f7b-fcad-4fbf-86d8-d58e320a2cea" />  

# Полная документация API чатов

## Базовый URL
```
http://localhost:8000/api/chats/
```
WebSocket: `ws://localhost:8000/ws/`

## Аутентификация
Для всех запросов (кроме WebSocket подключения) требуется JWT токен в заголовке:
```
Authorization: Bearer <ваш_токен>
```

Для WebSocket токен передается в query параметре:
```
ws://localhost:8000/ws/chat/1/?token=<ваш_токен>
```

---

# REST API Эндпоинты

## 1. Чаты (Chats)

### 1.1. Получить все чаты пользователя
**GET** `/api/chats/chats/`

**Response 200 OK**
```json
[
    {
        "id": 1,
        "chat_type": "private",
        "name": null,
        "project": null,
        "project_details": null,
        "created_at": "2024-01-20T10:00:00Z",
        "updated_at": "2024-01-20T10:30:00Z",
        "participants": [
            {
                "id": 1,
                "user": {
                    "id": 1,
                    "email": "user1@example.com",
                    "first_name": "Иван",
                    "last_name": "Иванов",
                    "full_name": "Иван Иванов",
                    "display_name": "Иван Иванов"
                },
                "joined_at": "2024-01-20T10:00:00Z",
                "is_admin": true
            },
            {
                "id": 2,
                "user": {
                    "id": 2,
                    "email": "user2@example.com",
                    "first_name": "Петр",
                    "last_name": "Петров",
                    "full_name": "Петр Петров",
                    "display_name": "Петр Петров"
                },
                "joined_at": "2024-01-20T10:00:00Z",
                "is_admin": false
            }
        ],
        "last_message": {
            "id": 10,
            "text": "Привет!",
            "sender": {
                "id": 2,
                "email": "user2@example.com",
                "full_name": "Петр Петров"
            },
            "created_at": "2024-01-20T10:30:00Z"
        },
        "participant_count": 2
    },
    {
        "id": 2,
        "chat_type": "group",
        "name": "Проект Alpha",
        "project": 1,
        "project_details": {
            "id": 1,
            "name": "Проект Alpha",
            "description": "Описание проекта",
            "created_at": "2024-01-20T09:00:00Z",
            "updated_at": "2024-01-20T09:00:00Z"
        },
        "created_at": "2024-01-20T09:00:00Z",
        "updated_at": "2024-01-20T11:00:00Z",
        "participants": [...],
        "last_message": {...},
        "participant_count": 5
    }
]
```

### 1.2. Получить конкретный чат
**GET** `/api/chats/chats/{id}/`

**Response 200 OK**
```json
{
    "id": 1,
    "chat_type": "private",
    "name": null,
    "project": null,
    "project_details": null,
    "created_at": "2024-01-20T10:00:00Z",
    "updated_at": "2024-01-20T10:30:00Z",
    "participants": [...],
    "last_message": {...},
    "participant_count": 2
}
```

### 1.3. Создать личный чат
**POST** `/api/chats/chats/`

**Request Body:**
```json
{
    "chat_type": "private",
    "other_user_id": 2
}
```

**Response 201 Created**
```json
{
    "id": 3,
    "chat_type": "private",
    "name": null,
    "project": null,
    "project_details": null,
    "created_at": "2024-01-20T12:00:00Z",
    "updated_at": "2024-01-20T12:00:00Z",
    "participants": [
        {
            "id": 10,
            "user": {
                "id": 1,
                "email": "your@email.com",
                "first_name": "Иван",
                "last_name": "Иванов",
                "full_name": "Иван Иванов",
                "display_name": "Иван Иванов"
            },
            "joined_at": "2024-01-20T12:00:00Z",
            "is_admin": true
        },
        {
            "id": 11,
            "user": {
                "id": 2,
                "email": "other@example.com",
                "first_name": "Петр",
                "last_name": "Петров",
                "full_name": "Петр Петров",
                "display_name": "Петр Петров"
            },
            "joined_at": "2024-01-20T12:00:00Z",
            "is_admin": false
        }
    ],
    "last_message": null,
    "participant_count": 2
}
```

### 1.4. Создать групповой чат (без проекта)
**POST** `/api/chats/chats/`

**Request Body:**
```json
{
    "chat_type": "group",
    "name": "Чат команды разработки",
    "participant_ids": [2, 3, 4]
}
```

### 1.5. Создать групповой чат с проектом
**POST** `/api/chats/chats/`

**Request Body:**
```json
{
    "chat_type": "group",
    "project_name": "Мой новый проект",
    "project_description": "Описание проекта",
    "participant_ids": [2, 3, 4]
}
```

**Response 201 Created**
```json
{
    "id": 4,
    "chat_type": "group",
    "name": "Мой новый проект",
    "project": 1,
    "project_details": {
        "id": 1,
        "name": "Мой новый проект",
        "description": "Описание проекта",
        "created_at": "2024-01-20T12:00:00Z",
        "updated_at": "2024-01-20T12:00:00Z"
    },
    "created_at": "2024-01-20T12:00:00Z",
    "updated_at": "2024-01-20T12:00:00Z",
    "participants": [
        {
            "id": 12,
            "user": {
                "id": 1,
                "email": "your@email.com",
                "first_name": "Иван",
                "last_name": "Иванов",
                "full_name": "Иван Иванов",
                "display_name": "Иван Иванов"
            },
            "joined_at": "2024-01-20T12:00:00Z",
            "is_admin": true
        }
    ],
    "last_message": null,
    "participant_count": 1
}
```

### 1.6. Добавить участника в групповой чат
**POST** `/api/chats/chats/{id}/add_participant/`

**Request Body:**
```json
{
    "user_id": 3
}
```

**Response 201 Created**
```json
{
    "id": 15,
    "user": {
        "id": 3,
        "email": "newuser@example.com",
        "first_name": "Новый",
        "last_name": "Пользователь",
        "full_name": "Новый Пользователь",
        "display_name": "Новый Пользователь"
    },
    "joined_at": "2024-01-20T12:05:00Z",
    "is_admin": false
}
```

**Response 403 Forbidden** (если не админ)
```json
{
    "error": "Only admins can add participants"
}
```

### 1.7. Удалить участника из группового чата
**POST** `/api/chats/chats/{id}/remove_participant/`

**Request Body:**
```json
{
    "user_id": 3
}
```

**Response 200 OK**
```json
{
    "status": "participant removed"
}
```

### 1.8. Получить доступных пользователей для добавления
**GET** `/api/chats/chats/{id}/available_users/`

**Response 200 OK**
```json
[
    {
        "id": 3,
        "email": "user3@example.com",
        "first_name": "Сергей",
        "last_name": "Сергеев",
        "full_name": "Сергей Сергеев",
        "display_name": "Сергей Сергеев"
    },
    {
        "id": 4,
        "email": "user4@example.com",
        "first_name": "Анна",
        "last_name": "Аннова",
        "full_name": "Анна Аннова",
        "display_name": "Анна Аннова"
    }
]
```

---

## 2. Сообщения (Messages)

### 2.1. Получить сообщения чата
**GET** `/api/chats/messages/?chat_id={id}`

Параметры:
- `chat_id` - ID чата (обязательно)
- `page` - номер страницы (опционально)
- `page_size` - количество сообщений на странице (опционально, по умолчанию 50)

**Response 200 OK**
```json
[
    {
        "id": 101,
        "chat": 1,
        "sender": {
            "id": 2,
            "email": "user2@example.com",
            "first_name": "Петр",
            "last_name": "Петров",
            "full_name": "Петр Петров",
            "display_name": "Петр Петров"
        },
        "text": "Привет! Как дела?",
        "created_at": "2024-01-20T10:30:00Z",
        "updated_at": "2024-01-20T10:30:00Z",
        "is_deleted": false,
        "reply_to": null,
        "reply_to_data": null,
        "attachments": []
    },
    {
        "id": 100,
        "chat": 1,
        "sender": {
            "id": 1,
            "email": "user1@example.com",
            "first_name": "Иван",
            "last_name": "Иванов",
            "full_name": "Иван Иванов",
            "display_name": "Иван Иванов"
        },
        "text": "Всем привет!",
        "created_at": "2024-01-20T10:29:00Z",
        "updated_at": "2024-01-20T10:29:00Z",
        "is_deleted": false,
        "reply_to": null,
        "reply_to_data": null,
        "attachments": []
    }
]
```

### 2.2. Отправить сообщение
**POST** `/api/chats/messages/`

**Request Body:**
```json
{
    "chat": 1,
    "text": "Новое сообщение",
    "reply_to": null  // опционально, ID сообщения на которое отвечаем
}
```

**Response 201 Created**
```json
{
    "id": 102,
    "chat": 1,
    "sender": {
        "id": 1,
        "email": "user1@example.com",
        "first_name": "Иван",
        "last_name": "Иванов",
        "full_name": "Иван Иванов",
        "display_name": "Иван Иванов"
    },
    "text": "Новое сообщение",
    "created_at": "2024-01-20T12:10:00Z",
    "updated_at": "2024-01-20T12:10:00Z",
    "is_deleted": false,
    "reply_to": null,
    "reply_to_data": null,
    "attachments": []
}
```

### 2.3. Удалить сообщение (soft delete)
**POST** `/api/chats/messages/{id}/mark_as_deleted/`

**Response 200 OK**
```json
{
    "status": "deleted"
}
```

### 2.4. Ответить на сообщение
**POST** `/api/chats/messages/`

**Request Body:**
```json
{
    "chat": 1,
    "text": "Это ответ на предыдущее сообщение",
    "reply_to": 100
}
```

**Response 201 Created** (содержит информацию об оригинальном сообщении)
```json
{
    "id": 103,
    "chat": 1,
    "sender": {...},
    "text": "Это ответ на предыдущее сообщение",
    "created_at": "2024-01-20T12:15:00Z",
    "reply_to": 100,
    "reply_to_data": {
        "id": 100,
        "text": "Всем привет!",
        "sender": {
            "id": 1,
            "email": "user1@example.com",
            "first_name": "Иван",
            "last_name": "Иванов",
            "full_name": "Иван Иванов"
        }
    },
    "attachments": []
}
```

---

# WebSocket эндпоинты

## 3. WebSocket соединения

### 3.1. Подключение к чату
**WebSocket URL:** `ws://localhost:8000/ws/chat/{chat_id}/?token={jwt_token}`

**Пример подключения:**
```
ws://localhost:8000/ws/chat/1/?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3.2. Типы сообщений от клиента к серверу

#### Отправка сообщения
```json
{
    "type": "message",
    "text": "Текст сообщения"
}
```

### 3.3. Типы сообщений от сервера к клиенту

#### Новое сообщение
```json
{
    "type": "new_message",
    "message_id": 102,
    "text": "Текст сообщения",
    "user_id": 1,
    "email": "user1@example.com",
    "full_name": "Иван Иванов",
    "display_name": "Иван Иванов",
    "created_at": "2024-01-20T12:10:00Z"
}
```

#### Пользователь подключился
```json
{
    "type": "user_connected",
    "user_id": 2,
    "email": "user2@example.com",
    "full_name": "Петр Петров",
    "display_name": "Петр Петров"
}
```

#### Пользователь отключился
```json
{
    "type": "user_disconnected",
    "user_id": 2,
    "email": "user2@example.com",
    "full_name": "Петр Петров",
    "display_name": "Петр Петров",
    "close_code": 1000
}
```

#### Новый участник в чате
```json
{
    "type": "new_participant",
    "user_id": 3,
    "email": "newuser@example.com",
    "full_name": "Новый Пользователь",
    "display_name": "Новый Пользователь",
    "joined_at": "2024-01-20T12:05:00Z"
}
```

#### Краткая инструкция для запуска проекта
В первой командной строке (для бэкэнда):
```
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
cd src
python manage.py migrate
python manage.py runserver
```

Во второй командной строке (для фронтенда):
```
cd frontend
npm install
npm run dev
```