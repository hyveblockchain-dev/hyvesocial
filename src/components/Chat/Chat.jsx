// src/components/Chat/Chat.jsx
import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Chat.css';

export default function Chat({ onSelectChat }) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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
      const data = await api.getUsers();
      console.log('Users data:', data);
      
      if (!data || !data.users || !Array.isArray(data.users)) {
        console.error('Invalid response format:', data);
        setConversations([]);
        setLoading(false);
        return;
      }
      
      // Filter out current user
      const otherUsers = data.users.filter(u => {
        const userAddress = u.wallet_address || u.walletAddress;
        const currentAddress = user?.walletAddress || user?.wallet_address;
        return userAddress !== currentAddress;
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

  function handleSelectChat(conversation) {
    if (onSelectChat) {
      const address = conversation.wallet_address || conversation.walletAddress || conversation.address;
      const username = conversation.username || 'Anonymous';
      const profileImage = conversation.profile_image || conversation.profileImage || '';

      onSelectChat({
        ...conversation,
        address,
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