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
    loadConversations();
  }, []);

  async function loadConversations() {
    try {
      setLoading(true);
      setError(null);
      
      // Check if API method exists
      if (!api.getUsers) {
        console.error('getUsers method not available on api');
        setError('Chat feature not available');
        setLoading(false);
        return;
      }
      
      console.log('Loading users...');
      const [data, blockedData] = await Promise.all([
        api.getUsers(),
        api.getBlockedUsers ? api.getBlockedUsers() : Promise.resolve({ blocked: [] })
      ]);
      console.log('Users data:', data);
      
      if (!data || !data.users || !Array.isArray(data.users)) {
        console.error('Invalid response format:', data);
        setConversations([]);
        setLoading(false);
        return;
      }
      
      // Filter out current user
      const blockedList = blockedData?.blocks || blockedData?.blocked || blockedData?.users || blockedData || [];
      const blockedHandleSet = new Set(
        (Array.isArray(blockedList) ? blockedList : [])
          .map(getUserHandle)
          .filter(Boolean)
      );

      const otherUsers = data.users.filter(u => {
        const handle = getUserHandle(u);
        if (handle && handle === user?.username?.toLowerCase?.()) return false;
        if (handle && blockedHandleSet.has(handle)) return false;
        return true;
      });
      
      console.log('Filtered users:', otherUsers);
      setConversations(otherUsers);
    } catch (error) {
      console.error('Load conversations error:', error);
      setError('Failed to load users');
      setConversations([]);
    } finally {
      setLoading(false);
    }
  }

  async function prefetchMessages(username) {
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
      const username = conversation.username || 'Anonymous';
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
        <div className="chat-empty">No users available</div>
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
                onMouseEnter={() => prefetchMessages(username)}
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
                  <div className="conversation-preview">Start a conversation...</div>
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