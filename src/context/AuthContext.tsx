import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { UserRole } from '../types';

// Bump this when the EULA text changes materially. All existing users will be
// prompted to re-accept on their next login. Matches the version written by
// handle_new_user() in supabase_apple_1_2_compliance.sql.
export const CURRENT_EULA_VERSION = 1;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  displayName: string | null;
  isPastor: boolean;
  isAdmin: boolean; // alias for isPastor (backward compat)
  loading: boolean;
  needsEulaAccept: boolean;
  isBanned: boolean;
  bannedReason: string | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  acceptEula: () => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  role: null,
  displayName: null,
  isPastor: false,
  isAdmin: false,
  loading: true,
  needsEulaAccept: false,
  isBanned: false,
  bannedReason: null,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
  refreshRole: async () => {},
  acceptEula: async () => ({ error: null }),
});

interface ProfileData {
  role: UserRole | null;
  full_name: string | null;
  eula_version: number;
  is_banned: boolean;
  banned_reason: string | null;
}

async function fetchUserProfile(userId: string): Promise<ProfileData> {
  const empty: ProfileData = { role: null, full_name: null, eula_version: 0, is_banned: false, banned_reason: null };

  // Try full schema first (post-migration)
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('role, is_admin, full_name, eula_version, is_banned, banned_reason')
      .eq('id', userId)
      .single();
    if (!error && data) {
      const role: UserRole | null = data.role
        ? (data.role as UserRole)
        : data.is_admin ? 'pastor' : 'member';
      return {
        role,
        full_name: (data as any).full_name ?? null,
        eula_version: (data as any).eula_version ?? 0,
        is_banned: (data as any).is_banned ?? false,
        banned_reason: (data as any).banned_reason ?? null,
      };
    }
  } catch { /* pre-migration schema — fall through */ }

  // Fallback: pre-migration schema (no eula_version/is_banned columns yet)
  try {
    const { data } = await supabase
      .from('profiles')
      .select('role, is_admin, full_name')
      .eq('id', userId)
      .single();
    if (!data) return empty;
    const role: UserRole | null = data.role
      ? (data.role as UserRole)
      : data.is_admin ? 'pastor' : 'member';
    return { ...empty, role, full_name: (data as any).full_name ?? null };
  } catch {
    return empty;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsEulaAccept, setNeedsEulaAccept] = useState(false);
  const [isBanned, setIsBanned] = useState(false);
  const [bannedReason, setBannedReason] = useState<string | null>(null);

  const isPastor = role === 'pastor';
  const isAdmin = isPastor;

  async function applySession(s: Session | null) {
    if (!s?.user) {
      setSession(null);
      setRole(null);
      setDisplayName(null);
      setNeedsEulaAccept(false);
      setIsBanned(false);
      setBannedReason(null);
      return;
    }
    // Set session immediately so login isn't blocked by the DB fetch
    setSession(s);
    const metaName =
      (s.user.user_metadata?.full_name as string | undefined) ||
      s.user.email?.split('@')[0] ||
      null;
    setDisplayName(metaName);

    // Fetch profile with 8s timeout — failure just keeps defaults
    try {
      const withTimeout = Promise.race([
        fetchUserProfile(s.user.id),
        new Promise<ProfileData>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 8000)
        ),
      ]);
      const p = await withTimeout;
      setRole(p.role);
      if (p.full_name) setDisplayName(p.full_name);
      setIsBanned(p.is_banned);
      setBannedReason(p.banned_reason);
      setNeedsEulaAccept(p.eula_version < CURRENT_EULA_VERSION);
    } catch {
      // profile fetch timed out — leave defaults; don't gate on EULA/ban
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      await applySession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function refreshRole() {
    if (session?.user) {
      const p = await fetchUserProfile(session.user.id);
      setRole(p.role);
      if (p.full_name) setDisplayName(p.full_name);
      setIsBanned(p.is_banned);
      setBannedReason(p.banned_reason);
      setNeedsEulaAccept(p.eula_version < CURRENT_EULA_VERSION);
    }
  }

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please check your internet connection.')), 15000)
      );
      const request = supabase.auth.signInWithPassword({ email, password });
      const { error } = await Promise.race([request, timeout]) as Awaited<typeof request>;
      return { error: error?.message ?? null };
    } catch (err: any) {
      return { error: err?.message ?? 'An error occurred during sign in.' };
    }
  }

  async function signUp(email: string, password: string, name: string): Promise<{ error: string | null }> {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setRole(null);
    setNeedsEulaAccept(false);
    setIsBanned(false);
    setBannedReason(null);
  }

  async function acceptEula(): Promise<{ error: string | null }> {
    if (!session?.user) return { error: 'not authenticated' };
    const { error } = await supabase
      .from('profiles')
      .update({
        eula_version: CURRENT_EULA_VERSION,
        eula_accepted_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);
    if (error) return { error: error.message };
    setNeedsEulaAccept(false);
    return { error: null };
  }

  return (
    <AuthContext.Provider value={{
      user: session?.user ?? null,
      session,
      role,
      displayName,
      isPastor,
      isAdmin,
      loading,
      needsEulaAccept,
      isBanned,
      bannedReason,
      signIn,
      signUp,
      signOut,
      refreshRole,
      acceptEula,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
