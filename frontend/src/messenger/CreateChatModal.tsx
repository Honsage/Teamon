import React, { useState } from "react";

type Props = {
  onClose: () => void;
  onSubmit: (data: {
    chatType: "private" | "group";
    otherUserEmail?: string;
    name?: string;
    projectName?: string;
    projectDescription?: string;
  }) => Promise<void> | void;
};

export const CreateChatModal: React.FC<Props> = ({ onClose, onSubmit }) => {
  const [chatType, setChatType] = useState<"private" | "group">("private");
  const [otherUserEmail, setOtherUserEmail] = useState("");
  const [name, setName] = useState("");
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
        chatType,
        otherUserEmail:
          chatType === "private" && otherUserEmail ? otherUserEmail : undefined,
        name: chatType === "group" ? name || projectName : undefined,
        projectName: chatType === "group" ? projectName || undefined : undefined,
        projectDescription:
          chatType === "group" ? projectDescription || undefined : undefined
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
          <div className="flex gap-3 text-sm">
            <button
              type="button"
              onClick={() => setChatType("private")}
              className={`flex-1 rounded-xl border px-3 py-2 ${
                chatType === "private"
                  ? "border-primary bg-primary/20"
                  : "border-slate-700 bg-slate-900/60"
              }`}
            >
              Личный
            </button>
            <button
              type="button"
              onClick={() => setChatType("group")}
              className={`flex-1 rounded-xl border px-3 py-2 ${
                chatType === "group"
                  ? "border-primary bg-primary/20"
                  : "border-slate-700 bg-slate-900/60"
              }`}
            >
              Групповой
            </button>
          </div>

          {chatType === "private" ? (
            <div className="space-y-1">
              <label className="text-xs text-slate-300" htmlFor="otherUserEmail">
                Email собеседника
              </label>
              <input
                id="otherUserEmail"
                type="email"
                required
                className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={otherUserEmail}
                onChange={(e) => setOtherUserEmail(e.target.value)}
              />
              <p className="text-[11px] text-slate-400">
                Укажите email пользователя, которого хотите добавить в чат.
              </p>
            </div>
          ) : (
            <>
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
            </>
          )}

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

