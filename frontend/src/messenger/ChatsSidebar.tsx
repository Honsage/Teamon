import React from "react";
import { Chat, UserProfileForSearch } from "./types";

type Props = {
  chats: Chat[];
  currentChatId: number | null;
  onSelect: (id: number) => void;
  onCreateGroupChat: () => void;
  userSearch: string;
  onUserSearchChange: (value: string) => void;
  suggestions: UserProfileForSearch[];
  suggestionsOpen: boolean;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
  onSuggestionClick: (user: UserProfileForSearch) => void;
};

export const ChatsSidebar: React.FC<Props> = ({
  chats,
  currentChatId,
  onSelect,
  onCreateGroupChat,
  userSearch,
  onUserSearchChange,
  suggestions,
  suggestionsOpen,
  onSearchFocus,
  onSearchBlur,
  onSuggestionClick
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
            chat.participants.map((p) => p.user.display_name).join(", ");
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

