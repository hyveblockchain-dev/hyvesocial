// src/components/Layout/Layout.jsx
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import Chat from '../Chat/Chat';
import ChatWindow from '../Chat/ChatWindow';
import api from '../../services/api';
import { normalizeNotification } from '../../utils/notifications';
import {
  IconSearch, IconLogout, IconMoon, IconSun, IconBell,
  IconFeed, IconUser, IconUsers, IconChat, IconClose,
  IconGroup, IconDiscover, IconShield, IconMailbox
} from '../Icons/Icons';
import './Layout.css';

export default function Layout({ children }) {
  const { user, logout, socket } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [selectedChat, setSelectedChat] = useState(null);
  const [showNotificationsMenu, setShowNotificationsMenu] = useState(false);
  const [notificationItems, setNotificationItems] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [postCount, setPostCount] = useState(0);
  const [friendCount, setFriendCount] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);
  const [friendsList, setFriendsList] = useState([]);
  const [presenceMap, setPresenceMap] = useState({});
  const [onlineFriends, setOnlineFriends] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [isLightMode, setIsLightMode] = useState(() => localStorage.getItem('theme') === 'light');
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState({});

  const READ_NOTIFICATIONS_KEY = 'read_notifications';
  const RECENT_NOTIFICATIONS_KEY = 'recent_notifications';
  const unreadMessagesKey = user?.username
    ? `unread_messages_${String(user.username).toLowerCase()}`
    : 'unread_messages';

  function getReadNotifications() {
    try {
      const stored = localStorage.getItem(READ_NOTIFICATIONS_KEY);
      return new Set(stored ? JSON.parse(stored) : []);
    } catch (error) {
      return new Set();
    }
  }

  function markNotificationRead(id) {
    const current = getReadNotifications();
    current.add(id);
    localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify([...current]));
  }

  function getRecentNotifications() {
    try {
      const stored = localStorage.getItem(RECENT_NOTIFICATIONS_KEY);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function saveRecentNotifications(list) {
    const trimmed = Array.isArray(list) ? list.slice(0, 20) : [];
    localStorage.setItem(RECENT_NOTIFICATIONS_KEY, JSON.stringify(trimmed));
    setNotificationItems(trimmed);
  }

  function persistNotificationItems(updater) {
    setNotificationItems((prev) => {
      const next = typeof updater === 'function' ? updater(prev || []) : updater;
      const trimmed = Array.isArray(next) ? next.slice(0, 20) : [];
      localStorage.setItem(RECENT_NOTIFICATIONS_KEY, JSON.stringify(trimmed));
      return trimmed;
    });
  }

  function upsertRecentNotification(entry) {
    if (!entry?.id) return;
    setNotificationItems((prev) => {
      const existing = prev || [];
      const filtered = existing.filter((item) => item?.id !== entry.id);
      const next = [entry, ...filtered].slice(0, 20);
      localStorage.setItem(RECENT_NOTIFICATIONS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function getUnreadCount() {
    const read = getReadNotifications();
    return notificationItems.filter((item) => item?.id && !read.has(item.id)).length;
  }

  function loadUnreadMessages(key = unreadMessagesKey) {
    try {
      const stored = localStorage.getItem(key);
      const parsed = stored ? JSON.parse(stored) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (error) {
      return {};
    }
  }

  function saveUnreadMessages(next, key = unreadMessagesKey) {
    localStorage.setItem(key, JSON.stringify(next));
    setUnreadMessages(next);
  }

  function getUnreadMessageCount() {
    return Object.values(unreadMessages || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  }

  function bumpUnreadFor(username) {
    if (!username) return;
    const key = String(username).toLowerCase();
    saveUnreadMessages({
      ...(unreadMessages || {}),
      [key]: Number(unreadMessages?.[key] || 0) + 1
    });
  }

  function clearUnreadFor(username) {
    if (!username) return;
    const key = String(username).toLowerCase();
    const next = { ...(unreadMessages || {}) };
    delete next[key];
    saveUnreadMessages(next);
  }

  function profilePathFor(userObj) {
    const handle = userObj?.username || userObj?.user?.username;
    return handle ? `/profile/${encodeURIComponent(handle)}` : '/profile/unknown';
  }

  function getUserHandle(userObj) {
    return (userObj?.username || userObj?.user?.username || '').toLowerCase();
  }

  function getActivityLabel(item) {
    switch (item.type) {
      case 'post_comment':
        return 'commented on your post';
      case 'comment_reply':
        return 'replied to your comment';
      case 'reaction':
        return 'reacted to your post';
      case 'follow':
        return 'started following you';
      default:
        return 'sent you a notification';
    }
  }

  function notificationTargetPath(item, fallbackUser) {
    if (!item) return '/';
    if (item.type === 'friend_request') {
      return profilePathFor(item.request || fallbackUser || item.user);
    }
    if (item.type === 'friend_accepted') {
      return profilePathFor(item.user || fallbackUser);
    }

    const postId = item.postId || item.post_id || item.raw?.postId || item.raw?.post_id;
    const commentId = item.commentId || item.comment_id || item.raw?.commentId || item.raw?.comment_id;
    const parentCommentId =
      item.parentCommentId || item.parent_comment_id || item.raw?.parentCommentId || item.raw?.parent_comment_id;

    if (postId) {
      const params = new URLSearchParams();
      params.set('postId', String(postId));
      if (commentId) params.set('commentId', String(commentId));
      if (parentCommentId) params.set('parentCommentId', String(parentCommentId));
      return `/?${params.toString()}`;
    }

    return profilePathFor(fallbackUser || item.user || item.request);
  }

  useEffect(() => {
    loadSuggestedUsers();
    loadUserStats();
    loadOnlineFriends();
    loadNotifications();
    loadBlockedUsers();
    setNotificationItems(getRecentNotifications());
    // Check admin status
    api.checkIsAdmin().then(admin => setIsAdmin(admin)).catch(() => {});
  }, [user]);

  useEffect(() => {
    setUnreadMessages(loadUnreadMessages());
  }, [unreadMessagesKey]);

  useEffect(() => {
    if (!socket) return;

    const handleFriendRequest = () => {
      loadNotifications();
    };

    const handlePresenceUpdate = (payload) => {
      const username = payload?.username;
      if (!username) return;
      const key = username.toLowerCase();

      setPresenceMap((prev) => ({
        ...prev,
        [key]: {
          username,
          online: payload?.status === 'online',
          lastSeen: payload?.lastSeen || prev?.[key]?.lastSeen || null
        }
      }));
    };

    socket.on('friend_request', handleFriendRequest);
    socket.on('presence:update', handlePresenceUpdate);

    return () => {
      socket.off('friend_request', handleFriendRequest);
      socket.off('presence:update', handlePresenceUpdate);
    };
  }, [socket]);

  useEffect(() => {
    if (!socket || !user?.username) return;

    const currentHandle = String(user.username).toLowerCase();
    const handleMessage = (message) => {
      const fromUsername =
        message?.from_username ||
        message?.fromUsername ||
        message?.sender_username ||
        message?.from ||
        message?.sender ||
        message?.username ||
        '';
      const toUsername =
        message?.to_username ||
        message?.toUsername ||
        message?.recipient_username ||
        message?.to ||
        message?.recipient ||
        '';

      if (String(toUsername).toLowerCase() !== currentHandle) return;

      const fromHandle = String(fromUsername || '').toLowerCase();
      const activeHandle = String(selectedChat?.username || selectedChat?.handle || '').toLowerCase();
      if (activeHandle && activeHandle === fromHandle) {
        clearUnreadFor(fromHandle);
        return;
      }

      bumpUnreadFor(fromHandle || 'unknown');
    };

    socket.on('new_message', handleMessage);
    return () => socket.off('new_message', handleMessage);
  }, [socket, user, selectedChat, unreadMessages]);

  useEffect(() => {
    if (!socket || !user?.username) return;

    const currentHandle = String(user.username || '').toLowerCase();
    const events = [
      'notification',
      'new_notification',
      'post_comment',
      'comment',
      'comment_created',
      'reply',
      'reply_created',
      'comment_reply',
      'post_reply',
      'post_reaction',
      'comment_reaction',
      'reaction',
      'follow'
    ];

    const handlers = events.map((eventName) => {
      const handler = (payload) => {
        const normalized = normalizeNotification(payload, eventName);
        if (!normalized) return;

        const actorHandle =
          (normalized.user?.username || normalized.user?.user?.username || '').toLowerCase();
        if (actorHandle && actorHandle === currentHandle) return;

        const recipient = normalized.recipient ? String(normalized.recipient).toLowerCase() : '';
        if (recipient && recipient !== currentHandle) return;

        const read = getReadNotifications();
        if (read.has(normalized.id)) return;

        upsertRecentNotification(normalized);
      };

      socket.on(eventName, handler);
      return { eventName, handler };
    });

    return () => {
      handlers.forEach(({ eventName, handler }) => socket.off(eventName, handler));
    };
  }, [socket, user]);

  useEffect(() => {
    if (!friendsList.length) {
      setOnlineFriends([]);
      return;
    }
    const nextOnline = friendsList.filter((friend) => {
      const handle = getUserHandle(friend);
      return handle && presenceMap[handle]?.online;
    });
    setOnlineFriends(nextOnline);
  }, [friendsList, presenceMap]);

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

  useEffect(() => {
    setShowChat(false);
    setSelectedChat(null);
  }, [location.pathname]);

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
      const blockedList = blockedData.blocks || blockedData.blocked || blockedData.users || [];
      const friendHandleSet = new Set(friendList.map(getUserHandle).filter(Boolean));
      const blockedHandleSet = new Set(Array.isArray(blockedList) ? blockedList.map(getUserHandle).filter(Boolean) : []);
      
      if (!data || !data.users) {
        return;
      }
      
      // Filter out current user and get random 5
      const others = data.users.filter(u => {
        const handle = getUserHandle(u);
        if (handle && handle === user?.username?.toLowerCase?.()) return false;
        if (handle && friendHandleSet.has(handle)) return false;
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

  async function loadBlockedUsers() {
    if (!api.getBlockedUsers) {
      setBlockedUsers([]);
      return;
    }
    try {
      const data = await api.getBlockedUsers();
      const blockedList = data.blocks || data.blocked || data.users || data || [];
      setBlockedUsers(Array.isArray(blockedList) ? blockedList : []);
    } catch (error) {
      console.error('Load blocked users error:', error);
      setBlockedUsers([]);
    }
  }

  async function loadUserStats() {
    if (!user?.username) return;
    
    try {
      // Load post count
      if (api.getUserPosts) {
        const postsData = await api.getUserPosts(user.username);
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

  async function loadOnlineFriends() {
    if (!api.getFriends) return;
    try {
      const [friendsData, presenceData, blockedData] = await Promise.all([
        api.getFriends(),
        api.getPresence ? api.getPresence() : Promise.resolve({ presence: [] }),
        api.getBlockedUsers ? api.getBlockedUsers() : Promise.resolve({ blocked: [] })
      ]);
      const friends = friendsData.friends || friendsData || [];
      const blockedList = blockedData.blocks || blockedData.blocked || blockedData.users || blockedData || [];
      const blockedHandleSet = new Set(
        (Array.isArray(blockedList) ? blockedList : [])
          .map(getUserHandle)
          .filter(Boolean)
      );
      const filteredFriends = friends.filter((friend) => {
        const handle = getUserHandle(friend);
        if (handle && blockedHandleSet.has(handle)) return false;
        return true;
      });
      const presenceList = presenceData?.presence || [];

      const nextPresence = {};
      presenceList.forEach((entry) => {
        const username = entry?.username;
        if (username) {
          const key = username.toLowerCase();
          nextPresence[key] = {
            username,
            online: !!entry?.online,
            lastSeen: entry?.lastSeen || null
          };
        }
      });

      setFriendsList(filteredFriends);
      setPresenceMap(nextPresence);
    } catch (error) {
      console.error('Load online friends error:', error);
      setFriendsList([]);
      setPresenceMap({});
      setOnlineFriends([]);
    }
  }

  async function loadNotifications() {
    if (!api.getFriendRequests) return;
    try {
      const data = await api.getFriendRequests();
      let blockedList = blockedUsers;
      if (!blockedList.length && api.getBlockedUsers) {
        const blockedData = await api.getBlockedUsers();
        blockedList = blockedData.blocks || blockedData.blocked || blockedData.users || blockedData || [];
      }
      const blockedHandleSet = new Set(
        (Array.isArray(blockedList) ? blockedList : [])
          .map(getUserHandle)
          .filter(Boolean)
      );

      const requests = (data.requests || []).filter((request) => {
        const handle = getUserHandle(request);
        if (handle && blockedHandleSet.has(handle)) return false;
        return true;
      });
      const read = getReadNotifications();
      const unreadRequests = requests.filter((request) => !read.has(`request-${request.id}`));
      const requestNotifications = unreadRequests.map((request) => ({
        id: `request-${request.id}`,
        type: 'friend_request',
        createdAt: request.created_at || new Date().toISOString(),
        request
      }));

      const merged = [...requestNotifications, ...getRecentNotifications()];
      const seen = new Set();
      const deduped = merged.filter((item) => {
        if (!item?.id || seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
      saveRecentNotifications(deduped);
    } catch (error) {
      console.error('Load notifications error:', error);
      setNotificationItems([]);
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
      let blockedList = blockedUsers;
      if (!blockedList.length && api.getBlockedUsers) {
        const blockedData = await api.getBlockedUsers();
        blockedList = blockedData.blocks || blockedData.blocked || blockedData.users || blockedData || [];
      }
      const blockedHandleSet = new Set(
        (Array.isArray(blockedList) ? blockedList : [])
          .map(getUserHandle)
          .filter(Boolean)
      );

      const filteredResults = (data.users || []).filter((candidate) => {
        const handle = getUserHandle(candidate);
        if (handle && blockedHandleSet.has(handle)) return false;
        return true;
      });
      setSearchResults(filteredResults);
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
    if (conversation?.username) {
      clearUnreadFor(conversation.username);
    }
  }

  return (
    <div className="page-container">
      {/* Header */}
      <header className="page-header">
        <Link to="/" className="logo" aria-label="Go to home">
          <img src="/hyvelogo.png" alt="Hyve" className="logo-icon-img" />
          <span className="logo-text">Hyve Social</span>
        </Link>

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
                    key={user.username}
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
            className="icon-btn mobile-search-btn"
            onClick={() => {
              setShowMobileSearch((prev) => !prev);
              setShowNotificationsMenu(false);
              setShowChat(false);
            }}
            aria-label="Search"
            title="Search"
          >
            <IconSearch width={20} height={20} />
          </button>
          <button
            className="icon-btn mobile-disconnect-btn"
            onClick={handleLogout}
            aria-label="Disconnect wallet"
            title="Disconnect wallet"
          >
            <IconLogout width={20} height={20} />
          </button>
          <button
            className="light-toggle-btn"
            onClick={() => setIsLightMode((prev) => !prev)}
            aria-label="Toggle light mode"
            title={isLightMode ? 'Switch to dark mode' : 'Switch to light mode'}
          >
            {isLightMode ? <IconMoon width={20} height={20} /> : <IconSun width={20} height={20} />}
          </button>
          <div className="notification-menu">
            <button
              className="icon-btn"
              onClick={() => {
                setShowNotificationsMenu((prev) => !prev);
                setShowMobileSearch(false);
                setShowChat(false);
              }}
              aria-label="Notifications"
              title="Notifications"
            >
              <IconBell width={20} height={20} />
              {getUnreadCount() > 0 && (
                <span className="notification-badge">
                  {getUnreadCount() > 9 ? '9+' : getUnreadCount()}
                </span>
              )}
            </button>
            {showNotificationsMenu && (
              <div className="notification-dropdown">
                <div className="notification-dropdown-header">
                  <span>Notifications</span>
                  <Link to="/notifications" onClick={() => setShowNotificationsMenu(false)}>
                    View all
                  </Link>
                </div>
                {notificationItems.length === 0 ? (
                  <div className="notification-empty">No new notifications</div>
                ) : (
                  <div className="notification-items">
                    {notificationItems.slice(0, 5).map((item) => {
                      if (item.type === 'friend_request') {
                        const request = item.request;
                        if (!request) return null;
                        return (
                          <div key={item.id} className="notification-item">
                            <Link
                              to={profilePathFor(request)}
                              className="notification-item-user"
                              onClick={() => {
                                markNotificationRead(item.id);
                                setShowNotificationsMenu(false);
                              }}
                            >
                              {request.profile_image ? (
                                <img src={request.profile_image} alt={request.username} />
                              ) : (
                                <div className="notification-avatar">
                                  {request.username?.charAt(0).toUpperCase() || '?'}
                                </div>
                              )}
                              <div className="notification-text">
                                <strong>{request.username}</strong>
                                <span> sent you a friend request</span>
                              </div>
                            </Link>
                            <div className="notification-item-actions">
                              <button
                                className="btn-accept-small"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await api.acceptFriendRequest(request.id);
                                    markNotificationRead(`request-${request.id}`);
                                    persistNotificationItems((prev) =>
                                      prev.map((entry) =>
                                        entry.id === item.id
                                          ? { ...entry, type: 'friend_request_handled', handledAction: 'accepted' }
                                          : entry
                                      )
                                    );
                                  } catch (err) {
                                    console.error('Accept friend request error:', err);
                                  }
                                }}
                                title="Accept"
                              >
                                ✓
                              </button>
                              <button
                                className="btn-decline-small"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  try {
                                    await api.declineFriendRequest(request.id);
                                    markNotificationRead(`request-${request.id}`);
                                    persistNotificationItems((prev) =>
                                      prev.map((entry) =>
                                        entry.id === item.id
                                          ? { ...entry, type: 'friend_request_handled', handledAction: 'declined' }
                                          : entry
                                      )
                                    );
                                  } catch (err) {
                                    console.error('Decline friend request error:', err);
                                  }
                                }}
                                title="Decline"
                              >
                                ✕
                              </button>
                            </div>
                          </div>
                        );
                      }

                      if (item.type === 'friend_request_handled') {
                        const request = item.request;
                        const actionLabel =
                          item.handledAction === 'accepted'
                            ? 'accepted the request'
                            : 'declined the request';
                        return (
                          <div key={item.id} className="notification-item">
                            <Link
                              to={profilePathFor(request)}
                              className="notification-item-user"
                              onClick={() => {
                                markNotificationRead(item.id);
                                setShowNotificationsMenu(false);
                              }}
                            >
                              {request?.profile_image ? (
                                <img src={request.profile_image} alt={request.username} />
                              ) : (
                                <div className="notification-avatar">
                                  {request?.username?.charAt(0).toUpperCase() || '?'}
                                </div>
                              )}
                              <div className="notification-text">
                                <strong>{request?.username || 'Someone'}</strong>
                                <span> {actionLabel}</span>
                              </div>
                            </Link>
                          </div>
                        );
                      }

                      const actor = item.user || {};
                      const actorName = actor.username || 'Someone';
                      return (
                        <div key={item.id} className="notification-item">
                          <Link
                            to={notificationTargetPath(item, actor)}
                            className="notification-item-user"
                            onClick={() => {
                              markNotificationRead(item.id);
                              setShowNotificationsMenu(false);
                            }}
                          >
                            {actor.profileImage || actor.profile_image ? (
                              <img
                                src={actor.profileImage || actor.profile_image}
                                alt={actorName}
                              />
                            ) : (
                              <div className="notification-avatar">
                                {actorName?.charAt(0).toUpperCase() || '?'}
                              </div>
                            )}
                            <div className="notification-text">
                              <strong>{actorName}</strong>
                              <span> {getActivityLabel(item)}</span>
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {showMobileSearch && (
        <div className="mobile-search">
          <input
            type="text"
            placeholder="Search users..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            onFocus={() => searchQuery && setShowSearchResults(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSearch(searchQuery);
                setShowSearchResults(true);
              }
            }}
          />
          <button
            className="icon-btn"
            onClick={() => setShowMobileSearch(false)}
            aria-label="Close search"
          >
            <IconClose width={18} height={18} />
          </button>
          {showSearchResults && (
            <div className="mobile-search-results">
              {searchResults.length === 0 ? (
                <div className="search-empty">No users found</div>
              ) : (
                searchResults.map((user) => (
                  <Link
                    key={user.username}
                    to={profilePathFor(user)}
                    className="search-result"
                    onClick={() => {
                      setShowSearchResults(false);
                      setShowMobileSearch(false);
                    }}
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
      )}

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
              <span className="nav-icon"><IconFeed width={20} height={20} /></span>
              <span>Feed</span>
            </Link>
            <Link to="/profile/me" className={location.pathname.startsWith('/profile') ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon"><IconUser width={20} height={20} /></span>
              <span>My Profile</span>
            </Link>
            <Link to="/friends" className={location.pathname === '/friends' ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon"><IconUsers width={20} height={20} /></span>
              <span>Friends</span>
            </Link>
            <Link to="/groups" className={location.pathname === '/groups' ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon"><IconGroup width={20} height={20} /></span>
              <span>Groups</span>
            </Link>
            <Link to="/discover" className={location.pathname === '/discover' ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon"><IconDiscover width={20} height={20} /></span>
              <span>Discover</span>
            </Link>
            <Link to="/email" className={location.pathname.startsWith('/email') ? 'nav-item active' : 'nav-item'}>
              <span className="nav-icon"><IconMailbox width={20} height={20} /></span>
              <span>HyveMail</span>
            </Link>
            {isAdmin && (
              <Link to="/moderation" className={location.pathname === '/moderation' ? 'nav-item active' : 'nav-item'}>
                <span className="nav-icon"><IconShield width={20} height={20} /></span>
                <span>Moderation</span>
              </Link>
            )}
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
            {onlineFriends.length === 0 ? (
              <p className="empty-msg">No friends currently online</p>
            ) : (
              <div className="friends-list">
                {onlineFriends.slice(0, 5).map((friend) => (
                  <Link
                    key={friend.username}
                    to={profilePathFor(friend)}
                    className="friend-item"
                  >
                    {friend.profile_image ? (
                      <img src={friend.profile_image} alt={friend.username} className="friend-avatar" />
                    ) : (
                      <div className="friend-avatar">
                        {friend.username?.charAt(0).toUpperCase() || '?'}
                      </div>
                    )}
                    <span className="friend-name">{friend.username}</span>
                    <span className="friend-status" />
                  </Link>
                ))}
              </div>
            )}
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
                    key={suggestedUser.username}
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
            <IconChat width={24} height={24} />
            {getUnreadMessageCount() > 0 && (
              <span className="chat-badge">
                {getUnreadMessageCount() > 9 ? '9+' : getUnreadMessageCount()}
              </span>
            )}
          </button>
        </aside>
      </div>

      <nav className="mobile-nav">
        <Link to="/" className={location.pathname === '/' ? 'mobile-nav-item active' : 'mobile-nav-item'}>
          <IconFeed width={22} height={22} />
        </Link>
        <Link to="/friends" className={location.pathname === '/friends' ? 'mobile-nav-item active' : 'mobile-nav-item'}>
          <IconUsers width={22} height={22} />
        </Link>
        <Link to="/groups" className={location.pathname === '/groups' ? 'mobile-nav-item active' : 'mobile-nav-item'}>
          <IconGroup width={22} height={22} />
        </Link>
        <Link to="/discover" className={location.pathname === '/discover' ? 'mobile-nav-item active' : 'mobile-nav-item'}>
          <IconDiscover width={22} height={22} />
        </Link>
        <button
          type="button"
          className={`mobile-nav-item ${showChat ? 'active' : ''}`}
          onClick={() => {
            if (showChat) {
              setShowChat(false);
            } else {
              setSelectedChat(null);
              setShowChat(true);
              setShowMobileSearch(false);
              setShowNotificationsMenu(false);
            }
          }}
          aria-label="Toggle chat"
          title="Chat"
        >
          <IconChat width={22} height={22} />
          {getUnreadMessageCount() > 0 && (
            <span className="mobile-chat-badge">
              {getUnreadMessageCount() > 9 ? '9+' : getUnreadMessageCount()}
            </span>
          )}
        </button>
        <Link to="/profile/me" className={location.pathname.startsWith('/profile') ? 'mobile-nav-item active' : 'mobile-nav-item'}>
          <IconUser width={22} height={22} />
        </Link>
        {isAdmin && (
          <Link to="/moderation" className={location.pathname === '/moderation' ? 'mobile-nav-item active' : 'mobile-nav-item'}>
            <IconShield width={22} height={22} />
          </Link>
        )}
      </nav>

      {/* Chat List Popup */}
      {showChat && (
        <div className="chat-list-popup">
          <div className="chat-list-header">
            <h3><IconChat width={20} height={20} /> Messages</h3>
            <button className="close-chat" onClick={() => setShowChat(false)}><IconClose width={18} height={18} /></button>
          </div>
          <div className="chat-list-body">
            <Chat onSelectChat={handleChatSelect} unreadMap={unreadMessages} onlineMap={presenceMap} />
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
        <p className="copyright">© 2026 Hyve Social</p>
      </footer>
    </div>
  );
}