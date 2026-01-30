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
    <>
      {/* Fixed Header - Full Width */}
      <header className="top-header">
        <div className="header-container">
          <div className="logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">Hyve Social</span>
          </div>

          <div className="search-box">
            <input type="text" placeholder="Search users..." />
          </div>

          <div className="header-actions">
            <button className="icon-btn">🔔</button>
            <button className="icon-btn">💬</button>
            
            <div className="user-menu">
              <button className="user-btn" onClick={() => setShowUserMenu(!showUserMenu)}>
                <div className="avatar-mini">
                  {user?.username?.charAt(0).toUpperCase() || '?'}
                </div>
              </button>

              {showUserMenu && (
                <div className="user-dropdown">
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
        </div>
      </header>

      {/* Main Layout - Between Header and Footer */}
      <div className="layout-body">
        {/* Left Sidebar */}
        <aside className="sidebar-left">
          <div className="wallet-card">
            <div className="wallet-avatar">
              {user?.username?.charAt(0).toUpperCase() || '?'}
            </div>
            <div className="wallet-info">
              <h3>Connect Wallet</h3>
              <p>Connect your wallet to get started<br/>Now connected!</p>
            </div>
          </div>

          <nav className="nav-menu">
            <Link to="/" className={location.pathname === '/' ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon">📰</span>
              <span>Feed</span>
            </Link>

            <Link to="/videos" className="nav-item">
              <span className="nav-icon">🎥</span>
              <span>Videos</span>
            </Link>

            <Link to={`/profile/${user?.walletAddress}`} className="nav-item">
              <span className="nav-icon">👤</span>
              <span>My Profile</span>
            </Link>

            <Link to="/friends" className="nav-item">
              <span className="nav-icon">👥</span>
              <span>Friends</span>
              <span className="badge">0</span>
            </Link>

            <Link to="/discover" className="nav-item">
              <span className="nav-icon">🔍</span>
              <span>Discover</span>
            </Link>
          </nav>

          <div className="stats-section">
            <div className="stat-item">
              <h4>YOUR POSTS</h4>
              <div className="stat-num">0</div>
            </div>
            
            <div className="stat-item">
              <h4>FRIENDS</h4>
              <div className="stat-num">0</div>
            </div>
          </div>

          <div className="friends-section">
            <h4>FRIENDS</h4>
            <p className="empty-msg">No friends yet. Start following users!</p>
          </div>
        </aside>

        {/* Main Content - Scrollable */}
        <main className="content-area">
          {children}
        </main>

        {/* Right Sidebar */}
        <aside className="sidebar-right">
          <div className="widget">
            <h3>Suggested Users</h3>
            <p className="loading">Loading users...</p>
          </div>
        </aside>
      </div>

      {/* Fixed Footer - Full Width */}
      <footer className="bottom-footer">
        <div className="footer-content">
          <div className="footer-links">
            <a href="#">About</a>
            <a href="#">Help</a>
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
          </div>
          <p className="copyright">© 2026 Hyve Social</p>
        </div>
      </footer>
    </>
  );
}