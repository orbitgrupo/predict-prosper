import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface Profile {
  id: string;
  email: string;
  username: string | null;
  phone: string | null;
  balance: number;
  document_front_url: string | null;
  document_back_url: string | null;
  document_status: string | null;
  document_rejection_reason: string | null;
  is_age_verified: boolean;
  verified_at: string | null;
  referral_code: string;
  referral_clicks: number;
  accepted_terms: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  pendingSignupEmail: string | null;
  isAdmin: boolean;
  isEmailConfirmed: boolean;
  loading: boolean;
  signUp: (email: string, password: string, username?: string, referralCode?: string, phone?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearPendingSignup: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PENDING_SIGNUP_EMAIL_KEY = 'votox_pending_signup_email';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [pendingSignupEmail, setPendingSignupEmail] = useState<string | null>(() =>
    localStorage.getItem(PENDING_SIGNUP_EMAIL_KEY)
  );
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const clearPendingSignup = () => {
    localStorage.removeItem(PENDING_SIGNUP_EMAIL_KEY);
    setPendingSignupEmail(null);
  };

  const fetchProfile = async (userId: string) => {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (profileData) {
      setProfile({
        id: profileData.id,
        email: profileData.email,
        username: profileData.username,
        phone: profileData.phone,
        balance: Number(profileData.balance),
        document_front_url: profileData.document_front_url,
        document_back_url: profileData.document_back_url,
        document_status: profileData.document_status,
        document_rejection_reason: profileData.document_rejection_reason,
        is_age_verified: profileData.is_age_verified,
        verified_at: profileData.verified_at,
        referral_code: (profileData as any).referral_code || '',
        referral_clicks: (profileData as any).referral_clicks ?? 0,
        accepted_terms: (profileData as any).accepted_terms ?? false,
      });
    }

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    
    const hasAdminRole = roleData?.some(r => r.role === 'admin') || false;
    setIsAdmin(hasAdminRole);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          if (session.user.email_confirmed_at) {
            clearPendingSignup();
          }
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setIsAdmin(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        if (session.user.email_confirmed_at) {
          clearPendingSignup();
        }
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username?: string, referralCode?: string, phone?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { username, referral_code: referralCode || null, phone: phone || null },
      },
    });

    if (!error && data.user && !data.session) {
      localStorage.setItem(PENDING_SIGNUP_EMAIL_KEY, email);
      setPendingSignupEmail(email);
    }
    
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error) {
      clearPendingSignup();
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setIsAdmin(false);
  };

  const isEmailConfirmed = !!user?.email_confirmed_at;

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      pendingSignupEmail,
      isAdmin,
      isEmailConfirmed,
      loading,
      signUp,
      signIn,
      signOut,
      refreshProfile,
      clearPendingSignup,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
