const API_URL = import.meta.env.VITE_API_URL || 'https://social-api.hyvechain.com';
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL;
const WALLETCONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';

export { API_URL, SOCKET_URL, WALLETCONNECT_PROJECT_ID };
