// src/components/Chat/Chat.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Chat.css';

export default function Chat({ onSelectChat }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadConversations();
  }, []);

  async function loadConversations() {
    try {
      setLoading(true);
      const data = await api.getUsers();
      console.log('Users from API:', data); // Debug log
      
      // Filter out current user - handle both snake_case and camelCase
      const otherUsers = data.users.filter(u => {
        const userAddress = u.wallet_address || u.walletAddress;
        const currentAddress = user?.walletAddress || user?.wallet_address;
        return userAddress !== currentAddress;
      });
      
      console.log('Filtered users:', otherUsers); // Debug log
      setConversations(otherUsers);
    } catch (error) {
      console.error('Load conversations error:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectChat(conversation) {
    if (onSelectChat) {
      onSelectChat(conversation);
    }
  }

  if (loading) {
    return (
      <div className="chat-container">
        <div className="chat-loading">Loading conversations...</div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      {conversations.length === 0 ? (
        <div className="chat-empty">No users to chat with</div>
      ) : (
        <div className="conversation-list">
          {conversations.map(conversation => {
            const address = conversation.wallet_address || conversation.walletAddress;
            const username = conversation.username || 'Anonymous';
            const profileImage = conversation.profile_image || conversation.profileImage;
            
            return (
              <div
                key={address}
                className="conversation-item"
                onClick={() => handleSelectChat(conversation)}
              >
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
                <div className="conversation-info">
                  <div className="conversation-name">{username}</div>
                  <div className="conversation-preview">Start a conversation...</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}