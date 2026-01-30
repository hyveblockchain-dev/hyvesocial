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
      // Get list of users to chat with
      const data = await api.getUsers();
      const otherUsers = data.users.filter(u => u.wallet_address !== user?.walletAddress);
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
          {conversations.map(conversation => (
            <div
              key={conversation.wallet_address}
              className="conversation-item"
              onClick={() => handleSelectChat(conversation)}
            >
              {conversation.profile_image ? (
                <img 
                  src={conversation.profile_image} 
                  alt={conversation.username} 
                  className="conversation-avatar" 
                />
              ) : (
                <div className="conversation-avatar">
                  {conversation.username?.charAt(0).toUpperCase() || '?'}
                </div>
              )}
              <div className="conversation-info">
                <div className="conversation-name">{conversation.username}</div>
                <div className="conversation-preview">Start a conversation...</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}