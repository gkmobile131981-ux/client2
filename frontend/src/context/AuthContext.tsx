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
  community_username?: string | null;
  created_at: string;
  home_address?: string | null;
  blood_group?: string | null;
  dob?: string | null;
  personal_phone?: string | null;
  aadhar_number?: string | null;
  photo_url?: string | null;
}

interface ShopProfile {
  id: string;
  name: string;
  logo_url: string | null;
  address: string | null;
  phone: string | null;
  owner_id: string;
  shop_type?: string | null;
  gst_number?: string | null;
  currency_symbol?: string | null;
  currency_code?: string | null;
}

interface AuthContextType {
  user: UserProfile | null;
  role: 'owner' | 'staff' | null;
  shop: ShopProfile | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  setAuthTokens: (accessToken: string, refreshToken: string, userData?: any, shopData?: any) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Synchronous initialization from localStorage for instant persistent login across reloads
  const [user, setUser] = useState<UserProfile | null>(() => {
    const cached = localStorage.getItem('gk_cached_user');
    if (!cached) return null;
    try { return JSON.parse(cached); } catch { return null; }
  });

  const [role, setRole] = useState<'owner' | 'staff' | null>(() => {
    return (localStorage.getItem('gk_cached_role') as any) || null;
  });

  const [shop, setShop] = useState<ShopProfile | null>(() => {
    const cached = localStorage.getItem('gk_cached_shop');
    if (!cached) return null;
    try { return JSON.parse(cached); } catch { return null; }
  });

  const [isLoading, setIsLoading] = useState<boolean>(() => {
    // Loading only if there is a token to restore but no cached profile yet.
    // When a cached profile exists we render instantly; when a token exists we
    // must NOT render the unauthenticated state (which redirects to /login)
    // while the profile is being restored.
    const hasCachedUser = !!localStorage.getItem('gk_cached_user');
    const hasToken = !!localStorage.getItem('gk_access_token') || !!localStorage.getItem('gk_refresh_token');
    return !hasCachedUser && hasToken;
  });

  const profileLoadingPromiseRef = React.useRef<Promise<void> | null>(null);

  // Initialize and load user profile if tokens exist
  const loadProfile = async (token: string) => {
    if (profileLoadingPromiseRef.current) {
      return profileLoadingPromiseRef.current;
    }

    const promise = (async () => {
      try {
        localStorage.setItem('gk_access_token', token);
        const { profile } = await apiClient.get<{ profile: UserProfile & { shop: ShopProfile } }>('/auth/me');
        
        const loadedUser: UserProfile = {
          id: profile.id,
          name: profile.name,
          email: profile.email,
          role: profile.role,
          staff_id: profile.staff_id,
          shop_id: profile.shop_id,
          is_active: profile.is_active,
          created_at: profile.created_at,
          home_address: profile.home_address,
          blood_group: profile.blood_group,
          dob: profile.dob,
          personal_phone: profile.personal_phone,
          aadhar_number: profile.aadhar_number,
          photo_url: profile.photo_url
        };

        setUser(loadedUser);
        setRole(profile.role);
        setShop(profile.shop);

        // Save to cache for offline/reload persistence
        localStorage.setItem('gk_cached_user', JSON.stringify(loadedUser));
        localStorage.setItem('gk_cached_shop', JSON.stringify(profile.shop));
        localStorage.setItem('gk_cached_role', profile.role);
      } catch (error) {
        console.warn('Profile refresh notice:', error);
        
        // If token expired, attempt background token refresh without kicking user out
        if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
          try {
            const storedRefreshToken = localStorage.getItem('gk_refresh_token');
            if (storedRefreshToken) {
              const { data } = await supabase.auth.refreshSession({ refresh_token: storedRefreshToken });
              if (data?.session?.access_token) {
                localStorage.setItem('gk_refresh_token', data.session.refresh_token);
                localStorage.setItem('gk_access_token', data.session.access_token);
                const { profile } = await apiClient.get<{ profile: UserProfile & { shop: ShopProfile } }>('/auth/me');
                if (profile) {
                  setUser(profile);
                  setRole(profile.role);
                  setShop(profile.shop);
                  localStorage.setItem('gk_cached_user', JSON.stringify(profile));
                  localStorage.setItem('gk_cached_shop', JSON.stringify(profile.shop));
                  localStorage.setItem('gk_cached_role', profile.role);
                  return;
                }
              }
            }
          } catch (refreshErr) {
            console.warn('Background token refresh failed:', refreshErr);
          }
        }

        // If cached profile exists in localStorage, KEEP user logged in!
        const cached = localStorage.getItem('gk_cached_user');
        if (cached) {
          try {
            const parsedUser = JSON.parse(cached);
            setUser(parsedUser);
            const cachedShop = localStorage.getItem('gk_cached_shop');
            if (cachedShop) setShop(JSON.parse(cachedShop));
            const cachedRole = localStorage.getItem('gk_cached_role');
            if (cachedRole) setRole(cachedRole as any);
          } catch {
            // Keep state intact
          }
        }
      } finally {
        profileLoadingPromiseRef.current = null;
      }
    })();

    profileLoadingPromiseRef.current = promise;
    return promise;
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
    localStorage.removeItem('gk_cached_user');
    localStorage.removeItem('gk_cached_shop');
    localStorage.removeItem('gk_cached_role');
  };

  // Sync Supabase Client State with Local Storage
  useEffect(() => {
    const checkInitialSession = async () => {
      const storedAccessToken = localStorage.getItem('gk_access_token');
      const storedRefreshToken = localStorage.getItem('gk_refresh_token');

      if (storedAccessToken) {
        try {
          // Re-establish the in-memory Supabase session (the client uses
          // persistSession:false) so realtime channels and auth listeners work
          // after a full page reload, not just login.
          const storedRefreshTokenForSupabase = localStorage.getItem('gk_refresh_token');
          if (storedRefreshTokenForSupabase) {
            await supabase.auth.setSession({
              access_token: storedAccessToken,
              refresh_token: storedRefreshTokenForSupabase
            }).catch(() => {});
          }
          await loadProfile(storedAccessToken);
        } catch (error) {
          console.warn('Silent profile refresh fallback:', error);
        }
      } else if (storedRefreshToken) {
        try {
          const { data: newSession } = await supabase.auth.refreshSession({
            refresh_token: storedRefreshToken
          });
          if (newSession?.session?.access_token) {
            localStorage.setItem('gk_refresh_token', newSession.session.refresh_token);
            localStorage.setItem('gk_access_token', newSession.session.access_token);
            await loadProfile(newSession.session.access_token);
          }
        } catch (error) {
          console.warn('Failed to restore session using stored refresh token:', error);
        }
      }

      // If the profile could not be restored and there is no cached fallback,
      // the stored tokens are stale — drop them so the app lands on /login
      // instead of being stuck in the loading state or bouncing repeatedly.
      if (!localStorage.getItem('gk_cached_user') && !localStorage.getItem('gk_cached_shop')) {
        localStorage.removeItem('gk_access_token');
        localStorage.removeItem('gk_refresh_token');
      }
      setIsLoading(false);
    };

    checkInitialSession();

    // Set listener on Auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        localStorage.setItem('gk_refresh_token', session.refresh_token);
        await loadProfile(session.access_token);
      } else if (event === 'TOKEN_REFRESHED' && session) {
        localStorage.setItem('gk_refresh_token', session.refresh_token);
        localStorage.setItem('gk_access_token', session.access_token);
      }
      setIsLoading(false);
    });

    // Refresh token every 30 minutes in background to keep user logged in indefinitely
    const refreshInterval = setInterval(() => {
      refreshSession();
    }, 30 * 60 * 1000);

    return () => {
      subscription.unsubscribe();
      clearInterval(refreshInterval);
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

      // Persist the profile cache synchronously so a page reload right after
      // login (or a transient profile-refresh failure) never falls back to the
      // login screen. Previously the cache was only written by the async
      // onAuthStateChange -> loadProfile listener, leaving a race window.
      localStorage.setItem('gk_cached_user', JSON.stringify(data.user));
      localStorage.setItem('gk_cached_shop', JSON.stringify(data.shop));
      localStorage.setItem('gk_cached_role', data.user.role);
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
      // ONLY log out if it is a genuine credentials error (400 Bad Request, 401 Unauthorized, 403 Forbidden)
      if (err instanceof ApiError && (err.status === 400 || err.status === 401 || err.status === 403)) {
        await logout();
      }
    }
  };

  const setAuthTokens = async (accessToken: string, refreshToken: string, userData?: any, shopData?: any) => {
    setIsLoading(true);
    try {
      localStorage.setItem('gk_access_token', accessToken);
      localStorage.setItem('gk_refresh_token', refreshToken);

      await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).catch(() => {});

      if (userData) {
        setUser(userData);
        setRole(userData.role);
        localStorage.setItem('gk_cached_user', JSON.stringify(userData));
        localStorage.setItem('gk_cached_role', userData.role);
      }
      if (shopData) {
        setShop(shopData);
        localStorage.setItem('gk_cached_shop', JSON.stringify(shopData));
      }

      if (!userData || !shopData) {
        await loadProfile(accessToken);
      }
    } finally {
      setIsLoading(false);
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
        setAuthTokens,
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
