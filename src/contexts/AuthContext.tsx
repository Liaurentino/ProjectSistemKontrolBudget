import React, { createContext, useContext, useState, useEffect } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const initSession = async () => {
      try {
        console.log("🔵 Getting session...");
        const { data, error } = await supabase.auth.getSession();

        console.log("🔵 Session result:", {
          hasSession: !!data.session,
          error: error?.message,
        });

        if (mounted) {
          setSession(data.session);
          setUser(data.session?.user ?? null);
          setLoading(false);
          console.log("✅ Auth initialized");
        }
      } catch (err) {
        console.error("❌ Error in initSession:", err);
        if (mounted) {
          setLoading(false);
        }
      }
    };

    // Timeout fallback
    const timeout = setTimeout(() => {
      console.error("⏰ Auth init timeout - forcing end loading");
      if (mounted) {
        setLoading(false);
      }
    }, 3000);

    initSession().finally(() => clearTimeout(timeout));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      console.log("🔵 Auth event:", event);

      if (mounted) {
        setSession(newSession);
        setUser(newSession?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Clear Accurate tokens
    localStorage.removeItem("accurate_access_token");
    localStorage.removeItem("accurate_refresh_token");
    localStorage.removeItem("accurate_expires_at");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth harus dipakai di dalam AuthProvider");
  return ctx;
};
