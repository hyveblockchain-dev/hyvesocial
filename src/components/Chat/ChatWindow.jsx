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
  const cacheKey = conversationUsername ? `chat_messages_${conversationUsername}` : null;

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
    const fromUsername = message.from_username || message.fromUsername || message.sender_username || message.from || message.sender || message.username;
    const toUsername = message.to_username || message.toUsername || message.recipient_username || message.to || message.recipient;
    if (fromUsername === conversationUsername || toUsername === conversationUsername) {
      setMessages((prev) => [...prev, message]);
    }
  }

  async function loadMessages() {
    if (!conversationUsername) return;
    
    try {
      if (cacheKey) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setMessages(parsed);
              setLoading(false);
            }
          } catch {
            // ignore cache errors
          }
        }
      }

      if (messages.length === 0) {
        setLoading(true);
      }
      const data = await api.getMessages(conversationUsername);
      const loaded = data.messages || [];
      setMessages((prev) => {
        if (!prev.length) return loaded;
        const toKey = (m) =>
          m.id ||
          m.message_id ||
          `${m.from_username || m.fromUsername || ''}-${m.to_username || m.toUsername || ''}-${m.created_at || m.createdAt || ''}-${m.content || ''}`;
        const map = new Map();
        prev.forEach((m) => map.set(toKey(m), m));
        loaded.forEach((m) => map.set(toKey(m), m));
        const merged = Array.from(map.values()).sort((a, b) => {
          const aTime = new Date(a.created_at || a.createdAt || 0).getTime();
          const bTime = new Date(b.created_at || b.createdAt || 0).getTime();
          return aTime - bTime;
        });
        if (cacheKey) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(merged));
          } catch {
            // ignore cache errors
          }
        }
        return merged;
      });
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
      const response = await api.sendMessage(conversationUsername, newMessage);
      const sentMessage = response?.message || response;
      const withDefaults = {
        ...sentMessage,
        content: sentMessage?.content ?? newMessage,
        from_username: sentMessage?.from_username ?? user?.username,
        to_username: sentMessage?.to_username ?? conversationUsername,
        created_at: sentMessage?.created_at ?? new Date().toISOString()
      };
      setMessages((prev) => [...prev, withDefaults]);
      setNewMessage('');
    } catch (error) {
      console.error('Send message error:', error);
    }
  }

  function formatMessageTime(message) {
    const raw = message?.created_at || message?.createdAt || message?.timestamp || message?.sent_at || message?.sentAt;
    if (!raw) return '';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
            const currentUsername = user?.username?.toLowerCase?.();
            const fromUsername = (message.from_username || message.fromUsername || message.sender_username || message.from || message.sender || message.username || '').toLowerCase();
            const isOwn = !!currentUsername && fromUsername === currentUsername;
            return (
              <div key={index} className={`message ${isOwn ? 'own' : 'other'}`}>
                <div className="message-content">{message.content}</div>
                <div className="message-time">
                  {formatMessageTime(message)}
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