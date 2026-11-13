import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/endpoints";
import {
  refreshAccessToken,
  setAccessToken,
  setAuthFailureHandler,
} from "../api/http";
import type { User } from "../types/api";

interface AuthContextValue {
  user: User | null;
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    setAuthFailureHandler(() => {
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
    });

    let active = true;
    refreshAccessToken()
      .then((session) => {
        if (!active) return;
        if (session) {
          setUser(session.user);
        } else {
          setUser(null);
        }
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setIsInitializing(false);
      });

    return () => {
      active = false;
      setAuthFailureHandler(null);
    };
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    setAccessToken(res.accessToken);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setAccessToken(null);
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, isInitializing, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return ctx;
}
