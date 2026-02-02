// src/components/Layout/Layout.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Chat from '../Chat/Chat';
import ChatWindow from '../Chat/ChatWindow';
import api from '../../services/api';
import './Layout.css';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [postCount, setPostCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);
  const [isLightMode, setIsLightMode] = useState(() => localStorage.getItem('theme') === 'light');

  function profilePathFor(userObj) {
    const handle = userObj?.username || userObj?.user?.username;
    return handle ? `/profile/${encodeURIComponent(handle)}` : '/profile/unknown';
  }

  function getUserAddress(userObj) {
    return userObj?.wallet_address || userObj?.walletAddress || userObj?.address;
  }

  function getUserHandle(userObj) {
    return (userObj?.username || userObj?.user?.username || '').toLowerCase();
  }

  useEffect(() => {
    loadSuggestedUsers();
    loadUserStats();
  }, [user]);

  useEffect(() => {
    document.body.classList.toggle('light-mode', isLightMode);
    localStorage.setItem('theme', isLightMode ? 'light' : 'dark');
  }, [isLightMode]);

  useEffect(() => {
    function handleOpenChat(event) {
      if (!event?.detail) return;
      setSelectedChat(event.detail);
      setShowChat(false);
    }

    window.addEventListener('open-chat', handleOpenChat);
    return () => window.removeEventListener('open-chat', handleOpenChat);
  }, []);

  async function loadSuggestedUsers() {
    try {
      // Check if getUsers function exists
      if (!api.getUsers) {
        console.log('getUsers not available');
        return;
      }
      
      const data = await api.getUsers();
      const friendsData = api.getFriends ? await api.getFriends() : { friends: [] };
      const blockedData = api.getBlockedUsers ? await api.getBlockedUsers() : { blocked: [] };
      const friendList = friendsData.friends || friendsData || [];
      const blockedList = blockedData.blocked || blockedData.users || blockedData || [];
      const friendAddressSet = new Set(friendList.map(getUserAddress).filter(Boolean));
      const friendHandleSet = new Set(friendList.map(getUserHandle).filter(Boolean));
      const blockedAddressSet = new Set(blockedList.map(getUserAddress).filter(Boolean));
      const blockedHandleSet = new Set(blockedList.map(getUserHandle).filter(Boolean));
      
      if (!data || !data.users) {
        return;
      }
      
      // Filter out current user and get random 5
      const others = data.users.filter(u => {
        const address = getUserAddress(u);
        const handle = getUserHandle(u);
        if (address && address === user?.walletAddress) return false;
        if (address && friendAddressSet.has(address)) return false;
        if (handle && friendHandleSet.has(handle)) return false;
        if (address && blockedAddressSet.has(address)) return false;
        if (handle && blockedHandleSet.has(handle)) return false;
        return true;
      });
      const random = others.sort(() => 0.5 - Math.random()).slice(0, 5);
      setSuggestedUsers(random);
    } catch (error) {
      console.error('Load suggested users error:', error);
      // Don't block the app if this fails
    }
  }

  async function loadUserStats() {
    if (!user?.walletAddress) return;
    
    try {
      // Load post count
      if (api.getUserPosts) {
        const postsData = await api.getUserPosts(user.walletAddress);
        setPostCount(postsData.posts?.length || 0);
      }
      
      // Load friend count
      if (api.getFollowing) {
        const friendsData = await api.getFollowing();
        setFriendCount(friendsData.following?.length || 0);
      }
    } catch (error) {
      console.error('Load user stats error:', error);
    }
  }

  async function handleSearch(query) {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setShowSearchResults(false);
      return;
    }

    try {
      if (!api.searchUsers) {
        console.log('searchUsers not available');
        return;
      }
      
      const data = await api.searchUsers(query);
      setSearchResults(data.users || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
  }

  function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
      logout();
      navigate('/login');
    }
  }

  function handleChatSelect(conversation) {
    setSelectedChat(conversation);
    setShowChat(false);
  }

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">Hyve Social</span>
        </div>

        <div className="search-box">
          <input 
            type="text" 
            placeholder="Search users..." 
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchQuery && setShowSearchResults(true)}
          />
          
          {showSearchResults && (
            <div className="search-dropdown">
              {searchResults.length === 0 ? (
                <div className="search-empty">No users found</div>
              ) : (
                searchResults.map(user => (
                  <Link 
                    key={user.wallet_address}
                    to={profilePathFor(user)}
                    className="search-result"
                    onClick={() => setShowSearchResults(false)}
                  >
                    {user.profile_image ? (
                      <img src={user.profile_image} alt={user.username} className="search-avatar" />
                    ) : (
                      <div className="search-avatar">
                        {user.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <span>{user.username}</span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>

        <div className="header-actions">
          <button
            className="light-toggle-btn"
            onClick={() => setIsLightMode((prev) => !prev)}
            aria-label="Toggle light mode"
            title={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {isLightMode ? '🌙 Dark' : '🌞 Light'}
          </button>
          <button className="icon-btn">🔔</button>
        </div>
      </header>

      {/* Body */}
      <div className="page-body">
        {/* Left Sidebar */}
        <aside className="left-column">
          <div className="profile-card">
            {user?.profileImage ? (
              <img src={user.profileImage} alt={user.username} className="profile-avatar" />
            ) : (
              <div className="profile-avatar">
                {user?.username?.charAt(0).toUpperCase() || '?'}
              </div>
            )}
            <div className="profile-details">
              <h3>{user?.username || 'User'}</h3>
            </div>
            <button className="disconnect-btn" onClick={handleLogout}>
              Disconnect Wallet
            </button>
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
            <Link to="/profile/me" className="nav-item">
              <span className="nav-icon">👤</span>
              <span>My Profile</span>
            </Link>
            <Link to="/friends" className="nav-item">
              <span className="nav-icon">👥</span>
              <span>Friends</span>
            </Link>
            <Link to="/discover" className="nav-item">
              <span className="nav-icon">🔍</span>
              <span>Discover</span>
            </Link>
          </nav>

          <div className="stats-section">
            <div className="stat-item">
              <h4>YOUR POSTS</h4>
              <div className="stat-num">{postCount}</div>
            </div>
            <div className="stat-item">
              <h4>FRIENDS</h4>
              <div className="stat-num">{friendCount}</div>
            </div>
          </div>

          <div className="friends-section">
            <h4>FRIENDS</h4>
            <p className="empty-msg">No friends yet. Start following users!</p>
          </div>
        </aside>

        {/* Center Content */}
        <main className="center-column">
          {children}
        </main>

        {/* Right Sidebar */}
        <aside className="right-column">
          <div className="widget suggestions">
            <h3>Suggested Users</h3>
            {suggestedUsers.length === 0 ? (
              <p className="loading">No suggestions</p>
            ) : (
              <div className="suggested-list">
                {suggestedUsers.map(suggestedUser => (
                  <Link 
                    key={suggestedUser.wallet_address}
                    to={profilePathFor(suggestedUser)}
                    className="suggested-user"
                  >
                    {suggestedUser.profile_image ? (
                      <img src={suggestedUser.profile_image} alt={suggestedUser.username} className="suggested-avatar" />
                    ) : (
                      <div className="suggested-avatar">
                        {suggestedUser.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <span className="suggested-name">{suggestedUser.username}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Chat Button */}
          <button className="chat-fab-bottom" onClick={() => setShowChat(!showChat)}>
            💬
          </button>
        </aside>
      </div>

      {/* Chat List Popup */}
      {showChat && (
        <div className="chat-list-popup">
          <div className="chat-list-header">
            <h3>💬 Messages</h3>
            <button className="close-chat" onClick={() => setShowChat(false)}>✕</button>
          </div>
          <div className="chat-list-body">
            <Chat onSelectChat={handleChatSelect} />
          </div>
        </div>
      )}

      {/* Individual Chat Window */}
      {selectedChat && (
        <div className="chat-window-popup">
          <ChatWindow conversation={selectedChat} onClose={() => setSelectedChat(null)} />
        </div>
      )}

      {/* Footer */}
      <footer className="page-footer">
        <div className="footer-links">
          <a href="#">About</a>
          <a href="#">Help</a>
          <a href="#">Terms</a>
          <a href="#">Privacy</a>
        </div>
        <p className="copyright">© 2026 Hyve Social</p>
      </footer>
    </div>
  );
}