import React, { createContext, useContext, useEffect, useState } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authApi.me()
      .then((result) => setUser(result.data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email, password) => {
    const result = await authApi.login({ email, password });
    if (result.data?.token) {
      localStorage.setItem('framehouse_token', result.data.token);
    }
    setUser(result.data.user);
    return result.data.user;
  };

  const signUp = async (name, email, password) => {
    const result = await authApi.register({ name, email, password });
    if (result.data?.token) {
      localStorage.setItem('framehouse_token', result.data.token);
    }
    setUser(result.data.user);
    return result.data.user;
  };

  const signOut = async () => {
    try {
      await authApi.logout();
    } catch (err) {
      console.warn('Logout request completed with warning:', err);
    } finally {
      localStorage.removeItem('framehouse_token');
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
