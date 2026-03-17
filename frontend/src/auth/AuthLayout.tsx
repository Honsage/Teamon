import React from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

const AuthCard: React.FC<{ children: React.ReactNode; title: string }> = ({
  children,
  title
}) => (
  <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 px-4">
    <div className="glass-panel max-w-md w-full p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight mb-1">Teamon</h1>
        <p className="text-sm text-slate-400">{title}</p>
      </div>
      {children}
    </div>
  </div>
);

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate("/app/chats");
    } catch (err) {
      console.error(err);
      setError("Не удалось войти. Проверьте данные.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Войдите, чтобы продолжить общение.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="password">
            Пароль
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-100"
              onClick={() => setShowPassword((v) => !v)}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <path
                  d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                {showPassword && (
                  <line
                    x1="4"
                    y1="4"
                    x2="20"
                    y2="20"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center rounded-xl bg-primary hover:bg-primaryDark transition text-sm font-medium py-2.5 disabled:opacity-60"
        >
          {loading ? "Входим..." : "Войти"}
        </button>
        <p className="text-xs text-slate-400 text-center">
          Нет аккаунта?{" "}
          <button
            type="button"
            onClick={() => navigate("/auth/register")}
            className="text-accent hover:underline"
          >
            Зарегистрируйтесь
          </button>
        </p>
      </form>
    </AuthCard>
  );
};

const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [password2, setPassword2] = React.useState("");
  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showPassword2, setShowPassword2] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== password2) {
      setError("Пароли не совпадают.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await register(email, password, firstName, lastName, password2);
      navigate("/app/chats");
    } catch (err) {
      console.error(err);
      setError("Не удалось зарегистрироваться. Проверьте поля.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCard title="Создайте рабочее пространство для команды.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="first_name">
              Имя
            </label>
            <input
              id="first_name"
              type="text"
              required
              className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm text-slate-300" htmlFor="last_name">
              Фамилия
            </label>
            <input
              id="last_name"
              type="text"
              required
              className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
            />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="password">
            Пароль
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              required
              className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-9"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-100"
              onClick={() => setShowPassword((v) => !v)}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <path
                  d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                {showPassword && (
                  <line
                    x1="4"
                    y1="4"
                    x2="20"
                    y2="20"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-sm text-slate-300" htmlFor="password2">
            Повторите пароль
          </label>
          <div className="relative">
            <input
              id="password2"
              type={showPassword2 ? "text" : "password"}
              required
              className="w-full rounded-xl bg-slate-900/70 border border-slate-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary pr-9"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
            <button
              type="button"
              aria-label={showPassword2 ? "Скрыть пароль" : "Показать пароль"}
              className="absolute inset-y-0 right-2 flex items-center text-slate-400 hover:text-slate-100"
              onClick={() => setShowPassword2((v) => !v)}
            >
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5"
                aria-hidden="true"
              >
                <path
                  d="M2 12s3-6 10-6 10 6 10 6-3 6-10 6S2 12 2 12Z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12"
                  r="3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                />
                {showPassword2 && (
                  <line
                    x1="4"
                    y1="4"
                    x2="20"
                    y2="20"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center rounded-xl bg-primary hover:bg-primaryDark transition text-sm font-medium py-2.5 disabled:opacity-60"
        >
          {loading ? "Создаём..." : "Зарегистрироваться"}
        </button>
        <p className="text-xs text-slate-400 text-center">
          Уже есть аккаунт?{" "}
          <button
            type="button"
            onClick={() => navigate("/auth/login")}
            className="text-accent hover:underline"
          >
            Войти
          </button>
        </p>
      </form>
    </AuthCard>
  );
};

const AuthLayout: React.FC = () => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) {
    return <Navigate to="/app/chats" replace />;
  }

  return (
    <Routes>
      <Route path="login" element={<LoginPage />} />
      <Route path="register" element={<RegisterPage />} />
      <Route path="*" element={<Navigate to="login" replace />} />
    </Routes>
  );
};

export default AuthLayout;

