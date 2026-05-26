'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: any;
  token: string | null;
  loading: boolean;
  login: (token: string) => void;
  logout: () => void;
  isAuthenticated: boolean;
  updateProfile: (profileData: { displayName: string; username: string; avatarColor?: string }) => void;
}

const decodeJwtEmail = (token: string): string => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return 'user@example.com';
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const decoded = JSON.parse(jsonPayload);
    return decoded.sub || 'user@example.com';
  } catch (e) {
    console.error('Failed to decode JWT:', e);
    return 'user@example.com';
  }
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authState, setAuthState] = useState<{
    token: string | null;
    user: any;
    loading: boolean;
  }>({
    token: null,
    user: null,
    loading: true,
  });
  
  const router = useRouter();

  useEffect(() => {
    const savedToken = localStorage.getItem('auth_token');
    
    if (!savedToken) {
      setAuthState({
        token: null,
        user: null,
        loading: false,
      });
      return;
    }

    const fetchProfile = async () => {
      try {
        const response = await fetch('http://localhost:8000/auth/profile', {
          headers: {
            'Authorization': `Bearer ${savedToken}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setAuthState({
            token: savedToken,
            user: {
              email: data.email,
              username: data.username,
              displayName: data.display_name,
              avatarColor: data.avatar_color,
            },
            loading: false,
          });
        } else {
          localStorage.removeItem('auth_token');
          setAuthState({
            token: null,
            user: null,
            loading: false,
          });
        }
      } catch (e) {
        console.error('Failed to fetch profile on load:', e);
        const email = decodeJwtEmail(savedToken);
        setAuthState({
          token: savedToken,
          user: {
            email,
            username: email.split('@')[0],
            displayName: email.split('@')[0].split(/[._-]/).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
            avatarColor: 'bg-gradient-to-tr from-accent to-indigo-500',
          },
          loading: false,
        });
      }
    };

    void fetchProfile();
  }, []);

  const login = useCallback(async (newToken: string) => {
    localStorage.setItem('auth_token', newToken);
    
    try {
      const response = await fetch('http://localhost:8000/auth/profile', {
        headers: {
          'Authorization': `Bearer ${newToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAuthState({
          token: newToken,
          user: {
            email: data.email,
            username: data.username,
            displayName: data.display_name,
            avatarColor: data.avatar_color,
          },
          loading: false,
        });
        router.push('/dashboard');
      } else {
        throw new Error('Failed to fetch profile during login');
      }
    } catch (e) {
      console.error('Error fetching profile on login:', e);
      const realEmail = decodeJwtEmail(newToken);
      setAuthState({
        token: newToken,
        user: {
          email: realEmail,
          username: realEmail.split('@')[0],
          displayName: realEmail.split('@')[0].split(/[._-]/).map((s: string) => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
          avatarColor: 'bg-gradient-to-tr from-accent to-indigo-500',
        },
        loading: false,
      });
      router.push('/dashboard');
    }
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    setAuthState({
      token: null,
      user: null,
      loading: false,
    });
    router.push('/');
  }, [router]);

  const updateProfile = useCallback(async (profileData: { displayName: string; username: string; avatarColor?: string }) => {
    const savedToken = localStorage.getItem('auth_token');
    if (!savedToken) return;

    try {
      const response = await fetch('http://localhost:8000/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${savedToken}`
        },
        body: JSON.stringify({
          username: profileData.username,
          display_name: profileData.displayName,
          avatar_color: profileData.avatarColor
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setAuthState(prev => {
          if (!prev.user) return prev;
          return {
            ...prev,
            user: {
              ...prev.user,
              displayName: data.display_name,
              username: data.username,
              avatarColor: data.avatar_color
            }
          };
        });
      } else {
        console.error('Failed to update profile on backend');
      }
    } catch (e) {
      console.error('Error updating profile:', e);
    }
  }, []);

  const value = useMemo(() => ({
    user: authState.user,
    token: authState.token,
    loading: authState.loading,
    login,
    logout,
    isAuthenticated: !!authState.token,
    updateProfile,
  }), [authState.user, authState.token, authState.loading, login, logout, updateProfile]);

  return (
    <AuthContext.Provider value={value}>
      {!authState.loading && children}
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
