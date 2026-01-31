import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  async function checkAuth() {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.getCurrentUser();
      if (data && data.user) {
        setUser(data.user);
      } else {
        localStorage.removeItem('token');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  }

  async function login(walletAddress, signature) {
    const data = await api.login(walletAddress, signature);
    
    // CRITICAL: Save token to localStorage
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    
    if (data.user) {
      setUser(data.user);
    }
    
    return data;
  }

  async function register(username, walletAddress, signature) {
    const data = await api.register(username, walletAddress, signature);
    
    // CRITICAL: Save token to localStorage
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    
    if (data.user) {
      setUser(data.user);
    }
    
    return data;
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}