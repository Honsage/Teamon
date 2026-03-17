import React from "react";
import { useAuth } from "../auth/AuthContext";

export const ProfileSidebar: React.FC = () => {
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

