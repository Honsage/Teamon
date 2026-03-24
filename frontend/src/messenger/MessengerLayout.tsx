import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";
import { ParticipantsModal } from "./ParticipantsModal";
import SettingsPage from "../settings/SettingsPage";

type ChatParticipant = {
  id: number;
  is_admin?: boolean;
  role_title?: string;
  user: {
    id: number;
    username?: string;
    email: string;
    first_name?: string;
    last_name?: string;
    full_name: string;
    display_name: string;
  };
};

type Chat = {
  id: number;
  chat_type: "private" | "group";
  name: string | null;
  has_kanban?: boolean;
  unread_count?: number;
  has_unread_mention?: boolean;
  project_details: { name: string; description?: string } | null;
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
    username?: string;
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
  currentUserId?: number;
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
  mobile?: boolean;
  onAfterSelect?: () => void;
}> = ({
  chats,
  currentUserId,
  currentChatId,
  onSelect,
  onCreateGroupChat,
  userSearch,
  onUserSearchChange,
  suggestions,
  onSuggestionClick,
  suggestionsOpen,
  onSearchFocus,
  onSearchBlur,
  mobile = false,
  onAfterSelect
}) => {
  const [highlightedSuggestionIdx, setHighlightedSuggestionIdx] = useState(0);

  useEffect(() => {
    setHighlightedSuggestionIdx(0);
  }, [suggestionsOpen, suggestions]);

  return (
    <aside
      className={
        mobile
          ? "flex flex-col w-full border-r border-slate-800 bg-slate-950"
          : "hidden lg:flex lg:flex-col w-80 border-r border-slate-800 bg-slate-950/60"
      }
    >
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
          onKeyDown={(e) => {
            if (!suggestionsOpen || suggestions.length === 0) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlightedSuggestionIdx((prev) =>
                Math.min(prev + 1, suggestions.length - 1)
              );
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlightedSuggestionIdx((prev) => Math.max(prev - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              onSuggestionClick(suggestions[highlightedSuggestionIdx]);
            }
          }}
        />
        {suggestionsOpen && suggestions.length > 0 && (
          <div className="absolute left-4 right-4 top-12 z-10 max-h-64 overflow-y-auto scrollbar-thin rounded-xl bg-slate-900 border border-slate-700 shadow-soft text-xs">
            {suggestions.map((u, idx) => (
              <button
                key={u.id}
                type="button"
                className={`w-full text-left px-3 py-2 hover:bg-slate-800 ${
                  idx === highlightedSuggestionIdx ? "bg-slate-800/80" : ""
                }`}
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
          const title = (() => {
            if (chat.chat_type === "private") {
              const other = chat.participants.find((p) => p.user?.id !== currentUserId);
              return (
                other?.user?.display_name ??
                other?.user?.full_name ??
                other?.user?.email ??
                "Личный чат"
              );
            }
            return (
              chat.name ||
              chat.project_details?.name ||
              chat.participants
                .map((p) => p.user?.display_name ?? p.user?.full_name ?? "")
                .filter((name) => name.length > 0)
                .join(", ")
            );
          })();
          return (
            <button
              key={chat.id}
              className={`w-full text-left rounded-xl px-3 py-2.5 transition ${
                isActive
                  ? "bg-primary/80 text-white"
                  : "hover:bg-slate-800/70 text-slate-100"
              }`}
              onClick={() => {
                onSelect(chat.id);
                onAfterSelect?.();
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{title}</p>
                  {chat.last_message && (
                    <p className="text-xs text-slate-300 line-clamp-1">
                      {chat.last_message.sender
                        ? `${chat.last_message.sender.full_name}: `
                        : ""}
                      {chat.last_message.text}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {chat.has_unread_mention && (
                    <span
                      className="h-[1.1rem] min-w-[1.1rem] px-0.5 rounded-full bg-accent/25 text-accent text-[10px] font-bold leading-none inline-flex items-center justify-center"
                      title="Упоминание"
                    >
                      @
                    </span>
                  )}
                  {(chat.unread_count ?? 0) > 0 && (
                    <span className="min-h-[1.1rem] min-w-[1.1rem] px-1 rounded-full bg-red-600 text-white text-[10px] font-semibold leading-none inline-flex items-center justify-center">
                      {formatUnreadBadge(chat.unread_count ?? 0)}
                    </span>
                  )}
                </div>
              </div>
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

const formatUnreadBadge = (n: number): string => {
  if (n <= 0) return "0";
  if (n > 999) return "999+";
  return String(n);
};

/** Максимальный id сообщения, пересекающего видимую область списка (для поэтапного mark_read). */
function getMaxVisibleMessageId(container: HTMLDivElement): number {
  const cr = container.getBoundingClientRect();
  const nodes = container.querySelectorAll("[data-message-id]");
  let maxId = 0;
  nodes.forEach((node) => {
    const raw = node.getAttribute("data-message-id");
    const id = raw ? parseInt(raw, 10) : 0;
    if (!id) return;
    const r = node.getBoundingClientRect();
    if (r.bottom > cr.top && r.top < cr.bottom) {
      maxId = Math.max(maxId, id);
    }
  });
  return maxId;
}

const normalizeErrorMessage = (raw: string): string =>
  raw
    .replaceAll("Username", "Никнейм")
    .replaceAll("username", "никнейм")
    .replaceAll("This field", "Это поле")
    .replaceAll("already exists", "уже существует")
    .replaceAll("already taken", "уже занят")
    .replaceAll("This value", "Это значение");

const extractApiErrorMessage = (err: unknown, fallback: string): string => {
  const responseData = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof responseData === "string" && responseData.trim()) {
    return normalizeErrorMessage(responseData);
  }
  if (responseData && typeof responseData === "object") {
    const data = responseData as Record<string, unknown>;
    if (typeof data.detail === "string") return normalizeErrorMessage(data.detail);
    if (typeof data.error === "string") return normalizeErrorMessage(data.error);
    for (const value of Object.values(data)) {
      if (typeof value === "string" && value.trim()) return normalizeErrorMessage(value);
      if (Array.isArray(value) && typeof value[0] === "string") {
        return normalizeErrorMessage(value[0]);
      }
    }
  }
  return fallback;
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
  onOpenAddParticipants: () => void;
  canManageParticipants: boolean;
  onMarkReadUpTo: (messageId: number) => void;
};

const MessagesPane: React.FC<MessagesPaneProps> = ({
  chat,
  messages,
  replyTo,
  onSend,
  onReplySelect,
  onClearReply,
  onDelete,
  onOpenParticipants,
  onOpenAddParticipants,
  canManageParticipants,
  onMarkReadUpTo
}) => {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [mentionState, setMentionState] = useState<{ start: number; query: string } | null>(
    null
  );
  const [mentionHighlight, setMentionHighlight] = useState(0);
  const [showProjectInfo, setShowProjectInfo] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesAreaRef = useRef<HTMLDivElement | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    message: Message;
    isMine: boolean;
  } | null>(null);
  const messageRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const markReadFlushRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markReadPendingMax = useRef(0);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const pendingScrollAfterOwnSendRef = useRef(false);
  const messageCountAtSendRef = useRef(0);
  const nearBottomRef = useRef(true);
  const prevMessageListLengthRef = useRef(0);

  const flushMarkRead = useCallback(() => {
    const id = markReadPendingMax.current;
    markReadPendingMax.current = 0;
    markReadFlushRef.current = null;
    if (id > 0 && chat) onMarkReadUpTo(id);
  }, [chat, onMarkReadUpTo]);

  const scheduleMarkRead = useCallback(
    (messageId: number) => {
      if (!chat || messageId <= 0) return;
      markReadPendingMax.current = Math.max(markReadPendingMax.current, messageId);
      if (markReadFlushRef.current) clearTimeout(markReadFlushRef.current);
      markReadFlushRef.current = setTimeout(flushMarkRead, 380);
    },
    [chat, flushMarkRead]
  );

  const updateScrollMetrics = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nearBottomPx = 96;
    nearBottomRef.current = distance <= nearBottomPx;
    setShowScrollDown(distance > 72);
    const maxId = getMaxVisibleMessageId(el);
    if (maxId > 0) scheduleMarkRead(maxId);
  }, [scheduleMarkRead]);

  const scrollMessagesToBottom = useCallback(() => {
    const el = messagesAreaRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    nearBottomRef.current = true;
    requestAnimationFrame(() => {
      messagesAreaRef.current && updateScrollMetrics();
    });
  }, [updateScrollMetrics]);

  useEffect(() => {
    markReadPendingMax.current = 0;
    pendingScrollAfterOwnSendRef.current = false;
    messageCountAtSendRef.current = 0;
    nearBottomRef.current = true;
    prevMessageListLengthRef.current = 0;
    if (markReadFlushRef.current) {
      clearTimeout(markReadFlushRef.current);
      markReadFlushRef.current = null;
    }
  }, [chat?.id]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setContextMenu(null);
    };
    window.addEventListener("click", close);
    window.addEventListener("keydown", onEsc);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onEsc);
    };
  }, []);

  useEffect(() => {
    if (!textAreaRef.current) return;
    textAreaRef.current.style.height = "0px";
    textAreaRef.current.style.height = `${Math.min(
      textAreaRef.current.scrollHeight,
      128
    )}px`;
  }, [text]);

  useEffect(() => {
    if (!pendingScrollAfterOwnSendRef.current) return;
    if (!messagesAreaRef.current || messages.length === 0) return;
    if (messages.length <= messageCountAtSendRef.current) return;
    const last = messages[messages.length - 1];
    if (last?.sender?.id !== user?.id) return;
    pendingScrollAfterOwnSendRef.current = false;
    messageCountAtSendRef.current = 0;
    messagesAreaRef.current.scrollTo({
      top: messagesAreaRef.current.scrollHeight,
      behavior: "smooth"
    });
    requestAnimationFrame(() => updateScrollMetrics());
  }, [messages, user?.id, updateScrollMetrics]);

  useEffect(() => {
    if (!chat) return;
    const prevLen = prevMessageListLengthRef.current;
    if (messages.length < prevLen) {
      prevMessageListLengthRef.current = messages.length;
      return;
    }
    if (messages.length === prevLen) return;
    prevMessageListLengthRef.current = messages.length;
    if (!nearBottomRef.current) return;
    if (!messagesAreaRef.current) return;
    requestAnimationFrame(() => {
      const el = messagesAreaRef.current;
      if (!el) return;
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      requestAnimationFrame(() => updateScrollMetrics());
    });
  }, [messages, chat, updateScrollMetrics]);

  useEffect(() => {
    if (!chat || messages.length === 0) {
      setShowScrollDown(false);
      return;
    }
    const el = messagesAreaRef.current;
    if (!el) return;
    const run = () => {
      updateScrollMetrics();
      if (el.scrollHeight <= el.clientHeight + 2) {
        const last = messages[messages.length - 1];
        if (last) scheduleMarkRead(last.id);
      }
    };
    requestAnimationFrame(run);
  }, [
    chat?.id,
    messages.length,
    messages[messages.length - 1]?.id,
    updateScrollMetrics,
    scheduleMarkRead
  ]);

  const title = chat
    ? chat.chat_type === "private"
      ? (chat.participants.find((p) => p.user?.id !== user?.id)?.user
          ?.display_name ??
        chat.participants.find((p) => p.user?.id !== user?.id)?.user?.full_name ??
        chat.participants.find((p) => p.user?.id !== user?.id)?.user?.email ??
        "Личный чат")
      : chat.name ||
        chat.project_details?.name ||
        chat.participants
          .map((p) => p.user?.display_name ?? p.user?.full_name ?? "")
          .filter((name) => name.length > 0)
          .join(", ")
    : "Выберите чат";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    messageCountAtSendRef.current = messages.length;
    pendingScrollAfterOwnSendRef.current = true;
    onSend(text.trim());
    setText("");
  };

  const scrollToMessage = (messageId?: number | null) => {
    if (!messageId) return;
    const target = messageRefs.current[messageId];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const mentionCandidates = useMemo(() => {
    if (!chat || !mentionState) return [];
    const q = mentionState.query.toLowerCase();
    return chat.participants
      .filter((p) => p.user?.id !== user?.id)
      .filter((p) => {
        const un = (p.user.username || p.user.email.split("@")[0] || "").toLowerCase();
        return !q || un.includes(q);
      });
  }, [chat, mentionState, user?.id]);

  useEffect(() => {
    setMentionHighlight(0);
  }, [mentionState?.start, mentionState?.query]);

  const applyMention = (participant: ChatParticipant) => {
    const ta = textAreaRef.current;
    if (!mentionState) return;
    const cursor = ta?.selectionStart ?? text.length;
    const uname =
      participant.user.username || participant.user.email.split("@")[0] || "user";
    const insert = `@${uname} `;
    const newText = text.slice(0, mentionState.start) + insert + text.slice(cursor);
    setText(newText);
    setMentionState(null);
    requestAnimationFrame(() => {
      if (!textAreaRef.current) return;
      const pos = mentionState.start + insert.length;
      textAreaRef.current.focus();
      textAreaRef.current.setSelectionRange(pos, pos);
    });
  };

  return (
    <section className="flex flex-col flex-1 min-h-0 min-w-0">
      <div className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-slate-800 flex flex-col gap-2.5 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_auto] xl:items-center xl:gap-x-3 xl:gap-y-2">
        {/* Слева: название чата + число участников; в личном чате на очень широком экране — на всю ширину строки */}
        <div
          className={`min-w-0 order-1 xl:justify-self-start xl:text-left ${
            chat?.chat_type !== "group" ? "xl:col-span-3" : ""
          }`}
        >
          <p className="text-sm font-semibold break-words [overflow-wrap:anywhere]">{title}</p>
          {chat?.chat_type === "group" && (
            <p className="text-xs text-slate-400 mt-0.5">
              Участники: {chat.participants.length}
            </p>
          )}
        </div>
        {/* По центру: проект; трёхколоночная сетка только с xl (1280px), иначе колонки на ~1028px накладываются */}
        {chat?.chat_type === "group" && chat.project_details?.name ? (
          <div className="order-2 min-w-0 flex justify-start xl:justify-center xl:px-2">
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 max-w-full truncate text-left xl:max-w-[min(100%,28rem)] xl:text-center"
              onClick={() => setShowProjectInfo(true)}
              title={chat.project_details.name}
            >
              {chat.project_details.name}
            </button>
          </div>
        ) : (
          <div className="order-2 hidden min-h-0 min-w-0 xl:block" aria-hidden />
        )}
        {/* Справа: кнопки */}
        {chat?.chat_type === "group" && (
          <div className="order-3 flex flex-wrap items-center gap-2 justify-start sm:justify-end xl:flex-nowrap xl:justify-self-end xl:justify-end w-full xl:w-auto min-w-0">
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-700 text-slate-200 hover:bg-slate-800 shrink-0"
              onClick={onOpenParticipants}
            >
              Участники
            </button>
            <button
              type="button"
              className="text-xs px-3 py-1.5 rounded-xl bg-primary hover:bg-primaryDark text-white shrink-0 text-center disabled:opacity-50"
              onClick={onOpenAddParticipants}
              disabled={!canManageParticipants}
            >
              Добавить участника
            </button>
          </div>
        )}
      </div>
      {showProjectInfo && chat?.chat_type === "group" && chat.project_details && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="glass-panel w-full max-w-lg p-5 sm:p-6 space-y-4 overflow-hidden">
            <div className="relative">
              <h2 className="text-base sm:text-lg font-semibold text-center pr-8 pl-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {chat.project_details.name}
              </h2>
              <button
                type="button"
                className="absolute right-0 top-0 h-7 w-7 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800/70"
                onClick={() => setShowProjectInfo(false)}
              >
                ✕
              </button>
            </div>
            <div className="max-h-[50vh] overflow-y-auto scrollbar-thin rounded-xl border border-slate-800 bg-slate-900/50 p-4">
              <p className="text-sm text-slate-200 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                {chat.project_details.description?.trim() || "Описание проекта не указано."}
              </p>
            </div>
          </div>
        </div>
      )}
      <div
        ref={messagesAreaRef}
        onScroll={updateScrollMetrics}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-thin bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
      >
        {!chat && (
          <div className="h-full flex items-center justify-center px-4 text-center">
            <p className="text-sm text-slate-500">
              Выберите чат в списке (на телефоне — кнопка «Чаты»), чтобы начать общение.
            </p>
          </div>
        )}
        {chat &&
          messages.filter((msg) => !msg.is_deleted).map((m) => {
            const isMine = m.sender?.id === user?.id;
            const senderParticipant = chat.participants.find(
              (p) => p.user?.id === m.sender?.id
            );
            const baseBubble =
              "max-w-[88%] sm:max-w-[78%] lg:max-w-[68%] rounded-2xl px-3 py-2 text-sm shadow-soft relative";
            const bubbleColors = m.is_deleted
              ? "bg-slate-900 text-slate-500 italic"
              : isMine
              ? "bg-primary text-white rounded-br-sm"
              : "bg-slate-800 text-slate-50 rounded-bl-sm";

            return (
              <div
                key={m.id}
                data-message-id={m.id}
                ref={(el) => {
                  messageRefs.current[m.id] = el;
                }}
                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`${baseBubble} ${bubbleColors}`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (m.is_deleted) return;
                    const rect = messagesAreaRef.current?.getBoundingClientRect();
                    const menuWidth = 192;
                    const menuHeight = isMine ? 52 : 40;
                    const minX = rect ? rect.left + 8 : 8;
                    const maxX = rect
                      ? Math.max(minX, rect.right - menuWidth - 8)
                      : Math.max(8, window.innerWidth - menuWidth - 8);
                    const minY = rect ? rect.top + 8 : 8;
                    const maxY = rect
                      ? Math.max(minY, rect.bottom - menuHeight - 8)
                      : Math.max(8, window.innerHeight - menuHeight - 8);
                    const x = Math.min(maxX, Math.max(minX, e.clientX + 6));
                    const y = Math.min(maxY, Math.max(minY, e.clientY - menuHeight - 6));
                    setContextMenu({
                      x,
                      y,
                      message: m,
                      isMine
                    });
                  }}
                >
                  {!m.is_deleted && m.sender && (
                    <div className={`mb-0.5 flex items-center gap-1 ${isMine ? "justify-end" : "justify-start"}`}>
                      <p className="text-[11px] text-slate-300">
                        {m.sender.display_name ??
                          m.sender.full_name ??
                          "Неизвестный пользователь"}
                      </p>
                      {chat.chat_type === "group" && senderParticipant?.role_title && (
                        <p className="text-[10px] text-slate-400 whitespace-nowrap">
                          {senderParticipant.role_title}
                        </p>
                      )}
                    </div>
                  )}
                  {m.reply_to_data &&
                    !m.is_deleted &&
                    m.reply_to_data.sender != null && (
                    <button
                      type="button"
                      onClick={() => scrollToMessage(m.reply_to_data?.id)}
                      className="mb-1 w-full text-left border-l-2 border-slate-500/60 pl-2 text-[11px] text-slate-200/80 hover:bg-slate-700/20 rounded-sm"
                    >
                      <span className="block font-semibold">
                        {m.reply_to_data.sender?.display_name ??
                          m.reply_to_data.sender?.full_name ??
                          "Неизвестный пользователь"}
                      </span>
                      <span className="block truncate max-w-[240px] sm:max-w-[340px]">
                        {m.reply_to_data.text}
                      </span>
                    </button>
                  )}
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                    {m.text}
                  </p>

                </div>
              </div>
            );
          })}
        {contextMenu && (
          <div
            className="fixed z-50 rounded-xl border border-slate-700 bg-slate-950/95 p-1 shadow-soft backdrop-blur-sm"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="px-2.5 py-1 rounded-full border border-slate-600/80 bg-slate-900/95 text-[11px] text-slate-100 hover:bg-slate-800 no-underline"
                onClick={() => {
                  onReplySelect(contextMenu.message);
                  setContextMenu(null);
                }}
              >
                Ответить
              </button>
              {contextMenu.isMine && (
                <button
                  type="button"
                  className="px-2.5 py-1 rounded-full border border-red-500/60 bg-red-950/70 text-[11px] text-red-200 hover:bg-red-800/70 no-underline"
                  onClick={() => {
                    onDelete(contextMenu.message);
                    setContextMenu(null);
                  }}
                >
                  Удалить
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="relative shrink-0">
        {chat && showScrollDown && (
          <button
            type="button"
            className="absolute z-30 right-3 sm:right-4 bottom-full mb-2 h-10 w-10 rounded-full border border-slate-500/70 bg-slate-900/95 text-slate-100 shadow-xl flex items-center justify-center hover:bg-slate-800 backdrop-blur-sm pointer-events-auto"
            onClick={scrollMessagesToBottom}
            aria-label="Прокрутить к последним сообщениям"
            title="Вниз"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>
        )}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-800 px-3 py-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end bg-slate-950/80"
      >
        {replyTo && (
          <div className="w-full sm:w-auto sm:max-w-[40%] sm:mr-2 rounded-xl bg-slate-900/90 border border-slate-700 px-3 py-1.5 text-[11px] text-slate-200 flex items-start gap-2 order-first">
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
              <p className="truncate max-w-[220px] sm:max-w-[320px]">{replyTo.text}</p>
            </div>
          </div>
        )}
        <div className="relative w-full min-w-0 flex-1 sm:flex-[1_1_0] flex flex-col">
          {mentionState && mentionCandidates.length > 0 && (
            <div className="absolute bottom-full left-0 right-0 mb-1 z-30 max-h-40 overflow-y-auto scrollbar-thin rounded-xl border border-slate-700 bg-slate-900 shadow-lg text-xs">
              {mentionCandidates.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 hover:bg-slate-800 ${
                    idx === mentionHighlight ? "bg-slate-800/90" : ""
                  }`}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => applyMention(p)}
                >
                  <span className="font-medium text-slate-200">
                    @{p.user.username || p.user.email.split("@")[0]}
                  </span>
                  <span className="text-slate-500 ml-2">{p.user.display_name}</span>
                </button>
              ))}
            </div>
          )}
          <textarea
            ref={textAreaRef}
            placeholder={chat ? "Напишите сообщение…" : "Выберите чат"}
            title={chat ? "Упоминание: @никнейм участника" : undefined}
            className="w-full rounded-xl bg-slate-900/80 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 resize-none min-h-10 max-h-32 overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] placeholder:text-slate-500"
            disabled={!chat}
            value={text}
            rows={1}
            onChange={(e) => {
              const val = e.target.value;
              setText(val);
              const cursor = e.target.selectionStart ?? val.length;
              const before = val.slice(0, cursor);
              const m = before.match(/@([\w.]*)$/);
              if (m && chat) {
                setMentionState({ start: cursor - m[0].length, query: m[1] });
              } else {
                setMentionState(null);
              }
            }}
            onKeyDown={(e) => {
              if (mentionState && mentionCandidates.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setMentionHighlight((h) =>
                    Math.min(h + 1, mentionCandidates.length - 1)
                  );
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setMentionHighlight((h) => Math.max(h - 1, 0));
                  return;
                }
                if (e.key === "Enter" || e.key === "Tab") {
                  e.preventDefault();
                  const pick = mentionCandidates[mentionHighlight];
                  if (pick) applyMention(pick);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setMentionState(null);
                  return;
                }
              }
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (chat && text.trim()) {
                  messageCountAtSendRef.current = messages.length;
                  pendingScrollAfterOwnSendRef.current = true;
                  onSend(text.trim());
                  setText("");
                  setMentionState(null);
                }
              }
            }}
          />
        </div>
        <button
          type="submit"
          disabled={!chat || !text.trim()}
          className="h-10 w-10 shrink-0 self-end rounded-full bg-primary flex items-center justify-center text-sm font-semibold disabled:opacity-50"
        >
          ➤
        </button>
      </form>
      </div>
    </section>
  );
};

const ProfileSidebar: React.FC<{
  currentChat: Chat | null;
  canDeleteChat: boolean;
  canCreateKanban: boolean;
  canLeaveChat: boolean;
  canManageRoles: boolean;
  onDeleteChat: () => void;
  onLeaveChat: () => void;
  onRenameChat: () => void;
  onEditProjectDetails: () => void;
  onManageRoles: () => void;
  onOpenKanban: () => void;
  onCreateKanban: () => void;
  hasKanban: boolean;
  mobile?: boolean;
}> = ({
  currentChat,
  canDeleteChat,
  canCreateKanban,
  onDeleteChat,
  onLeaveChat,
  canLeaveChat,
  canManageRoles,
  onRenameChat,
  onEditProjectDetails,
  onManageRoles,
  onOpenKanban,
  onCreateKanban,
  hasKanban,
  mobile = false
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <aside
      className={
        mobile
          ? "flex flex-col w-full border-l border-slate-800 bg-slate-950"
          : "hidden lg:flex lg:flex-col w-72 border-l border-slate-800 bg-slate-950/60"
      }
    >
      <div className="px-4 py-4 border-b border-slate-800">
        <p className="text-xs uppercase tracking-[0.16em] text-slate-500 mb-2">
          Профиль
        </p>
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => navigate("/app/settings")}
            className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center text-lg font-semibold hover:opacity-90"
            title="Настройки профиля"
          >
            {user?.display_name?.[0] ?? "U"}
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{user?.display_name}</p>
            <p className="text-xs text-slate-500 truncate">
              @{user?.username ?? user?.email?.split("@")[0] ?? "user"}
            </p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/app/settings")}
            className="shrink-0 h-9 w-9 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center justify-center"
            title="Настройки"
            aria-label="Настройки профиля"
          >
            <span className="text-lg leading-none">⚙</span>
          </button>
        </div>
      </div>
      <div className="flex-1 px-4 py-4 space-y-4 text-xs text-slate-400">
        <div className="space-y-2">
          <p className="font-semibold text-slate-300">Командные чаты</p>
          <p>
            Управляйте проектами, обсуждайте задачи и держите всю историю общения
            в одном месте.
          </p>
        </div>
        <div className="space-y-2 border border-slate-800 rounded-xl p-3">
          <p className="font-semibold text-slate-300">Управление чатом</p>
          {!currentChat && (
            <p className="text-xs text-slate-500">
              Выберите чат, чтобы увидеть действия.
            </p>
          )}
          {currentChat && (
            <div className="space-y-2">
              {currentChat.chat_type === "group" &&
                (!hasKanban
                  ? canCreateKanban && (
                      <button
                        type="button"
                        className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                        onClick={onCreateKanban}
                      >
                        Создать канбан-доску
                      </button>
                    )
                  : (
                      <button
                        type="button"
                        className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                        onClick={onOpenKanban}
                      >
                        Перейти в канбан-доску
                      </button>
                    ))}
              {currentChat.chat_type === "group" && (
                <>
                  {canManageRoles && (
                    <>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                        onClick={onRenameChat}
                      >
                        Переименовать чат
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                        onClick={onEditProjectDetails}
                      >
                        Редактировать проект
                      </button>
                      <button
                        type="button"
                        className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                        onClick={onManageRoles}
                      >
                        Управление ролями
                      </button>
                    </>
                  )}
                </>
              )}
              {canLeaveChat && (
                <button
                  type="button"
                  className="w-full rounded-xl border border-slate-700 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800 transition"
                  onClick={onLeaveChat}
                >
                  Выйти из чата
                </button>
              )}
              {canDeleteChat && (
                <button
                  type="button"
                  className="w-full rounded-xl border border-red-700/60 px-3 py-2 text-xs text-red-300 hover:bg-red-900/30 transition"
                  onClick={onDeleteChat}
                >
                  Удалить чат
                </button>
              )}
            </div>
          )}
        </div>
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

type KanbanCard = { id: string; text: string };
type KanbanBoardState = {
  todo: KanbanCard[];
  inProgress: KanbanCard[];
  done: KanbanCard[];
};

const emptyBoard: KanbanBoardState = { todo: [], inProgress: [], done: [] };

const KanbanModal: React.FC<{
  chat: Chat;
  board: KanbanBoardState;
  onChange: (next: KanbanBoardState) => Promise<void>;
  onClose: () => void;
}> = ({ chat, board, onChange, onClose }) => {
  const [text, setText] = useState("");
  const addCard = () => {
    const value = text.trim();
    if (!value) return;
    void onChange({
      ...board,
      todo: [...board.todo, { id: `${Date.now()}_${Math.random()}`, text: value }]
    });
    setText("");
  };

  const move = (from: keyof KanbanBoardState, to: keyof KanbanBoardState, id: string) => {
    const card = board[from].find((c) => c.id === id);
    if (!card) return;
    void onChange({
      ...board,
      [from]: board[from].filter((c) => c.id !== id),
      [to]: [...board[to], card]
    });
  };

  const remove = (from: keyof KanbanBoardState, id: string) => {
    void onChange({ ...board, [from]: board[from].filter((c) => c.id !== id) });
  };

  const col = (
    key: keyof KanbanBoardState,
    title: string,
    nextKey?: keyof KanbanBoardState
  ) => (
    <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 min-h-[200px]">
      <p className="text-xs uppercase tracking-[0.14em] text-slate-400 mb-2">{title}</p>
      <div className="space-y-2">
        {board[key].map((c) => (
          <div key={c.id} className="rounded-lg bg-slate-800 px-2 py-2 text-xs">
            <p className="break-words [overflow-wrap:anywhere]">{c.text}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {nextKey && (
                <button
                  type="button"
                  className="rounded-md border border-slate-600 px-2 py-1 text-[11px] hover:bg-slate-700/80"
                  onClick={() => move(key, nextKey, c.id)}
                >
                  Вперёд
                </button>
              )}
              <button
                type="button"
                className="rounded-md border border-red-700/60 px-2 py-1 text-[11px] text-red-300 hover:bg-red-950/50"
                onClick={() => remove(key, c.id)}
              >
                Удалить
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-3 sm:px-4 py-4">
      <div className="glass-panel w-full max-w-5xl max-h-[min(92vh,900px)] flex flex-col min-h-0 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2 shrink-0">
          <h2 className="text-lg font-semibold truncate min-w-0">
            Канбан: {chat.name || `Чат ${chat.id}`}
          </h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-100 shrink-0"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 shrink-0 mt-3">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Новая задача..."
            className="flex-1 min-w-0 rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm"
          />
          <button
            type="button"
            className="rounded-xl bg-primary hover:bg-primaryDark px-3 py-2 text-sm shrink-0"
            onClick={addCard}
          >
            Добавить
          </button>
        </div>
        <div className="flex-1 min-h-0 mt-4 overflow-y-auto overflow-x-auto scrollbar-thin [scrollbar-color:rgba(148,163,184,0.45)_rgba(15,23,42,0.6)]">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0 pb-1">
            {col("todo", "К выполнению", "inProgress")}
            {col("inProgress", "В работе", "done")}
            {col("done", "Готово")}
          </div>
        </div>
      </div>
    </div>
  );
};

const RenameChatModal: React.FC<{
  initialName: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}> = ({ initialName, onClose, onSubmit }) => {
  const [name, setName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="glass-panel w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Переименовать чат</h2>
          <button type="button" className="text-slate-400 hover:text-slate-100" onClick={onClose}>
            ✕
          </button>
        </div>
        <input
          className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Новое название чата"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-2 text-sm rounded-xl border border-slate-700" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm rounded-xl bg-primary hover:bg-primaryDark disabled:opacity-60"
            disabled={saving || !name.trim()}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onSubmit(name.trim());
                onClose();
              } catch (e) {
                setError(extractApiErrorMessage(e, "Не удалось переименовать чат."));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
};

const EditProjectModal: React.FC<{
  initialName: string;
  initialDescription: string;
  onClose: () => void;
  onSubmit: (payload: {
    project_name: string;
    project_description: string;
  }) => Promise<void>;
}> = ({ initialName, initialDescription, onClose, onSubmit }) => {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="glass-panel w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Редактировать проект</h2>
          <button type="button" className="text-slate-400 hover:text-slate-100" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-300" htmlFor="projectEditName">
            Название проекта
          </label>
          <input
            id="projectEditName"
            className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название проекта"
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-slate-300" htmlFor="projectEditDescription">
            Описание проекта
          </label>
          <textarea
            id="projectEditDescription"
            rows={4}
            className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm resize-none max-h-40 overflow-y-auto scrollbar-thin whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Описание проекта"
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="px-3 py-2 text-sm rounded-xl border border-slate-700" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm rounded-xl bg-primary hover:bg-primaryDark disabled:opacity-60"
            disabled={saving || !name.trim()}
            onClick={async () => {
              setSaving(true);
              setError(null);
              try {
                await onSubmit({
                  project_name: name.trim(),
                  project_description: description.trim()
                });
                onClose();
              } catch (e) {
                setError(extractApiErrorMessage(e, "Не удалось обновить проект."));
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </div>
      </div>
    </div>
  );
};

const RoleManagerModal: React.FC<{
  chat: Chat;
  onClose: () => void;
  onSave: (
    userId: number,
    payload: { is_admin?: boolean; role_title?: string }
  ) => Promise<void>;
}> = ({ chat, onClose, onSave }) => {
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="glass-panel w-full max-w-2xl p-6 space-y-4 max-h-[82vh] overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Управление ролями</h2>
          <button type="button" className="text-slate-400 hover:text-slate-100" onClick={onClose}>
            ✕
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="space-y-2 overflow-y-auto max-h-[60vh] pr-1 scrollbar-thin">
          {chat.participants.map((p) => (
            <RoleRow key={p.id} participant={p} onSave={onSave} onError={setError} />
          ))}
        </div>
      </div>
    </div>
  );
};

const RoleRow: React.FC<{
  participant: ChatParticipant;
  onSave: (
    userId: number,
    payload: { is_admin?: boolean; role_title?: string }
  ) => Promise<void>;
  onError: (v: string | null) => void;
}> = ({ participant, onSave, onError }) => {
  const [roleTitle, setRoleTitle] = useState(participant.role_title ?? "");
  const [isAdmin, setIsAdmin] = useState(Boolean(participant.is_admin));
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm truncate">{participant.user?.email}</p>
          <p className="text-xs text-slate-400 truncate">
            {[participant.user?.first_name, participant.user?.last_name].filter(Boolean).join(" ")}
          </p>
        </div>
        <label className="text-xs flex items-center gap-2">
          <input
            type="checkbox"
            checked={isAdmin}
            onChange={(e) => setIsAdmin(e.target.checked)}
          />
          Админ
        </label>
      </div>
      <div className="flex items-center gap-2">
        <input
          className="flex-1 rounded-lg bg-slate-900 border border-slate-700 px-2 py-1.5 text-xs"
          value={roleTitle}
          onChange={(e) => setRoleTitle(e.target.value)}
          placeholder="Роль (например, Дизайнер)"
        />
        <button
          type="button"
          className="rounded-lg border border-slate-700 px-2 py-1.5 text-xs hover:bg-slate-800 disabled:opacity-60"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            onError(null);
            try {
              await onSave(participant.user.id, {
                is_admin: isAdmin,
                role_title: roleTitle
              });
            } catch (e) {
              onError(extractApiErrorMessage(e, "Не удалось сохранить роль."));
            } finally {
              setSaving(false);
            }
          }}
        >
          Сохранить
        </button>
      </div>
    </div>
  );
};

const MessengerShell: React.FC = () => {
  const { accessToken, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChatId, setCurrentChatId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showCreateChat, setShowCreateChat] = useState(false);
  const [showMobileChats, setShowMobileChats] = useState(false);
  const [showMobileManage, setShowMobileManage] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userSuggestions, setUserSuggestions] =
    useState<UserProfileForSearch[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showAddParticipants, setShowAddParticipants] = useState(false);
  const [showKanban, setShowKanban] = useState(false);
  const [showRenameChat, setShowRenameChat] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [showDeleteChatConfirm, setShowDeleteChatConfirm] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const [deleteChatError, setDeleteChatError] = useState<string | null>(null);
  const [kanbanBoard, setKanbanBoard] = useState<KanbanBoardState | null>(null);

  const currentChat = useMemo(
    () => chats.find((c) => c.id === currentChatId) ?? null,
    [chats, currentChatId]
  );

  const visibleChats = useMemo(() => {
    const baseChats = chats.filter(
      (c) => c.chat_type === "group" || c.last_message !== null
    );
    const query = userSearch.trim().toLowerCase();
    if (!query) return baseChats;

    return baseChats.filter((chat) => {
      if (chat.chat_type !== "group") return true;
      const groupTitle = (
        chat.name ||
        chat.project_details?.name ||
        chat.participants
          .map((p) => p.user?.display_name ?? p.user?.full_name ?? "")
          .filter((name) => name.length > 0)
          .join(", ")
      )
        .trim()
        .toLowerCase();
      return groupTitle.includes(query);
    });
  }, [chats, userSearch]);

  const currentParticipant = useMemo(
    () =>
      currentChat?.participants.find((p) => p.user?.id === user?.id) ?? null,
    [currentChat, user?.id]
  );

  const canManageParticipants = Boolean(
    currentChat?.chat_type === "group" && currentParticipant?.is_admin
  );
  const adminsCount = currentChat
    ? currentChat.participants.filter((p) => p.is_admin).length
    : 0;
  const canLeaveChat = Boolean(
    currentChat &&
      currentChat.chat_type === "group" &&
      currentChat.participants.length > 1
  );
  const canManageRoles = canManageParticipants;

  const hasKanban = Boolean(currentChat?.has_kanban);

  const fetchChats = useCallback(async () => {
    if (!accessToken) return;
    const resp = await axios.get<Chat[]>("/api/chats/chats/", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    setChats(resp.data);
  }, [accessToken]);

  const markReadUpTo = useCallback(
    async (messageId: number) => {
      if (!accessToken || !currentChatId) return;
      try {
        await axios.post(
          `/api/chats/chats/${currentChatId}/mark_read/`,
          { message_id: messageId },
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        await fetchChats();
      } catch (e) {
        console.error(e);
      }
    },
    [accessToken, currentChatId, fetchChats]
  );

  // Fetch chats once
  useEffect(() => {
    void fetchChats().catch(console.error);
  }, [fetchChats]);

  useEffect(() => {
    if (!accessToken || !currentChat || currentChat.chat_type !== "group") {
      setKanbanBoard(null);
      return;
    }
    const run = async () => {
      try {
        const resp = await axios.get<{ data: KanbanBoardState }>(
          `/api/chats/chats/${currentChat.id}/kanban/`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        setKanbanBoard(resp.data.data);
      } catch {
        setKanbanBoard(null);
      }
    };
    void run();
  }, [accessToken, currentChat?.id, currentChat?.chat_type, currentChat?.has_kanban]);

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
          reply_to_data?: Message["reply_to_data"];
          data?: KanbanBoardState;
        };
        if (data.type === "kanban_board_updated" && data.data) {
          setKanbanBoard(data.data);
        }
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
            },
            reply_to_data: data.reply_to_data ?? null
          };
          setMessages((prev) =>
            [...prev.filter((m) => m.id !== incoming.id), incoming].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            )
          );
          void axios
            .post(
              `/api/chats/chats/${currentChatId}/mark_read/`,
              { message_id: incoming.id },
              { headers: { Authorization: `Bearer ${accessToken}` } }
            )
            .then(() => fetchChats())
            .catch(console.error);
        }
        if (data.type === "message_deleted" && data.message_id) {
          setMessages((prev) => prev.filter((m) => m.id !== data.message_id));
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => {
      socket.close();
    };
  }, [accessToken, currentChatId, fetchChats, setKanbanBoard]);

  // Personal notifications for real-time chat list updates
  useEffect(() => {
    if (!accessToken) return;
    const url = new URL("/ws/user/", window.location.origin);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.searchParams.set("token", accessToken);
    const socket = new WebSocket(url.toString());

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as {
          type: string;
          chat_id?: number;
          kanban_data?: KanbanBoardState;
          user?: {
            id: number;
            email: string;
            username?: string;
            first_name?: string;
            last_name?: string;
            full_name: string;
            display_name: string;
          };
        };
        if (data.type === "user_profile_updated_notification" && data.user) {
          const u = data.user;
          if (u.id === user?.id) {
            void refreshProfile();
          }
          void fetchChats().catch(console.error);
          setMessages((prev) =>
            prev.map((m) => {
              const next = { ...m };
              if (m.sender.id === u.id) {
                next.sender = {
                  ...m.sender,
                  full_name: u.full_name,
                  display_name: u.display_name
                };
              }
              if (m.reply_to_data?.sender?.id === u.id) {
                next.reply_to_data = {
                  ...m.reply_to_data,
                  sender: {
                    ...m.reply_to_data.sender,
                    full_name: u.full_name,
                    display_name: u.display_name
                  }
                };
              }
              return next;
            })
          );
          return;
        }
        if (
          data.type === "new_message_notification" ||
          data.type === "chat_created_notification" ||
          data.type === "chat_participants_updated_notification" ||
          data.type === "chat_kanban_updated_notification" ||
          data.type === "chat_unread_updated_notification" ||
          data.type === "chat_mention_notification"
        ) {
          void fetchChats().catch(console.error);
          if (data.type === "chat_kanban_updated_notification" && currentChatId && data.chat_id === currentChatId) {
            if (data.kanban_data && typeof data.kanban_data === "object") {
              setKanbanBoard(data.kanban_data);
            } else {
              void axios
                .get<{ data: KanbanBoardState }>(`/api/chats/chats/${currentChatId}/kanban/`, {
                  headers: { Authorization: `Bearer ${accessToken}` }
                })
                .then((resp) => setKanbanBoard(resp.data.data))
                .catch(() => setKanbanBoard(null));
            }
          }
          if (
            data.type === "new_message_notification" &&
            currentChatId &&
            data.chat_id === currentChatId
          ) {
            void axios
              .get<Message[]>(`/api/chats/messages/?chat_id=${currentChatId}`, {
                headers: { Authorization: `Bearer ${accessToken}` }
              })
              .then((resp) =>
                setMessages(
                  resp.data
                    .slice()
                    .sort(
                      (a, b) =>
                        new Date(a.created_at).getTime() -
                        new Date(b.created_at).getTime()
                    )
                )
              )
              .catch(console.error);
          }
        }
        if (data.type === "chat_deleted_notification") {
          void fetchChats().catch(console.error);
          if (currentChatId && data.chat_id === currentChatId) {
            setCurrentChatId(null);
            setMessages([]);
            setReplyTo(null);
            setShowParticipants(false);
            setShowAddParticipants(false);
            setShowKanban(false);
            setShowEditProject(false);
            setKanbanBoard(null);
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    return () => socket.close();
  }, [accessToken, currentChatId, fetchChats, user?.id, refreshProfile]);

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
      await axios.post<Message>(
        "/api/chats/messages/",
        { chat: currentChatId, text, reply_to: replyTo ? replyTo.id : null },
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
      setReplyTo(null);
    } catch (e) {
      console.error(e);
      // даже если бэк ответил 500 при нотификации, не ломаем UI
    }
  };

  const handleDeleteMessage = async (message: Message) => {
    if (!accessToken) return;
    try {
      await axios.post(
        `/api/chats/messages/${message.id}/mark_as_deleted/`,
        {},
        {
          headers: { Authorization: `Bearer ${accessToken}` }
        }
      );
    } catch (e) {
      const err = e as { response?: { status?: number } };
      if (err.response?.status !== 404) {
        console.error(e);
        return;
      }
    }
    setMessages((prev) => prev.filter((m) => m.id !== message.id));
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
    await fetchChats();
    setCurrentChatId(resp.data.id);
    setShowCreateChat(false);
  };

  const handleDeleteCurrentChat = async () => {
    if (!accessToken || !currentChat || deletingChat) return;
    setDeletingChat(true);
    setDeleteChatError(null);
    try {
      if (currentChat.chat_type === "private") {
        try {
          await axios.post(
            `/api/chats/chats/${currentChat.id}/delete_for_me/`,
            {},
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
        } catch {
          // fallback: если endpoint временно недоступен, удаляем чат полностью
          await axios.delete(`/api/chats/chats/${currentChat.id}/`, {
            headers: { Authorization: `Bearer ${accessToken}` }
          });
        }
      } else {
        await axios.delete(`/api/chats/chats/${currentChat.id}/`, {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
      }
      setCurrentChatId(null);
      setMessages([]);
      setReplyTo(null);
      setShowParticipants(false);
      setShowAddParticipants(false);
      setShowKanban(false);
      setShowEditProject(false);
      setKanbanBoard(null);
      setShowDeleteChatConfirm(false);
      await fetchChats();
    } catch (e) {
      console.error(e);
      setDeleteChatError("Не удалось удалить чат. Попробуйте ещё раз.");
    } finally {
      setDeletingChat(false);
    }
  };

  const handleLeaveCurrentChat = async () => {
    if (!accessToken || !currentChat) return;
    if (
      currentChat.chat_type === "group" &&
      currentParticipant?.is_admin &&
      adminsCount <= 1
    ) {
      alert(
        "Вы являетесь администратором. Чтобы выйти, назначьте другого участника администратором или удалите группу."
      );
      return;
    }
    try {
      await axios.post(
        `/api/chats/chats/${currentChat.id}/leave_chat/`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setCurrentChatId(null);
      setMessages([]);
      setReplyTo(null);
      setShowParticipants(false);
      setShowAddParticipants(false);
      setShowKanban(false);
      setShowEditProject(false);
      setKanbanBoard(null);
      await fetchChats();
    } catch (e) {
      alert(extractApiErrorMessage(e, "Не удалось выйти из чата."));
    }
  };

  const handleRenameChat = async (name: string) => {
    if (!accessToken || !currentChat) return;
    await axios.post(
      `/api/chats/chats/${currentChat.id}/rename_chat/`,
      { name },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    await fetchChats();
  };

  const handleUpdateParticipantRole = async (
    userId: number,
    payload: { is_admin?: boolean; role_title?: string }
  ) => {
    if (!accessToken || !currentChat) return;
    await axios.post(
      `/api/chats/chats/${currentChat.id}/update_participant_role/`,
      { user_id: userId, ...payload },
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    await fetchChats();
  };

  const handleUpdateProjectDetails = async (payload: {
    project_name: string;
    project_description: string;
  }) => {
    if (!accessToken || !currentChat) return;
    await axios.post(
      `/api/chats/chats/${currentChat.id}/update_project_details/`,
      payload,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    await fetchChats();
  };

  const createKanbanForCurrentChat = async () => {
    if (!currentChat || !accessToken) return;
    try {
      const resp = await axios.post<{ data: KanbanBoardState }>(
        `/api/chats/chats/${currentChat.id}/create_kanban/`,
        {},
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      setKanbanBoard(resp.data.data || emptyBoard);
      await fetchChats();
      setShowKanban(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 flex flex-col">
      <header className="lg:hidden px-3 py-3 border-b border-slate-800 flex items-center justify-between gap-2 max-[325px]:flex-col max-[325px]:items-stretch">
        <p className="font-semibold shrink-0">Teamon</p>
        <div className="flex items-center gap-2 min-w-0 max-[325px]:flex-col max-[325px]:items-stretch max-[325px]:w-full">
          <button
            className="text-xs px-3 py-1.5 rounded-full border border-slate-700 max-[325px]:w-full max-[325px]:text-center"
            onClick={() => {
              setShowMobileManage(false);
              setShowMobileChats((v) => !v);
            }}
          >
            Чаты
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-full border border-slate-700 max-[325px]:w-full max-[325px]:text-center"
            onClick={() => {
              setShowMobileChats(false);
              setShowMobileManage((v) => !v);
            }}
          >
            Управление
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-full border border-slate-700 max-[325px]:w-full max-[325px]:text-center"
            onClick={() => {
              setShowMobileChats(false);
              setShowMobileManage(false);
              navigate("/app/settings");
            }}
          >
            Настройки
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded-full border border-slate-700 max-[325px]:w-full max-[325px]:text-center"
            onClick={() => navigate("/auth/login")}
          >
            Сменить аккаунт
          </button>
        </div>
      </header>
      <main className="flex-1 flex flex-col lg:flex-row max-h-[calc(100vh-3.25rem)] lg:max-h-screen min-h-0">
        <ChatsSidebar
          chats={visibleChats}
          currentUserId={user?.id}
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
              setShowMobileChats(false);
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
          onOpenAddParticipants={() => {
            if (canManageParticipants) setShowAddParticipants(true);
          }}
          canManageParticipants={canManageParticipants}
          onMarkReadUpTo={(id) => {
            void markReadUpTo(id);
          }}
        />
        <ProfileSidebar
          currentChat={currentChat}
          canDeleteChat={Boolean(
            currentChat &&
              (currentChat.chat_type === "private" || canManageParticipants)
          )}
          canCreateKanban={canManageParticipants}
          canManageRoles={canManageRoles}
          canLeaveChat={canLeaveChat}
          onDeleteChat={() => setShowDeleteChatConfirm(true)}
          onLeaveChat={() => void handleLeaveCurrentChat()}
          onRenameChat={() => setShowRenameChat(true)}
          onEditProjectDetails={() => setShowEditProject(true)}
          onManageRoles={() => setShowRoleManager(true)}
          hasKanban={hasKanban}
          onCreateKanban={() => void createKanbanForCurrentChat()}
          onOpenKanban={() => setShowKanban(true)}
        />
      </main>
      {showMobileChats && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-950 border-t border-slate-800 overflow-y-auto">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <p className="text-sm font-semibold">Чаты и поиск</p>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-100"
              onClick={() => setShowMobileChats(false)}
            >
              ✕
            </button>
          </div>
          <ChatsSidebar
            mobile
            onAfterSelect={() => setShowMobileChats(false)}
            chats={visibleChats}
            currentUserId={user?.id}
            currentChatId={currentChatId}
            onSelect={setCurrentChatId}
            onCreateGroupChat={() => {
              setShowCreateChat(true);
              setShowMobileChats(false);
            }}
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
              setTimeout(() => setSuggestionsOpen(false), 120);
            }}
            onSuggestionClick={async (selectedUser) => {
              if (!accessToken) return;
              try {
                const resp = await axios.post<Chat>(
                  "/api/chats/chats/",
                  { chat_type: "private", other_user_id: selectedUser.id },
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
                setShowMobileChats(false);
              } catch (e) {
                console.error(e);
              }
            }}
          />
        </div>
      )}
      {showMobileManage && (
        <div className="fixed inset-0 z-50 lg:hidden bg-slate-950 border-t border-slate-800 overflow-y-auto">
          <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
            <p className="text-sm font-semibold">Управление</p>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-100"
              onClick={() => setShowMobileManage(false)}
            >
              ✕
            </button>
          </div>
          <ProfileSidebar
            mobile
            currentChat={currentChat}
            canDeleteChat={Boolean(
              currentChat &&
                (currentChat.chat_type === "private" || canManageParticipants)
            )}
            canCreateKanban={canManageParticipants}
            canManageRoles={canManageRoles}
            canLeaveChat={canLeaveChat}
            onDeleteChat={() => {
              setShowDeleteChatConfirm(true);
              setShowMobileManage(false);
            }}
            onLeaveChat={() => {
              void handleLeaveCurrentChat();
              setShowMobileManage(false);
            }}
            onRenameChat={() => {
              setShowRenameChat(true);
              setShowMobileManage(false);
            }}
            onEditProjectDetails={() => {
              setShowEditProject(true);
              setShowMobileManage(false);
            }}
            onManageRoles={() => {
              setShowRoleManager(true);
              setShowMobileManage(false);
            }}
            hasKanban={hasKanban}
            onCreateKanban={() => {
              void createKanbanForCurrentChat();
              setShowMobileManage(false);
            }}
            onOpenKanban={() => {
              setShowKanban(true);
              setShowMobileManage(false);
            }}
          />
        </div>
      )}
      {showRenameChat && currentChat && (
        <RenameChatModal
          initialName={currentChat.name ?? ""}
          onClose={() => setShowRenameChat(false)}
          onSubmit={handleRenameChat}
        />
      )}
      {showRoleManager && currentChat && (
        <RoleManagerModal
          chat={currentChat}
          onClose={() => setShowRoleManager(false)}
          onSave={handleUpdateParticipantRole}
        />
      )}
      {showEditProject && currentChat && (
        <EditProjectModal
          initialName={currentChat.project_details?.name ?? ""}
          initialDescription={currentChat.project_details?.description ?? ""}
          onClose={() => setShowEditProject(false)}
          onSubmit={handleUpdateProjectDetails}
        />
      )}
      {showCreateChat && (
        <CreateChatModal
          accessToken={accessToken}
          onClose={() => setShowCreateChat(false)}
          onSubmit={handleCreateChat}
        />
      )}
      {showParticipants && currentChat && accessToken && (
        <ParticipantsModal
          chat={currentChat}
          accessToken={accessToken}
          canManageParticipants={canManageParticipants}
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
      {showKanban && currentChat && kanbanBoard && (
        <KanbanModal
          chat={currentChat}
          board={kanbanBoard}
          onClose={() => setShowKanban(false)}
          onChange={async (next) => {
            if (!accessToken) return;
            setKanbanBoard(next);
            try {
              await axios.put(
                `/api/chats/chats/${currentChat.id}/kanban/`,
                { data: next },
                { headers: { Authorization: `Bearer ${accessToken}` } }
              );
            } catch (e) {
              console.error(e);
            }
          }}
        />
      )}
      {showAddParticipants && currentChat && accessToken && (
        <AddParticipantModal
          chat={currentChat}
          accessToken={accessToken}
          onClose={() => setShowAddParticipants(false)}
          onParticipantsChange={(participants: ChatParticipant[]) => {
            setChats((prev) =>
              prev.map((c) =>
                c.id === currentChat.id ? { ...c, participants } : c
              )
            );
          }}
        />
      )}
      {showDeleteChatConfirm && currentChat && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="glass-panel w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Удаление чата</h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-100"
                onClick={() => setShowDeleteChatConfirm(false)}
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-slate-300">
              Удалить чат? Это действие необратимо.
            </p>
            {deleteChatError && (
              <p className="text-sm text-red-400">{deleteChatError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-sm rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800"
                disabled={deletingChat}
                onClick={() => setShowDeleteChatConfirm(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="px-4 py-2 text-sm rounded-xl bg-red-700 hover:bg-red-800 text-white disabled:opacity-60"
                disabled={deletingChat}
                onClick={() => void handleDeleteCurrentChat()}
              >
                {deletingChat ? "Удаляем..." : "Удалить чат"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

type AddParticipantModalProps = {
  chat: Chat;
  accessToken: string;
  onClose: () => void;
  onParticipantsChange: (participants: ChatParticipant[]) => void;
};

const AddParticipantModal: React.FC<AddParticipantModalProps> = ({
  chat,
  accessToken,
  onClose,
  onParticipantsChange
}) => {
  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<UserProfileForSearch[]>([]);
  const [open, setOpen] = useState(false);
  const [highlightedSuggestionIdx, setHighlightedSuggestionIdx] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHighlightedSuggestionIdx(0);
  }, [suggestions, open]);

  useEffect(() => {
    if (!accessToken || search.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    void axios
      .get<UserProfileForSearch[]>(
        `/api/auth/users/search/?email=${encodeURIComponent(search.trim())}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal
        }
      )
      .then((resp) =>
        setSuggestions(
          resp.data.filter(
            (candidate) =>
              !chat.participants.some((p) => p.user?.id === candidate.id)
          )
        )
      )
      .catch((e) => {
        if ((e as Error).name !== "CanceledError") {
          console.error(e);
        }
      });
    return () => controller.abort();
  }, [accessToken, search, chat.participants]);

  const handleAdd = async (user: UserProfileForSearch) => {
    setError(null);
    try {
      const resp = await axios.post<ChatParticipant>(
        `/api/chats/chats/${chat.id}/add_participant/`,
        { user_id: user.id },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      onParticipantsChange([...chat.participants, resp.data]);
      setSearch("");
      setSuggestions([]);
    } catch (e) {
      console.error(e);
      setError(extractApiErrorMessage(e, "Не удалось добавить участника."));
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="glass-panel w-full max-w-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Добавить участника</h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="relative">
          <input
            placeholder="Найти пользователя по email..."
            className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setOpen(true);
            }}
            onFocus={() => {
              if (search.trim().length >= 2) {
                setOpen(true);
              }
            }}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={(e) => {
              if (!open || suggestions.length === 0) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setHighlightedSuggestionIdx((prev) =>
                  Math.min(prev + 1, suggestions.length - 1)
                );
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setHighlightedSuggestionIdx((prev) => Math.max(prev - 1, 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                void handleAdd(suggestions[highlightedSuggestionIdx]);
              }
            }}
          />
          {open && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-11 z-20 max-h-56 overflow-y-auto scrollbar-thin rounded-xl bg-slate-900 border border-slate-700 shadow-soft text-xs">
              {suggestions.map((u, idx) => (
                <button
                  key={u.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 hover:bg-slate-800 ${
                    idx === highlightedSuggestionIdx ? "bg-slate-800/80" : ""
                  }`}
                  onClick={() => void handleAdd(u)}
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
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
};

type CreateChatModalProps = {
  accessToken: string | null;
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
  accessToken,
  onClose,
  onSubmit
}) => {
  const [name, setName] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [participantSuggestions, setParticipantSuggestions] = useState<
    UserProfileForSearch[]
  >([]);
  const [selectedParticipants, setSelectedParticipants] = useState<
    UserProfileForSearch[]
  >([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [highlightedSuggestionIdx, setHighlightedSuggestionIdx] = useState(0);
  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || participantSearch.trim().length < 2) {
      setParticipantSuggestions([]);
      return;
    }
    const controller = new AbortController();
    void axios
      .get<UserProfileForSearch[]>(
        `/api/auth/users/search/?email=${encodeURIComponent(
          participantSearch.trim()
        )}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal
        }
      )
      .then((resp) =>
        setParticipantSuggestions(
          resp.data.filter(
            (candidate) =>
              !selectedParticipants.some((sel) => sel.id === candidate.id)
          )
        )
      )
      .catch((e) => {
        if ((e as Error).name !== "CanceledError") {
          console.error(e);
        }
      });
    return () => controller.abort();
  }, [accessToken, participantSearch, selectedParticipants]);

  useEffect(() => {
    setHighlightedSuggestionIdx(0);
  }, [participantSuggestions, suggestionsOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        chatType: "group",
        name: name || undefined,
        participantIds: selectedParticipants.map((u) => u.id),
        projectName: projectName || undefined,
        projectDescription: projectDescription || undefined
      });
    } catch (err) {
      console.error(err);
      setError(extractApiErrorMessage(err, "Не удалось создать чат."));
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
                <label className="text-xs text-slate-300" htmlFor="participantSearch">
                  Участники
                </label>
                <div className="relative">
                  <input
                    id="participantSearch"
                    type="text"
                    placeholder="Найти пользователя по email..."
                    className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={participantSearch}
                    onChange={(e) => {
                      setParticipantSearch(e.target.value);
                      setSuggestionsOpen(true);
                    }}
                    onFocus={() => {
                      if (participantSearch.trim().length >= 2) {
                        setSuggestionsOpen(true);
                      }
                    }}
                    onBlur={() => {
                      setTimeout(() => setSuggestionsOpen(false), 120);
                    }}
                    onKeyDown={(e) => {
                      if (!suggestionsOpen || participantSuggestions.length === 0) {
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setHighlightedSuggestionIdx((prev) =>
                          Math.min(prev + 1, participantSuggestions.length - 1)
                        );
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setHighlightedSuggestionIdx((prev) => Math.max(prev - 1, 0));
                      } else if (e.key === "Enter") {
                        e.preventDefault();
                        const u = participantSuggestions[highlightedSuggestionIdx];
                        if (!u) return;
                        setSelectedParticipants((prev) =>
                          prev.some((item) => item.id === u.id) ? prev : [...prev, u]
                        );
                        setParticipantSearch("");
                        setSuggestionsOpen(false);
                      }
                    }}
                  />
                  {suggestionsOpen && participantSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-11 z-20 max-h-56 overflow-y-auto scrollbar-thin rounded-xl bg-slate-900 border border-slate-700 shadow-soft text-xs">
                      {participantSuggestions.map((u, idx) => (
                        <button
                          key={u.id}
                          type="button"
                          className={`w-full text-left px-3 py-2 hover:bg-slate-800 ${
                            idx === highlightedSuggestionIdx ? "bg-slate-800/80" : ""
                          }`}
                          onClick={() => {
                            setSelectedParticipants((prev) =>
                              prev.some((item) => item.id === u.id)
                                ? prev
                                : [...prev, u]
                            );
                            setParticipantSearch("");
                            setSuggestionsOpen(false);
                          }}
                        >
                          <p className="font-medium">{u.email}</p>
                          {(u.first_name || u.last_name) && (
                            <p className="text-slate-400">
                              {[u.first_name, u.last_name]
                                .filter(Boolean)
                                .join(" ")}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="max-h-[216px] overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                  {selectedParticipants.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-sm truncate">{u.email}</p>
                        {(u.first_name || u.last_name) && (
                          <p className="text-xs text-slate-400 truncate">
                            {[u.first_name, u.last_name].filter(Boolean).join(" ")}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        className="text-xs px-2 py-1 rounded-lg border border-slate-700 hover:bg-slate-800"
                        onClick={() =>
                          setSelectedParticipants((prev) =>
                            prev.filter((item) => item.id !== u.id)
                          )
                        }
                      >
                        Убрать
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-1">
                <label
                  className="text-xs text-slate-300"
                  htmlFor="projectName"
                >
                  Название проекта (опционально)
                </label>
                <textarea
                  id="projectName"
                  rows={1}
                  className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none max-h-20 overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] scrollbar-thin"
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
                  className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none max-h-36 overflow-y-auto whitespace-pre-wrap break-words [overflow-wrap:anywhere] scrollbar-thin"
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
      <Route path="settings" element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="chats" replace />} />
    </Routes>
  );
};

export default MessengerLayout;

