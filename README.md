# Teamon

**Web Messenger for Full-Fledged Teamwork**

[![Python](https://img.shields.io/badge/Python-3775A8?logo=python&logoColor=white)](https://python.org)
[![Django](https://img.shields.io/badge/Django-092E20?logo=django&logoColor=white)](https://djangoproject.com)
[![DRF](https://img.shields.io/badge/DRF-000000?logo=django&logoColor=white)](https://www.django-rest-framework.org)
[![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)](https://vitejs.dev)
[![WebSocket](https://img.shields.io/badge/WebSocket-010101?logo=socket.io&logoColor=white)](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)
[![Docker](https://img.shields.io/badge/Docker-2496ED?logo=docker&logoColor=white)](https://docker.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## About the Project

**Teamon** is a modern web messenger designed for full-fledged teamwork. It combines the familiarity of instant messaging with powerful project management features, allowing teams to communicate effectively, organize group chats around projects, and manage participants in real-time.

The project features a clean API-first architecture with JWT authentication and real-time WebSocket connections, making it a flexible solution for teams looking for a transparent and customizable communication tool.

### Key Features

- **Private & Group Chats** – one-on-one conversations or team-based group discussions.
- **Project-Based Chats** – group chats can be linked to projects with descriptions.
- **Real-Time Messaging** – instant message delivery via WebSocket (Socket.IO).
- **Reply to Messages** – ability to reply to specific messages within a chat.
- **Soft Delete** – messages can be deleted without permanent removal.
- **Participant Management** – add or remove users in group chats (admin-only).
- **JWT Authentication** – secure token-based authentication for all API endpoints.
- **Docker Support** – one-command setup for both backend and frontend.
- **SQLite Database** – lightweight and portable; data is persisted via Docker volumes.

---

## Tech Stack

- **Backend**: Python 3.11+, Django 5.2, Django REST Framework
- **Database**: SQLite (development) / configurable for production
- **Authentication**: JWT (djangorestframework-simplejwt)
- **Real-Time**: Django Channels (WebSocket)
- **Frontend**: Vite + (React/Vue/your choice)
- **Deployment**: Docker + docker-compose
- **File Storage**: Local media storage via Docker volume

---

## Build & Run

Clone the repository:

```bash
git clone https://github.com/yourusername/teamon.git
cd teamon
```

### 1. Using Docker (Recommended – one command for backend + frontend)

Requirements: [Docker](https://docs.docker.com/get-docker/) and Docker Compose v2.

From the **repository root**:

```bash
docker compose up --build
```

After startup:

- API: `http://localhost:8000`
- Frontend (Vite): `http://localhost:5173`

> Migrations run automatically when the `backend` container starts.  
> SQLite database is stored in a named volume `teamon_data` (`/data/db.sqlite3` inside the container).  
> Uploaded files are stored in the `teamon_media` volume.

**Stop:** `Ctrl+C` or `docker compose down`  
**Stop + delete data volumes:** `docker compose down -v`

### 2. Local Development (Without Docker)

#### Backend

Navigate to the `backend` folder:

```bash
cd backend
python -m venv venv
source venv/bin/activate    # Windows: venv\Scripts\activate

pip install -r requirements.txt
cd src
python manage.py migrate
python manage.py runserver
```

#### Frontend

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

> **Note:** When running manually, the database is created at `backend/src/db.sqlite3`.

---

## API Endpoints

Base URL: `http://localhost:8000/api/`

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register/` | User registration |
| POST | `/auth/login/` | Login (returns JWT tokens) |
| GET | `/auth/profile/` | Get current user info (requires Bearer token) |

**Example Login Request:**
```json
{
    "email": "user@example.com",
    "password": "yourpassword"
}
```

### Chats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chats/chats/` | Get all user chats |
| GET | `/chats/chats/{id}/` | Get specific chat |
| POST | `/chats/chats/` | Create private/group chat |
| POST | `/chats/chats/{id}/add_participant/` | Add participant (group admin only) |
| POST | `/chats/chats/{id}/remove_participant/` | Remove participant (group admin only) |
| GET | `/chats/chats/{id}/available_users/` | Get users available to add |

### Messages

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/chats/messages/?chat_id={id}` | Get messages in a chat (paginated) |
| POST | `/chats/messages/` | Send a new message |
| POST | `/chats/messages/{id}/mark_as_deleted/` | Soft-delete a message |

---

## WebSocket Real-Time Events

**Connection URL:** `ws://localhost:8000/ws/chat/{chat_id}/?token={jwt_token}`

### Client → Server

```json
{
    "type": "message",
    "text": "Your message text"
}
```

### Server → Client

| Type | Description |
|------|-------------|
| `new_message` | A new message was sent |
| `user_connected` | A user joined the chat |
| `user_disconnected` | A user left the chat |
| `new_participant` | A new participant was added (group chat) |

---

## Project Structure

```bash
teamon/
├── README.md
├── docker-compose.yaml
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── src/
│       ├── manage.py
│       ├── db.sqlite3          # (when running manually)
│       └── ...                 # Django project files
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/                    # Frontend source code
```

---

## License

This project is licensed under the MIT License – you are free to use, modify, and distribute it.

Contributions are welcome! Feel free to open issues and pull requests.
```