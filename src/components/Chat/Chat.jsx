// src/components/Chat/Chat.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import socket from '../../services/socket';
import './Chat.css';

export default function Chat() {
  const [conversations, setConversations] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  
  const messagesEndRef = useRef(null);
  const { user } = useAuth();

  useEffect(() => {
    loadConversations();

    // Listen for new messages
    socket.onNewMessage(handleNewMessage);

    return () => {
      socket.offNewMessage(handleNewMessage);
    };
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleNewMessage(message) {
    if (selectedChat && 
        (message.from_address === selectedChat.address || 
         message.to_address === selectedChat.address)) {
      setMessages(prev => [...prev, message]);
    }
  }

  async function loadConversations() {
    try {
      const data = await api.getConversations();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error('Load conversations error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadMessages(address) {
    try {
      const data = await api.getConversation(address);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Load messages error:', error);
    }
  }

  function handleSelectChat(conversation) {
    setSelectedChat(conversation);
    loadMessages(conversation.address);
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChat) return;

    setSending(true);
    try {
      const data = await api.sendMessage({
        toAddress: selectedChat.address,
        content: newMessage.trim()
      });

      // Add message to list immediately
      setMessages([...messages, data.message]);
      setNewMessage('');
    } catch (error) {
      console.error('Send message error:', error);
      alert('Failed to send message');
    } finally {
      setSending(false);
    }
  }

  function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  }

  if (loading) {
    return (
      <div className="chat-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-page">
      <div className="chat-container">
        {/* Conversations List */}
        <div className="conversations-sidebar">
          <div className="conversations-header">
            <h2>Messages</h2>
          </div>

          <div className="conversations-list">
            {conversations.length === 0 ? (
              <div className="empty-conversations">
                <p>No conversations yet</p>
                <p className="hint">Search for users to start chatting!</p>
              </div>
            ) : (
              conversations.map(conv => (
                <div
                  key={conv.address}
                  className={`conversation-item ${selectedChat?.address === conv.address ? 'active' : ''}`}
                  onClick={() => handleSelectChat(conv)}
                >
                  <div className="conversation-avatar">
                    {conv.username?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="conversation-info">
                    <div className="conversation-name">{conv.username}</div>
                    <div className="conversation-preview">
                      {conv.last_message}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Window */}
        <div className="chat-window">
          {selectedChat ? (
            <>
              <div className="chat-header">
                <div className="chat-user-avatar">
                  {selectedChat.username?.charAt(0).toUpperCase() || '?'}
                </div>
                <div className="chat-user-info">
                  <h3>{selectedChat.username}</h3>
                  <p className="chat-user-address">
                    {selectedChat.address?.slice(0, 6)}...{selectedChat.address?.slice(-4)}
                  </p>
                </div>
              </div>

              <div className="messages-container">
                {messages.length === 0 ? (
                  <div className="empty-messages">
                    <p>No messages yet. Say hi! 👋</p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isSent = msg.from_address === user.walletAddress;
                    return (
                      <div 
                        key={index} 
                        className={`message ${isSent ? 'sent' : 'received'}`}
                      >
                        <div className="message-bubble">
                          <p>{msg.content}</p>
                          <span className="message-time">{formatTime(msg.created_at)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <form onSubmit={handleSendMessage} className="message-input">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  disabled={sending}
                />
                <button 
                  type="submit" 
                  disabled={sending || !newMessage.trim()}
                >
                  {sending ? '...' : '📤'}
                </button>
              </form>
            </>
          ) : (
            <div className="no-chat-selected">
              <p>Select a conversation to start messaging</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
