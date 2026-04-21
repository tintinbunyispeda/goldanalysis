import { useState, useEffect } from 'react';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // MOCK AUTHENTICATION FOR LOCAL/PRESENTATION USE
  // Bypass Supabase completely since the Lovable project might be paused.
  useEffect(() => {
    // Simulate a brief loading state, then auto-login
    const timer = setTimeout(() => {
      const mockUser = {
        id: "mock-user-123",
        email: "demo@student.pu.id",
        user_metadata: { display_name: "Demo User" }
      } as unknown as User;
      
      setUser(mockUser);
      setSession({ user: mockUser, access_token: "mock-token" } as unknown as Session);
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const signIn = async (email: string, password: string) => {
    // Simulate network delay then succeed
    await new Promise(r => setTimeout(r, 800));
    window.location.href = "/";
    return { error: null };
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    await new Promise(r => setTimeout(r, 800));
    window.location.href = "/";
    return { error: null };
  };

  const signOut = async () => {
    setUser(null);
    setSession(null);
    window.location.href = "/auth";
  };

  return { user, session, loading, signIn, signUp, signOut };
}
