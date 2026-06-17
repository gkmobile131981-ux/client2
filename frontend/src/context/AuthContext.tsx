import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { apiClient, ApiError } from '../lib/api';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  staff_id: string | null;
  shop_id: string | null;
  is_active: boolean;
  created_at: string;
}

interface ShopProfile {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  owner_id: string;
}

interface AuthContextType {
  user: UserProfile | null;
  role: 'owner' | 'staff' | null;
  shop: ShopProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [role, setRole] = useState<'owner' | 'staff' | null>(null);
  const [shop, setShop] = useState<ShopProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize and load user profile if tokens exist
  const loadProfile = async (token: string) => {
    try {
      localStorage.setItem('gk_access_token', token);
      const { profile } = await apiClient.get<{ profile: UserProfile & { shop: ShopProfile } }>('/auth/me');
      
      setUser({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        staff_id: profile.staff_id,
        shop_id: profile.shop_id,
        is_active: profile.is_active,
        created_at: profile.created_at
      });
      setRole(profile.role);
      setShop(profile.shop);
    } catch (error) {
      console.error('Failed to load profile:', error);
      clearAuth();
    }
  };

  const reloadProfile = async () => {
    const token = localStorage.getItem('gk_access_token');
    if (token) {
      await loadProfile(token);
    }
  };

  const clearAuth = () => {
    setUser(null);
    setRole(null);
    setShop(null);
    localStorage.removeItem('gk_access_token');
    localStorage.removeItem('gk_refresh_token');
  };

  // Sync Supabase Client State with Local Storage and vice versa
  useEffect(() => {
    // 1. Initial check of session
    const checkInitialSession = async () => {
      setIsLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        localStorage.setItem('gk_refresh_token', session.refresh_token);
        await loadProfile(session.access_token);
      } else {
        clearAuth();
      }
      setIsLoading(false);
    };

    checkInitialSession();

    // 2. Set listener on Auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        localStorage.setItem('gk_refresh_token', session.refresh_token);
        await loadProfile(session.access_token);
      } else if (event === 'SIGNED_OUT') {
        clearAuth();
      } else if (event === 'TOKEN_REFRESHED' && session) {
        localStorage.setItem('gk_refresh_token', session.refresh_token);
        localStorage.setItem('gk_access_token', session.access_token);
      }
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const data = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
        user: UserProfile;
        shop: ShopProfile;
      }>('/auth/login', { email, password });

      // Save tokens locally
      localStorage.setItem('gk_access_token', data.accessToken);
      localStorage.setItem('gk_refresh_token', data.refreshToken);

      // Sync Supabase Auth client session with backend tokens
      await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken
      });

      setUser(data.user);
      setRole(data.user.role);
      setShop(data.shop);
    } catch (err) {
      clearAuth();
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await apiClient.post('/auth/logout');
    } catch (err) {
      console.warn('Logout request to backend failed, logging out locally', err);
    } finally {
      await supabase.auth.signOut();
      clearAuth();
      setIsLoading(false);
    }
  };

  const refreshSession = async () => {
    const refreshToken = localStorage.getItem('gk_refresh_token');
    if (!refreshToken) return;

    try {
      const data = await apiClient.post<{
        accessToken: string;
        refreshToken: string;
      }>('/auth/refresh', { refreshToken });

      localStorage.setItem('gk_access_token', data.accessToken);
      localStorage.setItem('gk_refresh_token', data.refreshToken);

      await supabase.auth.setSession({
        access_token: data.accessToken,
        refresh_token: data.refreshToken
      });
    } catch (err) {
      console.error('Failed to refresh session', err);
      await logout();
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        shop,
        isLoading,
        login,
        logout,
        refreshSession,
        reloadProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
