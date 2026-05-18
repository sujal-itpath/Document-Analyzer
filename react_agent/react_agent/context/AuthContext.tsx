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
}

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
    const savedUser = localStorage.getItem('auth_user');
    
    let user = null;
    if (savedToken && savedUser) {
      try {
        user = JSON.parse(savedUser);
      } catch (e) {
        user = { email: 'user@example.com' };
      }
    } else if (savedToken) {
      user = { email: 'user@example.com' };
    }

    setAuthState({
      token: savedToken,
      user: user,
      loading: false,
    });
  }, []);

  const login = useCallback((newToken: string) => {
    const userData = { email: 'user@example.com' };
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(userData));
    
    setAuthState({
      token: newToken,
      user: userData,
      loading: false,
    });
    router.push('/dashboard');
  }, [router]);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setAuthState({
      token: null,
      user: null,
      loading: false,
    });
    router.push('/');
  }, [router]);

  const value = useMemo(() => ({
    user: authState.user,
    token: authState.token,
    loading: authState.loading,
    login,
    logout,
    isAuthenticated: !!authState.token,
  }), [authState.user, authState.token, authState.loading, login, logout]);

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
