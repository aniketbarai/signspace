import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authApi, type PublicUser } from "../services/api";

type AuthContextValue = {
  user: PublicUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const nextUser = await authApi.me();
    setUser(nextUser);
    setLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const value = useMemo(() => ({
    user,
    loading,
    refresh,
    logout: async () => {
      await authApi.logout();
      setUser(null);
    },
  }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
