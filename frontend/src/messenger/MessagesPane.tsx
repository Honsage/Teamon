import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Chat, Message } from "./types";

type Props = {
  chat: Chat | null;
  messages: Message[];
  replyTo: Message | null;
  onSend: (text: string) => void;
  onReplySelect: (message: Message) => void;
  onClearReply: () => void;
  onDelete: (message: Message) => void;
  onOpenParticipants: () => void;
};

export const MessagesPane: React.FC<Props> = ({
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
                  {m.reply_to_data && !m.is_deleted && m.reply_to_data.sender && (
                    <div className="mb-1 border-l-2 border-slate-500/60 pl-2 text-[11px] text-slate-200/80">
                      <span className="block font-semibold">
                        {m.reply_to_data.sender.display_name ??
                          m.reply_to_data.sender.full_name ??
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
                  {replyTo.sender.display_name}
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

