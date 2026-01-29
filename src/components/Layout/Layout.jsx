// src/components/Layout/Layout.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import './Layout.css';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    if (searchQuery.trim()) {
      // TODO: Implement search
      console.log('Searching for:', searchQuery);
    }
  }

  return (
    <div className="app-layout">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <Link to="/" className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">HyveSocial</span>
          </Link>

          <form className="search-bar" onSubmit={handleSearch}>
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit">
              🔍
            </button>
          </form>

          <div className="header-actions">
            <Link to="/" className={location.pathname === '/' ? 'active' : ''}>
              🏠 Home
            </Link>
            <Link to={`/profile/${user?.walletAddress}`} 
                  className={location.pathname.includes('/profile') ? 'active' : ''}>
              👤 Profile
            </Link>
            <Link to="/chat" className={location.pathname === '/chat' ? 'active' : ''}>
              💬 Chat
            </Link>

            <div className="user-menu">
              <button 
                className="user-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
              >
                <span className="user-avatar">
                  {user?.username?.charAt(0).toUpperCase() || '?'}
                </span>
                <span className="user-name">{user?.username}</span>
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
                  <Link to={`/profile/${user?.walletAddress}`} onClick={() => setShowUserMenu(false)}>
                    My Profile
                  </Link>
                  <button onClick={handleLogout}>
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="app-main">
        <div className="content-container">
          {children}
        </div>
      </main>
    </div>
  );
}
