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

  async function connectWallet() {
    if (!window.ethereum) {
      throw new Error('MetaMask is not installed');
    }

    try {
      // Request account access
      const accounts = await window.ethereum.request({
        method: 'eth_requestAccounts',
      });

      const address = accounts[0];
      console.log('Connected address:', address);

      // Get nonce from backend
      const nonceResponse = await fetch(`https://social-api.hyvechain.com/api/auth/nonce/${address}`);
      const { nonce } = await nonceResponse.json();
      console.log('Got nonce:', nonce);

      // Sign the nonce
      const signature = await window.ethereum.request({
        method: 'personal_sign',
        params: [nonce, address],
      });
      console.log('Signature obtained');

      return { address, signature };
    } catch (error) {
      console.error('Wallet connection error:', error);
      throw error;
    }
  }

  async function login(walletAddress, signature) {
    const data = await api.login(walletAddress, signature);
    
    // Save token to localStorage
    if (data.token) {
      localStorage.setItem('token', data.token);
    }
    
    if (data.userExists && data.user) {
      setUser(data.user);
      return { needsRegistration: false };
    } else {
      return { needsRegistration: true };
    }
  }

  async function register(walletAddress, username) {
    // Get fresh signature for registration
    const { signature } = await connectWallet();
    
    const data = await api.register(username, walletAddress, signature);
    
    // Save token to localStorage
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
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth, connectWallet }}>
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