import React, { useState } from "react";
import axios from "axios";
import { Chat, ChatParticipant } from "./types";
import { useAuth } from "../auth/AuthContext";

type Props = {
  chat: Chat;
  onClose: () => void;
  accessToken: string;
  onParticipantsChange: (participants: ChatParticipant[]) => void;
  canManageParticipants: boolean;
};

export const ParticipantsModal: React.FC<Props> = ({
  chat,
  onClose,
  accessToken,
  onParticipantsChange,
  canManageParticipants
}) => {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);

  const handleRemove = async (participant: ChatParticipant) => {
    try {
      await axios.post(
        `/api/chats/chats/${chat.id}/remove_participant/`,
        { user_id: participant.user.id },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const updated = chat.participants.filter((p) => p.id !== participant.id);
      onParticipantsChange(updated);
    } catch (e) {
      console.error(e);
      setError("Не удалось удалить участника.");
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
      <div className="glass-panel w-full max-w-xl p-6 space-y-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Участники чата</h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-100"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="space-y-2 text-sm">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Текущие участники
          </p>
          <div className="space-y-1 overflow-y-auto scrollbar-thin max-h-[52vh] pr-1">
            {chat.participants.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 gap-2"
              >
                <div className="min-w-0">
                  <p className="text-sm truncate">
                    {p.user?.email ?? "Неизвестный пользователь"}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {[p.user?.first_name, p.user?.last_name]
                      .filter(Boolean)
                      .join(" ") || p.user?.display_name || ""}
                  </p>
                </div>
                <div className="text-[10px] text-slate-300 whitespace-nowrap mr-1">
                  {p.is_admin ? "Администратор" : p.role_title || "Участник"}
                </div>
                {canManageParticipants && p.user?.id !== user?.id && (
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded-lg border border-slate-700 hover:bg-slate-800"
                    onClick={() => handleRemove(p)}
                  >
                    Удалить
                  </button>
                )}
              </div>
            ))}
            {chat.participants.length === 0 && (
              <p className="text-xs text-slate-500">
                В этом чате пока нет участников.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

