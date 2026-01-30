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

  function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  }

  return (
    <div className="app-wrapper">
      {/* Left Sidebar */}
      <aside className="left-sidebar">
        <div className="sidebar-content">
          <div className="wallet-card">
            <div className="wallet-avatar">
              {user?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="wallet-info">
              <h3>Connect Wallet</h3>
              <p>Connect your wallet to get started<br/>Now connected!</p>
            </div>
          </div>

          <nav className="sidebar-nav">
            <Link to="/" className={location.pathname === '/' ? 'nav-link active' : 'nav-link'}>
              <span className="nav-icon">📰</span>
              <span>Feed</span>
            </Link>

            <Link to="/videos" className="nav-link">
              <span className="nav-icon">🎥</span>
              <span>Videos</span>
            </Link>

            <Link to={`/profile/${user?.walletAddress}`} className="nav-link">
              <span className="nav-icon">👤</span>
              <span>My Profile</span>
            </Link>

            <Link to="/friends" className="nav-link">
              <span className="nav-icon">👥</span>
              <span>Friends</span>
              <span className="badge">0</span>
            </Link>

            <Link to="/discover" className="nav-link">
              <span className="nav-icon">🔍</span>
              <span>Discover</span>
            </Link>
          </nav>

          <div className="sidebar-stats">
            <div className="stat-group">
              <h4>YOUR POSTS</h4>
              <div className="stat-value">0</div>
            </div>
            
            <div className="stat-group">
              <h4>FRIENDS</h4>
              <div className="stat-value">0</div>
            </div>
          </div>

          <div className="sidebar-friends">
            <h4>FRIENDS</h4>
            <p className="empty-text">No friends yet. Start following users!</p>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="main-area">
        {/* Header */}
        <header className="app-header">
          <div className="header-left">
            <div className="logo">
              <span className="logo-icon">⚡</span>
              <span className="logo-text">Hyve Social</span>
            </div>
          </div>

          <div className="header-center">
            <input type="text" placeholder="Search users..." className="search-input" />
          </div>

          <div className="header-right">
            <button className="icon-btn">🔔</button>
            <button className="icon-btn">💬</button>
            
            <div className="user-menu-wrapper">
              <button className="user-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                <div className="user-avatar-small">
                  {user?.username?.charAt(0).toUpperCase() || '?'}
                </div>
              </button>

              {showUserMenu && (
                <div className="dropdown-menu">
                  <Link to={`/profile/${user?.walletAddress}`} onClick={() => setShowUserMenu(false)}>
                    My Profile
                  </Link>
                  <button onClick={handleLogout}>
                    Disconnect Wallet
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Content with Right Sidebar */}
        <div className="content-wrapper">
          <main className="main-content">
            {children}
          </main>

          <aside className="right-sidebar">
            <div className="suggestions-widget">
              <h3>Suggested Users</h3>
              <p className="loading-text">Loading users...</p>
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer className="app-footer">
          <div className="footer-links">
            <a href="#">About</a>
            <a href="#">Help</a>
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
          </div>
          <p className="copyright">© 2026 Hyve Social</p>
        </footer>
      </div>
    </div>
  );
}