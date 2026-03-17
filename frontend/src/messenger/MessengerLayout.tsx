import React, { useEffect, useMemo, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";
import { ParticipantsModal } from "./ParticipantsModal";

type ChatParticipant = {
  id: number;
  user: {
    id: number;
    email: string;
    full_name: string;
    display_name: string;
  };
};

type Chat = {
  id: number;
  chat_type: "private" | "group";
  name: string | null;
  project_details: { name: string } | null;
  last_message: {
    text: string;
    created_at: string;
    sender: { full_name: string } | null;
  } | null;
  participants: ChatParticipant[];
};

type Message = {
  id: number;
  chat: number;
  text: string;
  created_at: string;
  is_deleted?: boolean;
  reply_to?: number | null;
  reply_to_data?: {
    id: number;
    text: string;
    sender: {
      id: number;
      full_name: string;
      display_name?: string;
    };
  } | null;
  sender: {
    id: number;
    full_name: string;
    display_name: string;
  };
};

type UserProfileForSearch = {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
};

const ChatsSidebar: React.FC<{
  chats: Chat[];
  currentChatId: number | null;
  onSelect: (id: number) => void;
  onCreateGroupChat: () => void;
  userSearch: string;
  onUserSearchChange: (value: string) => void;
  suggestions: UserProfileForSearch[];
  onSuggestionClick: (user: UserProfileForSearch) => void;
  suggestionsOpen: boolean;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
}> = ({
  chats,
  currentChatId,
  onSelect,
  onCreateGroupChat,
  userSearch,
  onUserSearchChange,
  suggestions,
  onSuggestionClick,
  suggestionsOpen,
  onSearchFocus,
  onSearchBlur
}) => {
  return (
    <aside className="hidden md:flex md:flex-col w-80 border-r border-slate-800 bg-slate-950/60">
      <div className="px-4 py-4 border-b border-slate-800 flex items-center gap-2">
        <div className="h-9 w-9 rounded-2xl bg-primary flex items-center justify-center font-semibold">
          T
        </div>
        <div>
          <p className="text-sm font-medium">Teamon</p>
          <p className="text-xs text-slate-400">Командный мессенджер</p>
        </div>
      </div>
      <div className="px-4 py-3 relative">
        <input
          placeholder="Найти пользователя по email..."
          className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary"
          value={userSearch}
          onChange={(e) => onUserSearchChange(e.target.value)}
          onFocus={onSearchFocus}
          onBlur={onSearchBlur}
        />
        {suggestionsOpen && suggestions.length > 0 && (
          <div className="absolute left-4 right-4 top-12 z-10 max-h-64 overflow-y-auto rounded-xl bg-slate-900 border border-slate-700 shadow-soft text-xs">
            {suggestions.map((u) => (
              <button
                key={u.id}
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-slate-800"
                onClick={() => onSuggestionClick(u)}
              >
                <p className="font-medium">{u.email}</p>
                {(u.first_name || u.last_name) && (
                  <p className="text-slate-400">
                    {[u.first_name, u.last_name].filter(Boolean).join(" ")}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto space-y-1 px-2 pb-3 scrollbar-thin">
        {chats.map((chat) => {
          const isActive = currentChatId === chat.id;
          const title =
            chat.name ||
            chat.project_details?.name ||
            chat.participants
              .map(
                (p) => p.user?.display_name ?? p.user?.full_name ?? ""
              )
              .filter((name) => name.length > 0)
              .join(", ");
          return (
            <button
              key={chat.id}
              className={`w-full text-left rounded-xl px-3 py-2.5 transition ${
                isActive
                  ? "bg-primary/80 text-white"
                  : "hover:bg-slate-800/70 text-slate-100"
              }`}
              onClick={() => onSelect(chat.id)}
            >
              <p className="text-sm font-medium truncate">{title}</p>
              {chat.last_message && (
                <p className="text-xs text-slate-300 line-clamp-1">
                  {chat.last_message.sender
                    ? `${chat.last_message.sender.full_name}: `
                    : ""}
                  {chat.last_message.text}
                </p>
              )}
            </button>
          );
        })}
        {chats.length === 0 && (
          <div className="px-2 py-2 space-y-2">
            <p className="text-xs text-slate-500">
              У вас пока нет диалогов. Нажмите кнопку ниже, чтобы создать первый
              чат.
            </p>
            <button
              type="button"
              className="w-full rounded-xl bg-primary/90 hover:bg-primary text-xs font-medium py-2"
              onClick={onCreateGroupChat}
            >
              Новый групповой чат
            </button>
          </div>
        )}
      </div>
      {chats.length > 0 && (
        <div className="px-3 pb-3">
          <button
            type="button"
            className="w-full rounded-xl border border-dashed border-slate-600 text-xs text-slate-200 py-2 hover:bg-slate-800/70"
            onClick={onCreateGroupChat}
          >
            + Новый групповой чат
          </button>
        </div>
      )}
    </aside>
  );
};

type MessagesPaneProps = {
  chat: Chat | null;
  messages: Message[];
  replyTo: Message | null;
  onSend: (text: string) => void;
  onReplySelect: (message: Message) => void;
  onClearReply: () => void;
  onDelete: (message: Message) => void;
  onOpenParticipants: () => void;
};

const MessagesPane: React.FC<MessagesPaneProps> = ({
  chat,
  messages,
  replyTo,
  onSend,
  onReplySelect,
  onClearReply,
  onDelete,
  onOpenParticipants
}) => {
  const { user } = useAuth();
  const [text, setText] = useState("");

  const title = chat
    ? chat.name ||
      chat.project_details?.name ||
      chat.participants
        .map((p) => p.user?.display_name ?? p.user?.full_name ?? "")
        .filter((name) => name.length > 0)
        .join(", ")
    : "Выберите чат";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <section className="flex flex-col flex-1">
      <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">{title}</p>
          {chat && (
            <p className="text-xs text-slate-400">
              Участники:{" "}
              {chat.participants
                .map((p) => p.user?.display_name ?? p.user?.full_name ?? "")
                .filter((name) => name.length > 0)
                .join(", ")}
            </p>
          )}
        </div>
        {chat?.chat_type === "group" && (
          <button
            type="button"
            className="text-xs px-3 py-1.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800"
            onClick={onOpenParticipants}
          >
            Участники
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-thin bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        {!chat && (
          <div className="h-full flex items-center justify-center">
            <p className="text-sm text-slate-500">
              Выберите чат слева, чтобы начать общение.
            </p>
          </div>
        )}
        {chat &&
          messages.map((m) => {
            const isMine = m.sender?.id === user?.id;
            const baseBubble =
              "max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-soft relative group";
            const bubbleColors = m.is_deleted
              ? "bg-slate-900 text-slate-500 italic"
              : isMine
              ? "bg-primary text-white rounded-br-sm"
              : "bg-slate-800 text-slate-50 rounded-bl-sm";

            return (
              <div
                key={m.id}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div className={`${baseBubble} ${bubbleColors}`}>
                  {!isMine && !m.is_deleted && m.sender && (
                    <p className="text-[11px] text-slate-300 mb-0.5">
                      {m.sender.display_name ??
                        m.sender.full_name ??
                        "Неизвестный пользователь"}
                    </p>
                  )}
                  {m.reply_to_data &&
                    !m.is_deleted &&
                    m.reply_to_data.sender != null && (
                    <div className="mb-1 border-l-2 border-slate-500/60 pl-2 text-[11px] text-slate-200/80">
                      <span className="block font-semibold">
                        {m.reply_to_data.sender?.display_name ??
                          m.reply_to_data.sender?.full_name ??
                          "Неизвестный пользователь"}
                      </span>
                      <span className="line-clamp-2">{m.reply_to_data.text}</span>
                    </div>
                  )}
                  <p>{m.is_deleted ? "Сообщение удалено" : m.text}</p>

                  {!m.is_deleted && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-5 right-1 flex gap-1 text-[11px] text-slate-300">
                      <button
                        type="button"
                        className="px-1.5 py-0.5 rounded-full bg-slate-900/80 hover:bg-slate-800"
                        onClick={() => onReplySelect(m)}
                      >
                        Ответить
                      </button>
                      {isMine && (
                        <button
                          type="button"
                          className="px-1.5 py-0.5 rounded-full bg-slate-900/80 hover:bg-red-700/80"
                          onClick={() => onDelete(m)}
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-800 px-3 py-2 flex items-center gap-2 bg-slate-950/80"
      >
        {replyTo && (
          <div className="mr-2 max-w-[40%] rounded-xl bg-slate-900/90 border border-slate-700 px-3 py-1.5 text-[11px] text-slate-200 flex items-start gap-2">
            <div className="h-full w-1 rounded-full bg-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">
                  {replyTo.sender?.display_name ??
                    replyTo.sender?.full_name ??
                    "Сообщение"}
                </span>
                <button
                  type="button"
                  className="text-slate-400 hover:text-slate-100"
                  onClick={onClearReply}
                >
                  ✕
                </button>
              </div>
              <p className="line-clamp-2">{replyTo.text}</p>
            </div>
          </div>
        )}
        <input
          placeholder={chat ? "Напишите сообщение..." : "Выберите чат сверху"}
          className="flex-1 rounded-xl bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          disabled={!chat}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          disabled={!chat || !text.trim()}
          className="h-10 w-10 rounded-full bg-primary flex items-center justify-center text-sm font-semibold disabled:opacity-50"
        >
          ➤
        </button>
      </form>
    </section>
  );
};

const ProfileSidebar: React.FC = () => {
  const { user, logout } = useAuth();
  return (
    <aside className="hidden lg:flex lg:flex-col w-72 border-l border-slate-800 bg-slate-950/60">
      <div className="px-4 py-4 border-b border-slate-800">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 mb-2">
          Профиль
        </p>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-semibold">
            {user?.display_name?.[0] ?? "U"}
          </div>
          <div>
            <p className="text-sm font-medium">{user?.display_name}</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
        </div>
      </div>
      <div className="flex-1 px-4 py-4 space-y-3 text-xs text-slate-400">
        <p className="font-semibold text-slate-300">Командные чаты</p>
        <p>
          Управляйте проектами, обсуждайте задачи и держите всю историю общения
          в одном месте.
        </p>
      </div>
      <div className="px-4 py-4 border-t border-slate-800">
        <button
          className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 transition"
          onClick={logout}
        >
          Выйти
        </button>
      </div>
    </aside>
  );
};

const MessengerShell: React.FC = () => {
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userSuggestions, setUserSuggestions] =
    useState<UserProfileForSearch[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);

  const currentChat = useMemo(
    () => chats.find((c) => c.id === currentChatId) ?? null,
    [chats, currentChatId]
  );

  const visibleChats = useMemo(
    () =>
      chats.filter(
        (c) => c.chat_type === "group" || c.last_message !== null
      ),
    [chats]
  );

  // Fetch chats once
  useEffect(() => {
    if (!accessToken) return;
    const fetchChats = async () => {
      const resp = await axios.get<Chat[]>("/api/chats/chats/", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setChats(resp.data);
    };
    fetchChats().catch(console.error);
  }, [accessToken]);

  // Fetch messages on chat change
  useEffect(() => {
    if (!accessToken || !currentChatId) return;
    const fetchMessages = async () => {
      const resp = await axios.get<Message[]>(
        `/api/chats/messages/?chat_id=${currentChatId}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      const sorted = resp.data
        .slice()
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        );
      setMessages(sorted);
    };
    fetchMessages().catch(console.error);
  }, [accessToken, currentChatId]);

  // WebSocket live updates
  useEffect(() => {
    if (!accessToken || !currentChatId) return;
    const url = new URL(`/ws/chat/${currentChatId}/`, window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("token", accessToken);
    const socket = new WebSocket(url.toString());

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          text?: string;
          message_id?: number;
          created_at?: string;
          user_id?: number;
          full_name?: string;
          display_name?: string;
        };
        if (data.type === "new_message" && data.text && data.message_id) {
          const incoming: Message = {
            id: data.message_id ?? 0,
            chat: currentChatId,
            text: data.text ?? "",
            created_at: data.created_at ?? new Date().toISOString(),
            sender: {
              id: data.user_id ?? 0,
              full_name: data.full_name ?? "Пользователь",
              display_name: data.display_name ?? (data.full_name ?? "User")
            }
          };
          setMessages((prev) =>
            [...prev, incoming].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            )
          );
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => {
      socket.close();
    };
  }, [accessToken, currentChatId]);

  // Search users by email to start private chat
  useEffect(() => {
    if (!accessToken || userSearch.trim().length < 2) {
      setUserSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const run = async () => {
      try {
        const resp = await axios.get<UserProfileForSearch[]>(
          `/api/auth/users/search/?email=${encodeURIComponent(
            userSearch.trim()
          )}`,
          {
            headers: { Authorization: `Bearer ${accessToken}` },
            signal: controller.signal
          }
        );
        setUserSuggestions(resp.data);
      } catch (e) {
        if ((e as Error).name !== "CanceledError") {
          console.error(e);
        }
      }
    };
    void run();
    return () => controller.abort();
  }, [accessToken, userSearch]);

  const handleSendMessage = async (text: string) => {
    if (!accessToken || !currentChatId) return;
    try {
      const resp = await axios.post<Message>(
        "/api/chats/messages/",
        { chat: currentChatId, text, reply_to: replyTo ? replyTo.id : null },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      const created = resp.data;
      setMessages((prev) =>
        [...prev, created].sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        )
      );
      setReplyTo(null);
      const chatsResp = await axios.get<Chat[]>("/api/chats/chats/", {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      setChats(chatsResp.data);
    } catch (e) {
      console.error(e);
      // даже если бэк ответил 500 при нотификации, не ломаем UI
    }
  };

  const handleDeleteMessage = async (message: Message) => {
    if (!accessToken) return;
    await axios.post(
      `/api/chats/messages/${message.id}/mark_as_deleted/`,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );
    setMessages((prev) =>
      prev.map((m) =>
        m.id === message.id ? { ...m, is_deleted: true, text: "" } : m
      )
    );
  };

  const handleCreateChat = async (data: {
    chatType: "private" | "group";
    otherUserEmail?: string;
    name?: string;
    participantIds?: number[];
    projectName?: string;
    projectDescription?: string;
  }) => {
    if (!accessToken) return;
    const payload: Record<string, unknown> = {
      chat_type: data.chatType
    };

    if (data.chatType === "private" && data.otherUserEmail) {
      const searchResp = await axios.get<UserProfileForSearch[]>(
        `/api/auth/users/search/?email=${encodeURIComponent(
          data.otherUserEmail
        )}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const target = searchResp.data.find(
        (u) => u.email.toLowerCase() === data.otherUserEmail?.toLowerCase()
      );
      if (!target) {
        throw new Error("Пользователь с таким email не найден.");
      }
      payload.other_user_id = target.id;
    }
    if (data.chatType === "group") {
      if (data.name) payload.name = data.name;
      if (data.participantIds && data.participantIds.length) {
        payload.participant_ids = data.participantIds;
      }
      if (data.projectName) {
        payload.project_name = data.projectName;
        if (data.projectDescription) {
          payload.project_description = data.projectDescription;
        }
      }
    }

    const resp = await axios.post<Chat>("/api/chats/chats/", payload, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    setChats((prev) => [...prev, resp.data]);
    setCurrentChatId(resp.data.id);
    setShowCreateChat(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex flex-col">
      <header className="md:hidden px-4 py-3 border-b border-slate-800 flex items-center justify-between">
        <p className="font-semibold">Teamon</p>
        <button
          className="text-xs px-3 py-1.5 rounded-full border border-slate-700"
          onClick={() => navigate("/auth/login")}
        >
          Сменить аккаунт
        </button>
      </header>
      <main className="flex-1 flex flex-col md:flex-row max-h-[calc(100vh-3.25rem)] md:max-h-screen">
        <ChatsSidebar
          chats={visibleChats}
          currentChatId={currentChatId}
          onSelect={setCurrentChatId}
          onCreateGroupChat={() => setShowCreateChat(true)}
          userSearch={userSearch}
          onUserSearchChange={(v) => {
            setUserSearch(v);
            if (!suggestionsOpen) setSuggestionsOpen(true);
          }}
          suggestions={userSuggestions}
          suggestionsOpen={suggestionsOpen}
          onSearchFocus={() => {
            if (userSearch.trim().length >= 2) {
              setSuggestionsOpen(true);
            }
          }}
          onSearchBlur={() => {
            // небольшая задержка, чтобы успел сработать клик по элементу
            setTimeout(() => setSuggestionsOpen(false), 120);
          }}
          onSuggestionClick={async (user) => {
            if (!accessToken) return;
            try {
              const resp = await axios.post<Chat>(
                "/api/chats/chats/",
                { chat_type: "private", other_user_id: user.id },
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
              const chat = resp.data;
              setChats((prev) => {
                const exists = prev.find((c) => c.id === chat.id);
                if (exists) {
                  return prev.map((c) => (c.id === chat.id ? chat : c));
                }
                return [...prev, chat];
              });
              setCurrentChatId(chat.id);
              setUserSearch("");
              setUserSuggestions([]);
            } catch (e) {
              console.error(e);
            }
          }}
        />
        <MessagesPane
          chat={currentChat}
          messages={messages}
          replyTo={replyTo}
          onSend={(text) => {
            void handleSendMessage(text);
          }}
          onReplySelect={setReplyTo}
          onClearReply={() => setReplyTo(null)}
          onDelete={handleDeleteMessage}
          onOpenParticipants={() => setShowParticipants(true)}
        />
        <ProfileSidebar />
      </main>
      {showCreateChat && (
        <CreateChatModal
          onClose={() => setShowCreateChat(false)}
          onSubmit={handleCreateChat}
        />
      )}
      {showParticipants && currentChat && accessToken && (
        <ParticipantsModal
          chat={currentChat}
          accessToken={accessToken}
          onClose={() => setShowParticipants(false)}
          onParticipantsChange={(participants: ChatParticipant[]) => {
            setChats((prev) =>
              prev.map((c) =>
                c.id === currentChat.id ? { ...c, participants } : c
              )
            );
          }}
        />
      )}
    </div>
  );
};

type CreateChatModalProps = {
  onClose: () => void;
  onSubmit: (data: {
    chatType: "private" | "group";
    otherUserEmail?: string;
    name?: string;
    participantIds?: number[];
    projectName?: string;
    projectDescription?: string;
  }) => Promise<void> | void;
};

const CreateChatModal: React.FC<CreateChatModalProps> = ({
  onClose,
  onSubmit
}) => {
  const [name, setName] = useState("");
  const [participantEmails, setParticipantEmails] = useState("");
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        chatType: "group",
        name: name || projectName,
        participantIds: undefined,
        projectName: projectName || undefined,
        projectDescription: projectDescription || undefined
      });
    } catch (err) {
      console.error(err);
      setError("Не удалось создать чат. Проверьте введённые данные.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="glass-panel max-w-lg w-full p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Новый чат</h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="text-xs text-slate-300" htmlFor="name">
                  Название чата
                </label>
                <input
                  id="name"
                  type="text"
                  className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-300" htmlFor="participantEmails">
                  Email участников (через запятую, пока опционально)
                </label>
                <input
                  id="participantEmails"
                  type="text"
                  className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={participantEmails}
                  onChange={(e) => setParticipantEmails(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-xs text-slate-300"
                  htmlFor="projectName"
                >
                  Название проекта (опционально)
                </label>
                <input
                  id="projectName"
                  type="text"
                  className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <label
                  className="text-xs text-slate-300"
                  htmlFor="projectDescription"
                >
                  Описание проекта (опционально)
                </label>
                <textarea
                  id="projectDescription"
                  rows={2}
                  className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  value={projectDescription}
                  onChange={(e) => setProjectDescription(e.target.value)}
                />
              </div>
          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="px-3 py-2 text-sm rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
              onClick={onClose}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm rounded-xl bg-primary hover:bg-primaryDark disabled:opacity-60"
            >
              {submitting ? "Создаём..." : "Создать чат"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const MessengerLayout: React.FC = () => {
  return (
    <Routes>
      <Route path="chats" element={<MessengerShell />} />
      <Route path="*" element={<Navigate to="chats" replace />} />
    </Routes>
  );
};

export default MessengerLayout;

