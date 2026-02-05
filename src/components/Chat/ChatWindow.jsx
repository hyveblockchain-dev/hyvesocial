// src/components/Chat/ChatWindow.jsx
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Chat.css';
import { formatDateTime } from '../../utils/date';
import { ensureKeypair, encryptMessageForRecipient, decryptMessageContent } from '../../utils/e2ee';

export default function ChatWindow({ conversation, onClose }) {
  const { user, socket } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [e2eeReady, setE2eeReady] = useState(false);
  const [e2eeError, setE2eeError] = useState('');
  const messagesEndRef = useRef(null);
  const hasInitialScrollRef = useRef(false);
  const conversationUsername = conversation?.username;
  const cacheKey = conversationUsername ? `chat_messages_${conversationUsername}` : null;

  useEffect(() => {
    if (!conversationUsername) {
      setLoading(false);
      return;
    }

    initE2EE().then(loadMessages);

    if (socket) {
      socket.on('new_message', handleNewMessage);
    }

    return () => {
      if (socket) {
        socket.off('new_message', handleNewMessage);
      }
    };
  }, [conversationUsername, socket]);

  useLayoutEffect(() => {
    if (!messages.length) return;
    if (!hasInitialScrollRef.current) {
      scrollToBottom('auto');
      hasInitialScrollRef.current = true;
      return;
    }
    scrollToBottom('smooth');
  }, [messages]);

  const emojiOptions = ['😀','😄','😁','😅','😂','😍','🥳','😎','😮','😢','😡','👍','❤️','🔥','🎉'];

  async function initE2EE() {
    try {
      const { publicKey, isNew } = await ensureKeypair();
      setE2eeReady(true);
      setE2eeError('');
      if (isNew) {
        await api.setPublicKey(publicKey);
      }
    } catch (error) {
      setE2eeError(error?.message || 'E2EE unavailable');
    }
  }

  async function hydrateMessage(message) {
    const raw = message?.content;
    if (typeof raw === 'string' && raw.startsWith('ENC:')) {
      const cipherPayload = raw.slice(4);
      try {
        await ensureKeypair();
        try {
          const parsed = JSON.parse(cipherPayload);
          const candidates = [parsed?.s, parsed?.r].filter(Boolean);
          for (const candidate of candidates) {
            try {
              const plain = await decryptMessageContent(candidate);
              return { ...message, content: plain, _encrypted: true };
            } catch {
              // try next candidate
            }
          }
        } catch {
          // legacy format
        }

        const plain = await decryptMessageContent(cipherPayload);
        return { ...message, content: plain, _encrypted: true };
      } catch (error) {
        return { ...message, content: '[Encrypted message]', _decryptError: true };
      }
    }
    return message;
  }

  async function handleNewMessage(message) {
    const fromUsername = message.from_username || message.fromUsername || message.sender_username || message.from || message.sender || message.username;
    const toUsername = message.to_username || message.toUsername || message.recipient_username || message.to || message.recipient;
    if (fromUsername === conversationUsername || toUsername === conversationUsername) {
      const hydrated = await hydrateMessage(message);
      setMessages((prev) => [...prev, hydrated]);
    }
  }

  async function loadMessages() {
    if (!conversationUsername) return;

    try {
      let hadCache = false;
      if (cacheKey) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              hasInitialScrollRef.current = false;
              setMessages(parsed);
              setLoading(false);
              hadCache = true;
            }
          } catch {
            // ignore cache errors
          }
        }
      }

      if (!hadCache && messages.length === 0) {
        setLoading(true);
      }

      const data = await api.getMessages(conversationUsername);
      const loaded = data.messages || [];
      hasInitialScrollRef.current = false;
      const hydrated = await Promise.all(loaded.map(hydrateMessage));

      setMessages((prev) => {
        if (!prev.length) return hydrated;
        const toKey = (m) =>
          m.id ||
          m.message_id ||
          `${m.from_username || m.fromUsername || ''}-${m.to_username || m.toUsername || ''}-${m.created_at || m.createdAt || ''}-${m.content || ''}`;
        const map = new Map();
        prev.forEach((m) => map.set(toKey(m), m));
        hydrated.forEach((m) => map.set(toKey(m), m));
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
      if (!e2eeReady) {
        await initE2EE();
      }
      const keyResponse = await api.getUserKey(conversationUsername);
      const recipientKey = keyResponse?.publicKey;
      if (!recipientKey) {
        alert('This user has not enabled encrypted chat yet.');
        return;
      }

      const { publicKey: senderPublicKey } = await ensureKeypair();
      const cipherToRecipient = await encryptMessageForRecipient(recipientKey, newMessage);
      const cipherToSelf = await encryptMessageForRecipient(senderPublicKey, newMessage);
      const payload = JSON.stringify({ v: 1, r: cipherToRecipient, s: cipherToSelf });
      const response = await api.sendMessage(conversationUsername, `ENC:${payload}`);
      const sentMessage = response?.message || response;
      const withDefaults = {
        ...sentMessage,
        content: newMessage,
        from_username: sentMessage?.from_username ?? user?.username,
        to_username: sentMessage?.to_username ?? conversationUsername,
        created_at: sentMessage?.created_at ?? new Date().toISOString()
      };
      setMessages((prev) => [...prev, withDefaults]);
      setNewMessage('');
      setShowEmojiPicker(false);
    } catch (error) {
      console.error('Send message error:', error);
    }
  }

  function formatMessageTime(message) {
    const raw = message?.created_at || message?.createdAt || message?.timestamp || message?.sent_at || message?.sentAt;
    return formatDateTime(raw, { dateStyle: 'medium', timeStyle: 'short' }, '');
  }

  function scrollToBottom(behavior = 'smooth') {
    messagesEndRef.current?.scrollIntoView({ behavior });
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
        {e2eeError && (
          <div className="chat-loading">Encrypted chat unavailable: {e2eeError}</div>
        )}
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
        <button
          type="button"
          className="emoji-toggle"
          onClick={() => setShowEmojiPicker((prev) => !prev)}
          aria-label="Add emoji"
          title="Add emoji"
        >
          😊
        </button>
        <button type="submit">Send</button>
      </form>
      {showEmojiPicker && (
        <div className="chat-emoji-picker">
          {emojiOptions.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="emoji-option"
              onClick={() => {
                setNewMessage((prev) => `${prev}${emoji}`);
                setShowEmojiPicker(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}