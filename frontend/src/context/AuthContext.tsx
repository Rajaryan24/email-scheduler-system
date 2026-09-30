import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { authApi } from '../services/api';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (userData: { email: string; name?: string; avatar?: string; googleId?: string }) => Promise<void>;
  logout: () => void;
  updateUserSlackStatus: (connected: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem('reachinbox_jwt_token');
      if (token) {
        try {
          const data = await authApi.getMe();
          if (data.user) {
            setUser(data.user);
          }
        } catch (error) {
          console.warn('Session check failed or backend starting up');
          // If offline or starting up, retrieve saved local user
          const savedUser = localStorage.getItem('reachinbox_local_user');
          if (savedUser) {
            setUser(JSON.parse(savedUser));
          }
        }
      }
      setLoading(false);
    }
    checkAuth();
  }, []);

  const login = async (userData: { email: string; name?: string; avatar?: string; googleId?: string }) => {
    setLoading(true);
    
    const fallbackUser: User = {
      id: 'demo-user-id',
      email: userData.email,
      name: userData.name || 'ReachInbox Demo User',
      avatar: userData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(userData.email)}`,
      slackConnected: false
    };

    try {
      const data = await authApi.googleLogin(userData);
      if (data.token && data.user) {
        localStorage.setItem('reachinbox_jwt_token', data.token);
        localStorage.setItem('reachinbox_local_user', JSON.stringify(data.user));
        setUser(data.user);
      } else {
        localStorage.setItem('reachinbox_local_user', JSON.stringify(fallbackUser));
        setUser(fallbackUser);
      }
    } catch (error) {
      console.warn('Backend login API unreachable, proceeding with client session fallback:', error);
      localStorage.setItem('reachinbox_local_user', JSON.stringify(fallbackUser));
      setUser(fallbackUser);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('reachinbox_jwt_token');
    localStorage.removeItem('reachinbox_local_user');
    setUser(null);
  };

  const updateUserSlackStatus = (connected: boolean) => {
    if (user) {
      const updated = { ...user, slackConnected: connected };
      setUser(updated);
      localStorage.setItem('reachinbox_local_user', JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, updateUserSlackStatus }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
