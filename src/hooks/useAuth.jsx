import { createContext, useContext, useState, useEffect } from 'react';
import EthereumProvider from '@walletconnect/ethereum-provider';
import api from '../services/api';
import socketService from '../services/socket';
import { API_URL, WALLETCONNECT_PROJECT_ID } from '../utils/env';

const AuthContext = createContext(null);
let walletConnectProvider;

// Hyve Chain Configuration
const HYVE_CHAIN = {
  chainId: '0x23F0', // 9200 in hex
  chainIdDecimal: 9200,
  chainName: 'Hyve Network',
  nativeCurrency: {
    name: 'HYVE',
    symbol: 'HYVE',
    decimals: 18
  },
  rpcUrls: ['https://rpc.hyvechain.com'],
  blockExplorerUrls: ['https://explorer.hyvechain.com']
};

// Function to switch to Hyve chain
async function switchToHyveChain(provider) {
  try {
    // Try to switch to the Hyve chain
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: HYVE_CHAIN.chainId }]
    });
    console.log('Switched to Hyve chain');
    return true;
  } catch (switchError) {
    // If chain doesn't exist in wallet, add it
    if (switchError.code === 4902 || switchError.message?.includes('Unrecognized chain')) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: HYVE_CHAIN.chainId,
            chainName: HYVE_CHAIN.chainName,
            nativeCurrency: HYVE_CHAIN.nativeCurrency,
            rpcUrls: HYVE_CHAIN.rpcUrls,
            blockExplorerUrls: HYVE_CHAIN.blockExplorerUrls
          }]
        });
        console.log('Added and switched to Hyve chain');
        return true;
      } catch (addError) {
        console.error('Failed to add Hyve chain:', addError);
        throw new Error('Please add Hyve Network to your wallet manually');
      }
    }
    // User rejected the switch
    if (switchError.code === 4001) {
      throw new Error('Please switch to Hyve Network to use this app');
    }
    console.error('Failed to switch chain:', switchError);
    throw switchError;
  }
}

// Function to check if on correct chain
async function ensureCorrectChain(provider) {
  try {
    const chainId = await provider.request({ method: 'eth_chainId' });
    const currentChainId = parseInt(chainId, 16);
    
    console.log('Current chain ID:', currentChainId, 'Expected:', HYVE_CHAIN.chainIdDecimal);
    
    if (currentChainId !== HYVE_CHAIN.chainIdDecimal) {
      console.log('Wrong chain detected, switching to Hyve...');
      await switchToHyveChain(provider);
    }
    return true;
  } catch (error) {
    console.error('Chain check error:', error);
    throw error;
  }
}

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
        const socketUser = data.user.username || data.user.handle;
        if (socketUser) {
          socketService.connect(socketUser);
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
            chains: [HYVE_CHAIN.chainIdDecimal],
            optionalChains: [HYVE_CHAIN.chainIdDecimal, 1, 56], // Hyve, Ethereum, BSC
            showQrModal: true,
            methods: ['eth_requestAccounts', 'personal_sign', 'wallet_switchEthereumChain', 'wallet_addEthereumChain'],
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

      // Ensure user is on the correct chain (Hyve Network)
      await ensureCorrectChain(provider);

      // Get nonce from backend
      const nonceResponse = await fetch(`${API_URL}/api/auth/nonce/${address}`);
      const { nonce } = await nonceResponse.json();

      // Sign the nonce
      const signature = await provider.request({
        method: 'personal_sign',
        params: [nonce, address]
      });

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
      const socketUser = data.user.username || data.user.handle;
      if (socketUser) {
        socketService.connect(socketUser);
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
      const socketUser = data.user.username || data.user.handle;
      if (socketUser) {
        socketService.connect(socketUser);
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
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout, checkAuth, connectWallet, socket }}>
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