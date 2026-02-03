import { createContext, useContext, useState, useEffect } from 'react';
import EthereumProvider from '@walletconnect/ethereum-provider';
import api from '../services/api';
import socketService from '../services/socket';
import { API_URL, WALLETCONNECT_PROJECT_ID } from '../utils/env';

const AuthContext = createContext(null);
let walletConnectProvider;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socket, setSocket] = useState(null);

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
        if (data.user.walletAddress) {
          socketService.connect(data.user.walletAddress);
          setSocket(socketService.socket);
        }
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
    try {
      const hasInjected = typeof window !== 'undefined' && window.ethereum;
      let provider = window.ethereum;

      if (!hasInjected) {
        if (!WALLETCONNECT_PROJECT_ID) {
          throw new Error('WalletConnect is not configured. Please set VITE_WALLETCONNECT_PROJECT_ID.');
        }

        if (!walletConnectProvider) {
          walletConnectProvider = await EthereumProvider.init({
            projectId: WALLETCONNECT_PROJECT_ID,
            chains: [1],
            optionalChains: [1],
            showQrModal: true,
            methods: ['eth_requestAccounts', 'personal_sign'],
            events: ['accountsChanged', 'chainChanged', 'disconnect'],
            metadata: {
              name: 'Hyve Social',
              description: 'Hyve Social - Decentralized Social Media',
              url: window.location.origin,
              icons: [`${window.location.origin}/vite.svg`]
            }
          });
        }

        provider = walletConnectProvider;
        if (!provider.connected) {
          await provider.connect();
        }
      }

      const accounts = await provider.request({
        method: 'eth_requestAccounts'
      });

      const address = accounts[0];
      console.log('Connected address:', address);

      // Get nonce from backend
      const nonceResponse = await fetch(`${API_URL}/api/auth/nonce/${address}`);
      const { nonce } = await nonceResponse.json();
      console.log('Got nonce:', nonce);

      // Sign the nonce
      const signature = await provider.request({
        method: 'personal_sign',
        params: [nonce, address]
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
      if (data.user.walletAddress) {
        socketService.connect(data.user.walletAddress);
        setSocket(socketService.socket);
      }
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
      if (data.user.walletAddress) {
        socketService.connect(data.user.walletAddress);
        setSocket(socketService.socket);
      }
    }
    
    return data;
  }

  function logout() {
    localStorage.removeItem('token');
    setUser(null);
    socketService.disconnect();
    setSocket(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, checkAuth, connectWallet, socket }}>
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