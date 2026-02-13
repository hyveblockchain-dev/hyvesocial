// src/components/Email/Webmail.jsx
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import emailApi from '../../services/emailApi';
import api from '../../services/api';
import ComposeEmail from './ComposeEmail';
import EmailView from './EmailView';
import {
  IconInbox, IconSend, IconTrash, IconSearch, IconEdit,
  IconMailbox, IconClose, IconCheck, IconArrowLeft,
  IconLogout, IconFilter
} from '../Icons/Icons';
import './Webmail.css';

function IconDraft(props) {
  const size = props.size || 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function IconSpam(props) {
  const size = props.size || 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function IconStar(props) {
  const size = props.size || 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={props.filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function IconRefresh(props) {
  const size = props.size || 20;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

const FOLDERS = [
  { id: 'inbox', label: 'Inbox', icon: IconInbox },
  { id: 'sent', label: 'Sent', icon: IconSend },
  { id: 'drafts', label: 'Drafts', icon: IconDraft },
  { id: 'starred', label: 'Starred', icon: IconStar },
  { id: 'spam', label: 'Spam', icon: IconSpam },
  { id: 'trash', label: 'Trash', icon: IconTrash },
];

export default function Webmail() {
  const navigate = useNavigate();
  const [currentFolder, setCurrentFolder] = useState('inbox');
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [unreadCounts, setUnreadCounts] = useState({});
  const [account, setAccount] = useState(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState(new Set());
  const [replyTo, setReplyTo] = useState(null);
  const [suggestedUsers, setSuggestedUsers] = useState([]);

  // Load account info + suggested users
  useEffect(() => {
    loadAccount();
    loadSuggestedUsers();
  }, []);

  // Load messages when folder changes
  useEffect(() => {
    loadMessages();
  }, [currentFolder]);

  async function loadAccount() {
    try {
      const data = await emailApi.getEmailAccount();
      setAccount(data.account);
    } catch (err) {
      // If not logged into email, redirect to email login
      if (!localStorage.getItem('email_token')) {
        navigate('/email/login');
        return;
      }
      console.error('Failed to load email account:', err);
    }
  }

  async function loadSuggestedUsers() {
    try {
      if (!api.getUsers) return;
      const data = await api.getUsers();
      if (!data?.users) return;
      const random = data.users.sort(() => 0.5 - Math.random()).slice(0, 5);
      setSuggestedUsers(random);
    } catch { /* silent */ }
  }

  async function loadMessages() {
    setLoading(true);
    setError('');
    try {
      const data = await emailApi.getMessages(currentFolder);
      setMessages(data.messages || []);
      // Also refresh unread counts
      try {
        const counts = await emailApi.getUnreadCounts();
        setUnreadCounts(counts);
      } catch (e) {
        // ignore
      }
    } catch (err) {
      setError(err.message || 'Failed to load messages');
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    await loadMessages();
  }

  async function handleMarkRead(messageId, read = true) {
    try {
      await emailApi.markMessage(messageId, read);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, read } : m))
      );
    } catch (err) {
      console.error('Failed to mark message:', err);
    }
  }

  async function handleStar(messageId, starred) {
    try {
      await emailApi.starMessage(messageId, starred);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, starred } : m))
      );
    } catch (err) {
      console.error('Failed to star message:', err);
    }
  }

  async function handleMoveToTrash(messageId) {
    try {
      await emailApi.moveMessage(messageId, 'trash');
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      if (selectedMessage?.id === messageId) setSelectedMessage(null);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  }

  async function handleDelete(messageId) {
    try {
      await emailApi.deleteMessage(messageId);
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
      if (selectedMessage?.id === messageId) setSelectedMessage(null);
    } catch (err) {
      console.error('Failed to delete message:', err);
    }
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      loadMessages();
      return;
    }
    setLoading(true);
    try {
      const data = await emailApi.searchEmails(searchQuery, currentFolder);
      setMessages(data.messages || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOpenMessage(message) {
    // Fetch full message content from API
    try {
      const fullMsg = await emailApi.getMessage(message.id, currentFolder);
      setSelectedMessage(fullMsg);
    } catch (err) {
      console.error('Failed to load message:', err);
      // Fallback to list data
      setSelectedMessage(message);
    }
    if (!message.read) {
      handleMarkRead(message.id, true);
    }
  }

  function handleReply(message) {
    setReplyTo(message);
    setShowCompose(true);
  }

  function handleComposeSent() {
    setShowCompose(false);
    setReplyTo(null);
    if (currentFolder === 'sent') {
      loadMessages();
    }
  }

  function handleEmailLogout() {
    localStorage.removeItem('email_token');
    navigate('/email/login');
  }

  function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const oneDay = 86400000;

    if (diff < oneDay && date.getDate() === now.getDate()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 7 * oneDay) {
      return date.toLocaleDateString([], { weekday: 'short' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function getInitials(name) {
    if (!name) return '?';
    return name
      .split(/[\s@]+/)
      .map((w) => w[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  }

  function getAvatarColor(email) {
    let hash = 0;
    for (let i = 0; i < (email || '').length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 45%)`;
  }

  // Compose overlay
  if (showCompose) {
    return (
      <ComposeEmail
        account={account}
        replyTo={replyTo}
        onClose={() => { setShowCompose(false); setReplyTo(null); }}
        onSent={handleComposeSent}
      />
    );
  }

  // Message detail view
  if (selectedMessage) {
    return (
      <EmailView
        message={selectedMessage}
        folder={currentFolder}
        onBack={() => setSelectedMessage(null)}
        onReply={handleReply}
        onDelete={() => handleMoveToTrash(selectedMessage.id)}
        onStar={(starred) => handleStar(selectedMessage.id, starred)}
        formatDate={formatDate}
        getInitials={getInitials}
        getAvatarColor={getAvatarColor}
      />
    );
  }

  return (
    <div className="webmail">
      {/* Header */}
      <header className="webmail-header">
        <div className="webmail-header-left">
          <button className="sidebar-toggle" onClick={() => setShowSidebar(!showSidebar)}>
            <IconMailbox size={20} />
          </button>
          <Link to="/email" className="webmail-logo">
            <img src="/hyvelogo.png" alt="Hyve" className="webmail-logo-img" />
            <span className="webmail-logo-text">HyveMail</span>
          </Link>
        </div>
        <form className="webmail-header-search" onSubmit={handleSearch}>
          <input
            type="text"
            placeholder="Search emails..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              type="button"
              className="search-clear"
              onClick={() => {
                setSearchQuery('');
                loadMessages();
              }}
            >
              <IconClose size={14} />
            </button>
          )}
        </form>
        <div className="webmail-header-right">
          <button className="webmail-header-btn" onClick={handleRefresh} title="Refresh">
            <IconRefresh size={18} />
          </button>
          <Link to="/" className="webmail-header-btn" title="Hyve Social">
            <IconMailbox size={18} />
          </Link>
        </div>
      </header>

      {/* Sidebar */}
      <aside className={`webmail-sidebar ${showSidebar ? 'show' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <img src="/hyvelogo.png" alt="Hyve" className="sidebar-logo" />
            <span>HyveMail</span>
          </div>
          <button className="sidebar-close" onClick={() => setShowSidebar(false)}>
            <IconClose size={18} />
          </button>
        </div>

        <button className="compose-btn" onClick={() => setShowCompose(true)}>
          <IconEdit size={18} />
          Compose
        </button>

        <nav className="folder-list">
          {FOLDERS.map((folder) => {
            const FolderIcon = folder.icon;
            const count = unreadCounts[folder.id] || 0;
            return (
              <button
                key={folder.id}
                className={`folder-item ${currentFolder === folder.id ? 'active' : ''}`}
                onClick={() => {
                  setCurrentFolder(folder.id);
                  setSelectedMessage(null);
                  setShowSidebar(false);
                }}
              >
                <FolderIcon size={18} />
                <span className="folder-label">{folder.label}</span>
                {count > 0 && <span className="folder-count">{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          {account && (
            <div className="sidebar-account">
              <div className="sidebar-avatar" style={{ background: getAvatarColor(account.email) }}>
                {getInitials(account.displayName || account.email)}
              </div>
              <div className="sidebar-account-info">
                <span className="sidebar-name">{account.displayName || account.username}</span>
                <span className="sidebar-email">{account.email}</span>
              </div>
            </div>
          )}
          <div className="sidebar-actions">
            <button className="sidebar-action-btn" onClick={async () => {
              // If no social auth token, try to get one from email session
              if (!localStorage.getItem('token')) {
                try {
                  const result = await emailApi.getSocialToken();
                  if (result.socialToken) {
                    localStorage.setItem('token', result.socialToken);
                  }
                } catch (err) {
                  console.warn('Could not get social token:', err);
                }
              }
              // Full page reload to re-initialize AuthProvider with the stored token
              window.location.reload();
            }} title="Go to Hyve Social">
              <IconMailbox size={16} /> Social
            </button>
            <button className="sidebar-action-btn" onClick={handleEmailLogout} title="Sign out of email">
              <IconLogout size={16} /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="webmail-main">
        {/* Folder header */}
        <div className="folder-header">
          <h2>{FOLDERS.find((f) => f.id === currentFolder)?.label || 'Inbox'}</h2>
          <span className="message-count">
            {messages.length} {messages.length === 1 ? 'message' : 'messages'}
          </span>
        </div>

        {/* Messages list */}
        <div className="messages-list">
          {loading ? (
            <div className="messages-loading">
              <div className="email-spinner" />
              <p>Loading messages...</p>
            </div>
          ) : error ? (
            <div className="messages-error">
              <p>{error}</p>
              <button onClick={handleRefresh}>Try Again</button>
            </div>
          ) : messages.length === 0 ? (
            <div className="messages-empty">
              <IconInbox size={48} />
              <h3>No messages</h3>
              <p>
                {currentFolder === 'inbox'
                  ? "Your inbox is empty. Messages you receive will appear here."
                  : `No messages in ${currentFolder}.`}
              </p>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`message-row ${!msg.read ? 'unread' : ''} ${selectedMessages.has(msg.id) ? 'selected' : ''}`}
                onClick={() => handleOpenMessage(msg)}
              >
                <button
                  className={`star-btn ${msg.starred ? 'starred' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleStar(msg.id, !msg.starred);
                  }}
                >
                  <IconStar size={16} filled={msg.starred} />
                </button>
                <div className="message-avatar" style={{ background: getAvatarColor(msg.from) }}>
                  {getInitials(msg.fromName || msg.from)}
                </div>
                <div className="message-content">
                  <div className="message-top">
                    <span className="message-sender">{msg.fromName || msg.from}</span>
                    <span className="message-date">{formatDate(msg.date)}</span>
                  </div>
                  <div className="message-subject">{msg.subject || '(no subject)'}</div>
                  <div className="message-preview">{msg.preview || msg.body?.substring(0, 100)}</div>
                </div>
                <button
                  className="message-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMoveToTrash(msg.id);
                  }}
                  title="Delete"
                >
                  <IconTrash size={16} />
                </button>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Sidebar overlay for mobile */}
      {showSidebar && <div className="sidebar-overlay" onClick={() => setShowSidebar(false)} />}

      {/* Right Sidebar */}
      <aside className="webmail-right">
        <div className="wm-widget">
          <h3>Suggested Users</h3>
          {suggestedUsers.length === 0 ? (
            <p className="wm-empty">No suggestions</p>
          ) : (
            <div className="wm-suggested-list">
              {suggestedUsers.map(u => (
                <Link
                  key={u.username}
                  to={`/profile/${encodeURIComponent(u.username)}`}
                  className="wm-suggested-user"
                >
                  {u.profile_image ? (
                    <img src={u.profile_image} alt={u.username} className="wm-suggested-avatar" />
                  ) : (
                    <div className="wm-suggested-avatar">
                      {u.username?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  <span className="wm-suggested-name">{u.username}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="wm-widget">
          <h3>Quick Links</h3>
          <div className="wm-quick-links">
            <Link to="/">Feed</Link>
            <Link to="/friends">Friends</Link>
            <Link to="/groups">Groups</Link>
            <Link to="/discover">Discover</Link>
          </div>
        </div>
      </aside>

      {/* Footer */}
      <footer className="webmail-footer">
        <p className="wm-copyright">© 2026 Hyve Social</p>
      </footer>
    </div>
  );
}
