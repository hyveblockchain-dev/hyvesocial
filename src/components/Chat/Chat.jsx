// src/components/Chat/Chat.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Chat.css';

export default function Chat({ onSelectChat, unreadMap = {}, onlineMap = {} }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function getUserHandle(userObj) {
    return (userObj?.username || userObj?.user?.username || userObj?.name || '').toLowerCase();
  }

  useEffect(() => {
    loadChatList();
  }, []);

  async function loadChatList() {
    try {
      setLoading(true);
      setError(null);

      // Load friends + active conversations + blocked list in parallel
      const [friendsData, convoData, blockedData] = await Promise.all([
        api.getFriends ? api.getFriends() : Promise.resolve({ friends: [] }),
        api.getConversations ? api.getConversations() : Promise.resolve({ conversations: [] }),
        api.getBlockedUsers ? api.getBlockedUsers() : Promise.resolve({ blocked: [] })
      ]);

      // Build blocked set
      const blockedList = blockedData?.blocks || blockedData?.blocked || blockedData?.users || blockedData || [];
      const blockedHandleSet = new Set(
        (Array.isArray(blockedList) ? blockedList : [])
          .map(getUserHandle)
          .filter(Boolean)
      );

      const myHandle = user?.username?.toLowerCase?.() || '';

      // Normalize friends list
      const friends = Array.isArray(friendsData?.friends) ? friendsData.friends : [];
      // Normalize conversations list (people you've exchanged messages with)
      const convos = Array.isArray(convoData?.conversations) ? convoData.conversations : [];

      // Merge into a single deduped map keyed by lowercase username
      const userMap = new Map();

      for (const f of friends) {
        const handle = getUserHandle(f);
        if (!handle || handle === myHandle || blockedHandleSet.has(handle)) continue;
        userMap.set(handle, {
          username: f.username || f.name || handle,
          profile_image: f.profile_image || f.profileImage || '',
          isFriend: true,
          hasMessages: false,
          lastMessageTime: null,
        });
      }

      for (const c of convos) {
        const handle = getUserHandle(c);
        if (!handle || handle === myHandle || blockedHandleSet.has(handle)) continue;
        const existing = userMap.get(handle);
        if (existing) {
          existing.hasMessages = true;
          existing.lastMessageTime = c.last_message_time || c.lastMessageTime || null;
        } else {
          userMap.set(handle, {
            username: c.username || c.name || handle,
            profile_image: c.profile_image || c.profileImage || '',
            isFriend: false,
            hasMessages: true,
            lastMessageTime: c.last_message_time || c.lastMessageTime || null,
          });
        }
      }

      // Sort: users with unread messages first, then by friend status, then alphabetically
      const sorted = [...userMap.values()].sort((a, b) => {
        const aUnread = Number(unreadMap?.[a.username.toLowerCase()] || 0);
        const bUnread = Number(unreadMap?.[b.username.toLowerCase()] || 0);
        if (aUnread !== bUnread) return bUnread - aUnread;
        if (a.hasMessages !== b.hasMessages) return a.hasMessages ? -1 : 1;
        return a.username.localeCompare(b.username);
      });

      setConversations(sorted);
    } catch (err) {
      console.error('Load chat list error:', err);
      setError('Failed to load chat list');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  async function prefetchMessages(conversation) {
    const usernameRaw =
      conversation?.username ||
      conversation?.handle ||
      conversation?.user?.username ||
      conversation?.name ||
      null;
    const username = usernameRaw ? String(usernameRaw).toLowerCase() : null;
    if (!username || !api.getMessages) return;
    const cacheKey = `chat_messages_${username}`;
    if (sessionStorage.getItem(cacheKey)) return;
    try {
      const data = await api.getMessages(username);
      const loaded = data.messages || [];
      if (loaded.length > 0) {
        sessionStorage.setItem(cacheKey, JSON.stringify(loaded));
      }
    } catch (error) {
      // ignore prefetch errors
    }
  }

  function handleSelectChat(conversation) {
    if (onSelectChat) {
      const username =
        conversation?.username ||
        conversation?.handle ||
        conversation?.user?.username ||
        conversation?.name ||
        'Anonymous';
      const profileImage = conversation.profile_image || conversation.profileImage || '';

      onSelectChat({
        ...conversation,
        username,
        profileImage
      });
    }
  }

  if (loading) {
    return (
      <div className="chat-container">
        <div className="chat-loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="chat-container">
        <div className="chat-empty">{error}</div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {conversations.length === 0 ? (
        <div className="chat-empty">No conversations yet. Add friends or visit a profile to start chatting!</div>
      ) : (
        <div className="conversation-list">
          {conversations.map(conversation => {
            const username = conversation.username || 'Anonymous';
            const profileImage = conversation.profile_image || conversation.profileImage;
            const unreadCount = Number(unreadMap?.[String(username).toLowerCase()] || 0);
            const isOnline = !!onlineMap?.[String(username).toLowerCase()]?.online;
            
            return (
              <div
                key={username}
                className="conversation-item"
                onClick={() => handleSelectChat(conversation)}
                onMouseEnter={() => prefetchMessages(conversation)}
              >
                <div className="conversation-avatar-wrapper">
                  {profileImage ? (
                    <img 
                      src={profileImage} 
                      alt={username} 
                      className="conversation-avatar" 
                    />
                  ) : (
                    <div className="conversation-avatar">
                      {username?.charAt(0).toUpperCase() || '?'}
                    </div>
                  )}
                  {isOnline && <span className="conversation-online" />}
                </div>
                <div className="conversation-info">
                  <div className="conversation-name">{username}</div>
                  <div className="conversation-preview">
                    {conversation.hasMessages ? 'Tap to continue chat' : 'Start a conversation...'}
                  </div>
                </div>
                {unreadCount > 0 && (
                  <span className="conversation-badge">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}