import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../auth/AuthContext";

const extractApiErrorMessage = (err: unknown, fallback: string): string => {
  const responseData = (err as { response?: { data?: unknown } })?.response?.data;
  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }
  if (responseData && typeof responseData === "object") {
    const data = responseData as Record<string, unknown>;
    if (typeof data.detail === "string") return data.detail;
    for (const value of Object.values(data)) {
      if (typeof value === "string" && value.trim()) return value;
      if (Array.isArray(value) && typeof value[0] === "string") return value[0];
    }
  }
  return fallback;
};

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, accessToken, refreshProfile } = useAuth();
  const [username, setUsername] = useState(user?.username ?? "");
  const [firstName, setFirstName] = useState(user?.first_name ?? "");
  const [lastName, setLastName] = useState(user?.last_name ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  React.useEffect(() => {
    if (!user) return;
    setUsername(user.username ?? "");
    setFirstName(user.first_name ?? "");
    setLastName(user.last_name ?? "");
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await axios.patch(
        "/api/auth/profile/",
        {
          username: username.trim(),
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          current_password: currentPassword || undefined,
          new_password: newPassword || undefined,
          new_password2: newPassword2 || undefined
        },
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      await refreshProfile();
      setCurrentPassword("");
      setNewPassword("");
      setNewPassword2("");
      setSuccess("Сохранено.");
    } catch (err) {
      setError(extractApiErrorMessage(err, "Не удалось сохранить."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-50 px-4 py-6">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-semibold">Настройки профиля</h1>
          <button
            type="button"
            className="text-sm px-3 py-1.5 rounded-xl border border-slate-700 hover:bg-slate-800"
            onClick={() => navigate("/app/chats")}
          >
            ← К чатам
          </button>
        </div>
        <form onSubmit={handleSubmit} className="glass-panel p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400" htmlFor="email_ro">
              Email (нельзя изменить)
            </label>
            <input
              id="email_ro"
              readOnly
              className="w-full rounded-xl bg-slate-900/50 border border-slate-800 px-3 py-2 text-sm text-slate-400 cursor-not-allowed"
              value={user?.email ?? ""}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-300" htmlFor="username">
              Никнейм
            </label>
            <input
              id="username"
              required
              className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-300" htmlFor="fn">
                Имя
              </label>
              <input
                id="fn"
                className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs text-slate-300" htmlFor="ln">
                Фамилия
              </label>
              <input
                id="ln"
                className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500 border-t border-slate-800 pt-4">
            Смена пароля (оставьте пустым, если не меняете)
          </p>
          <div className="space-y-1">
            <label className="text-xs text-slate-300" htmlFor="curpw">
              Текущий пароль
            </label>
            <input
              id="curpw"
              type="password"
              autoComplete="current-password"
              className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-300" htmlFor="newpw">
              Новый пароль
            </label>
            <input
              id="newpw"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-300" htmlFor="newpw2">
              Повторите новый пароль
            </label>
            <input
              id="newpw2"
              type="password"
              autoComplete="new-password"
              className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm"
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {success && <p className="text-sm text-emerald-400">{success}</p>}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-primary hover:bg-primaryDark py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Сохраняем..." : "Сохранить"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SettingsPage;
