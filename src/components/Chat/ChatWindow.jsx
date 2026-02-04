// src/components/Chat/ChatWindow.jsx
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Chat.css';

export default function ChatWindow({ conversation, onClose }) {
  const { user, socket } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);
  const conversationUsername = conversation?.username;

  useEffect(() => {
    if (!conversationUsername) {
      setLoading(false);
      return;
    }

    loadMessages();

    // Listen for new messages
    if (socket) {
      socket.on('new_message', handleNewMessage);
    }

    return () => {
      if (socket) {
        socket.off('new_message', handleNewMessage);
      }
    };
  }, [conversationUsername, socket]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  function handleNewMessage(message) {
    if (
      message.from_username === conversationUsername ||
      message.to_username === conversationUsername
    ) {
      setMessages(prev => [...prev, message]);
    }
  }

  async function loadMessages() {
    if (!conversationUsername) return;
    
    try {
      setLoading(true);
      const data = await api.getMessages(conversationUsername);
      setMessages(data.messages || []);
    } catch (error) {
      console.error('Load messages error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    
    if (!newMessage.trim()) return;

    try {
      const message = await api.sendMessage(conversationUsername, newMessage);
      setMessages(prev => [...prev, message.message]);
      setNewMessage('');
    } catch (error) {
      console.error('Send message error:', error);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-user-info">
          {conversation.profileImage ? (
            <img src={conversation.profileImage} alt={conversation.username} />
          ) : (
            <div className="chat-avatar">
              {conversation.username?.charAt(0).toUpperCase() || '?'}
            </div>
          )}
          <span>{conversation.username}</span>
        </div>
        <button className="close-button" onClick={onClose}>✕</button>
      </div>

      <div className="chat-messages">
        {loading ? (
          <div className="chat-loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="no-messages">No messages yet. Start the conversation!</div>
        ) : (
          messages.map((message, index) => {
            const currentUsername = user?.username;
            const isOwn = message.from_username === currentUsername;
            return (
              <div key={index} className={`message ${isOwn ? 'own' : 'other'}`}>
                <div className="message-content">{message.content}</div>
                <div className="message-time">
                  {new Date(message.created_at).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input" onSubmit={handleSendMessage}>
        <input
          type="text"
          placeholder="Type a message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}