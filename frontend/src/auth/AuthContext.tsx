import React, { createContext, useContext, useEffect, useState } from "react";
import axios from "axios";

type UserProfile = {
  id: number;
  email: string;
  full_name: string;
  display_name: string;
};

type AuthContextValue = {
  isAuthenticated: boolean;
  accessToken: string | null;
  user: UserProfile | null;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    password2: string
  ) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "teamon_auth";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children
}) => {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        accessToken: string;
      };
      if (parsed.accessToken) {
        setAccessToken(parsed.accessToken);
        void fetchProfile(parsed.accessToken);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const persist = (token: string | null) => {
    if (!token) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ accessToken: token }));
    }
  };

  const fetchProfile = async (token: string) => {
    const response = await axios.get<UserProfile>("/api/auth/profile", {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    setUser(response.data);
  };

  const login = async (email: string, password: string) => {
    const response = await axios.post("/api/auth/login/", { email, password });
    const token = response.data.access as string;
    setAccessToken(token);
    persist(token);
    await fetchProfile(token);
  };

  const register = async (
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    password2: string
  ) => {
    await axios.post("/api/auth/register/", {
      email,
      password,
      password2,
      first_name: firstName,
      last_name: lastName
    });
    await login(email, password);
  };

  const logout = () => {
    setAccessToken(null);
    setUser(null);
    persist(null);
  };

  const value: AuthContextValue = {
    isAuthenticated: Boolean(accessToken && user),
    accessToken,
    user,
    login,
    register,
    logout
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
};

