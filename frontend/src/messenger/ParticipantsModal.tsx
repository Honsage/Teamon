import React, { useEffect, useState } from "react";
import axios from "axios";
import { AvailableUser, Chat, ChatParticipant } from "./types";

type Props = {
  chat: Chat;
  onClose: () => void;
  accessToken: string;
  onParticipantsChange: (participants: ChatParticipant[]) => void;
};

export const ParticipantsModal: React.FC<Props> = ({
  chat,
  onClose,
  accessToken,
  onParticipantsChange
}) => {
  const [available, setAvailable] = useState<AvailableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const resp = await axios.get<AvailableUser[]>(
          `/api/chats/chats/${chat.id}/available_users/`,
          {
            headers: { Authorization: `Bearer ${accessToken}` }
          }
        );
        setAvailable(resp.data);
      } catch (e: unknown) {
        // если эндпоинта нет (например, для личного чата), просто показываем пустой список
        const err = e as { response?: { status?: number } };
        if (err.response?.status === 404) {
          setAvailable([]);
        } else {
          console.error(e);
          setError("Не удалось загрузить список пользователей.");
        }
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [accessToken, chat.id]);

  const handleAdd = async (user: AvailableUser) => {
    try {
      const resp = await axios.post<ChatParticipant>(
        `/api/chats/chats/${chat.id}/add_participant/`,
        { user_id: user.id },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const updated = [...chat.participants, resp.data];
      onParticipantsChange(updated);
      setAvailable((prev) => prev.filter((u) => u.id !== user.id));
    } catch (e) {
      console.error(e);
      setError("Не удалось добавить участника.");
    }
  };

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
      <div className="glass-panel max-w-2xl w-full p-6 space-y-4">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Текущие участники
            </p>
            <div className="space-y-1 max-h-60 overflow-y-auto scrollbar-thin">
              {chat.participants.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2"
                >
                  <div>
                    <p className="text-sm">
                      {p.user?.display_name ??
                        p.user?.full_name ??
                        p.user?.email ??
                        "Неизвестный пользователь"}
                    </p>
                    {p.user?.email && (
                      <p className="text-xs text-slate-400">{p.user.email}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 rounded-lg border border-slate-700 hover:bg-slate-800"
                    onClick={() => handleRemove(p)}
                  >
                    Удалить
                  </button>
                </div>
              ))}
              {chat.participants.length === 0 && (
                <p className="text-xs text-slate-500">
                  В этом чате пока нет участников.
                </p>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Доступные пользователи
            </p>
            <div className="space-y-1 max-h-60 overflow-y-auto scrollbar-thin">
              {loading && (
                <p className="text-xs text-slate-400">Загрузка списка...</p>
              )}
              {!loading &&
                available.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm">
                        {u.display_name || u.full_name || u.email}
                      </p>
                      {u.email && (
                        <p className="text-xs text-slate-400">{u.email}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded-lg bg-primary hover:bg-primaryDark"
                      onClick={() => handleAdd(u)}
                    >
                      Добавить
                    </button>
                  </div>
                ))}
              {!loading && available.length === 0 && (
                <p className="text-xs text-slate-500">
                  Нет пользователей, которых можно добавить.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

