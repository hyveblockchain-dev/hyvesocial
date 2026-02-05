// src/components/Chat/ChatWindow.jsx
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Chat.css';
import { formatDateTime } from '../../utils/date';
import {
  ensureKeypair,
  encryptMessageForRecipient,
  decryptMessageContent,
  getEncryptedKeyPayload,
  clearE2EEUnlock,
  resetE2EESession
} from '../../utils/e2ee';

export default function ChatWindow({ conversation, onClose }) {
  const { user, socket } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [loading, setLoading] = useState(true);
  const [e2eeEnabled, setE2eeEnabled] = useState(() => localStorage.getItem('e2ee_enabled') === 'true');
  const [e2eeReady, setE2eeReady] = useState(false);
  const [e2eeError, setE2eeError] = useState('');
  const messagesEndRef = useRef(null);
  const hasInitialScrollRef = useRef(false);
  const lastE2eeEnabledRef = useRef(e2eeEnabled);
  const pendingOutboxRef = useRef([]);
  const conversationUsername = conversation?.username;
  const cacheKey = conversationUsername ? `chat_messages_${conversationUsername}` : null;
  const decryptedCacheKey = conversationUsername && e2eeEnabled ? `chat_messages_${conversationUsername}_decrypted` : null;
  const getMessageKey = (message) =>
    message?.id ||
    message?.message_id ||
    `${message?.from_username || message?.fromUsername || ''}-${message?.to_username || message?.toUsername || ''}-${message?.created_at || message?.createdAt || ''}`;

  useEffect(() => {
    if (!conversationUsername) {
      setLoading(false);
      return;
    }

    if (e2eeEnabled) {
      initE2EE().then(loadMessages);
    } else {
      loadMessages();
    }

    if (socket) {
      socket.on('new_message', handleNewMessage);
    }

    return () => {
      if (socket) {
        socket.off('new_message', handleNewMessage);
      }
    };
  }, [conversationUsername, socket, e2eeEnabled]);

  useEffect(() => {
    if (!e2eeEnabled) {
      setE2eeReady(false);
      setE2eeError('');
    }
  }, [e2eeEnabled]);

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
      const { publicKey, encryptedPrivateKey, encryptedPrivateKeyNonce } = await ensureKeypair();
      setE2eeReady(true);
      setE2eeError('');
      const payload =
        encryptedPrivateKey && encryptedPrivateKeyNonce
          ? { publicKey, encryptedPrivateKey, encryptedPrivateKeyNonce }
          : getEncryptedKeyPayload();
      if (payload?.publicKey) {
        await api.setPublicKey(payload.publicKey, payload.encryptedPrivateKey, payload.encryptedPrivateKeyNonce);
      }
    } catch (error) {
      setE2eeError(error?.message || 'E2EE unavailable');
    }
  }

  async function hydrateMessage(message, { allowDecrypt = true } = {}) {
    const raw = message?.content;
    if (typeof raw === 'string' && raw.startsWith('ENC:')) {
      if (!allowDecrypt) {
        return { ...message, content: '[Encrypted message]', _encrypted: true, _locked: true };
      }
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
    const currentUsername = user?.username?.toLowerCase?.();
    const fromUsername = message.from_username || message.fromUsername || message.sender_username || message.from || message.sender || message.username;
    const toUsername = message.to_username || message.toUsername || message.recipient_username || message.to || message.recipient;
    if (fromUsername === conversationUsername || toUsername === conversationUsername) {
      const rawContent = message?.content;
      const fromSelf = !!currentUsername && (fromUsername || '').toLowerCase?.() === currentUsername;
      const outboxKey = `${toUsername || ''}|${rawContent || ''}`;
      if (fromSelf) {
        const now = Date.now();
        const matchIndex = pendingOutboxRef.current.findIndex(
          (entry) => entry.key === outboxKey && now - entry.ts < 15000
        );
        if (matchIndex !== -1) {
          pendingOutboxRef.current.splice(matchIndex, 1);
        }
      }
      const hydrated = await hydrateMessage(message, { allowDecrypt: e2eeEnabled });
      setMessages((prev) => {
        if (fromSelf) {
          const replaced = prev.map((existing) =>
            existing?._optimisticKey && existing._optimisticKey === outboxKey
              ? { ...hydrated, _optimisticKey: existing._optimisticKey }
              : existing
          );
          const didReplace = replaced.some(
            (existing) => existing?._optimisticKey && existing._optimisticKey === outboxKey
          );
          if (didReplace) return replaced;
        }
        const key = getMessageKey(hydrated);
        if (prev.some((existing) => getMessageKey(existing) === key)) return prev;
        return [...prev, hydrated];
      });
    }
  }

  async function loadMessages() {
    if (!conversationUsername) return;

    try {
      let hadCache = false;
      if (decryptedCacheKey) {
        const cachedDecrypted = sessionStorage.getItem(decryptedCacheKey);
        if (cachedDecrypted) {
          try {
            const parsed = JSON.parse(cachedDecrypted);
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

      if (!hadCache && cacheKey) {
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
        setLoading(false);
      }

      const data = await api.getMessages(conversationUsername);
      const loaded = data.messages || [];
      hasInitialScrollRef.current = false;
      const hydrated = await Promise.all(loaded.map((message) => hydrateMessage(message, { allowDecrypt: e2eeEnabled })));

      setMessages((prev) => {
        if (lastE2eeEnabledRef.current !== e2eeEnabled) {
          lastE2eeEnabledRef.current = e2eeEnabled;
          return hydrated;
        }
        if (!prev.length) return hydrated;
        const toKey = getMessageKey;
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
        if (decryptedCacheKey) {
          try {
            sessionStorage.setItem(decryptedCacheKey, JSON.stringify(merged));
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
      const shouldOptimistic = !socket?.connected;
      if (!e2eeEnabled) {
        const outboxKey = `${conversationUsername || ''}|${newMessage}`;
        pendingOutboxRef.current.push({ key: outboxKey, ts: Date.now() });
        const response = await api.sendMessage(conversationUsername, newMessage);
        const sentMessage = response?.message || response;
        const withDefaults = {
          ...sentMessage,
          content: newMessage,
          from_username: sentMessage?.from_username ?? user?.username,
          to_username: sentMessage?.to_username ?? conversationUsername,
          created_at: sentMessage?.created_at ?? new Date().toISOString(),
          _optimisticKey: outboxKey
        };
        if (shouldOptimistic) {
          setMessages((prev) => [...prev, withDefaults]);
        }
        setNewMessage('');
        setShowEmojiPicker(false);
        return;
      }

      if (!e2eeReady) {
        await initE2EE();
      }
      const keyResponse = await api.getUserKey(conversationUsername);
      const recipientKey = keyResponse?.publicKey;
      if (!recipientKey) {
        const outboxKey = `${conversationUsername || ''}|${newMessage}`;
        pendingOutboxRef.current.push({ key: outboxKey, ts: Date.now() });
        const response = await api.sendMessage(conversationUsername, newMessage);
        const sentMessage = response?.message || response;
        const withDefaults = {
          ...sentMessage,
          content: newMessage,
          from_username: sentMessage?.from_username ?? user?.username,
          to_username: sentMessage?.to_username ?? conversationUsername,
          created_at: sentMessage?.created_at ?? new Date().toISOString(),
          _optimisticKey: outboxKey
        };
        if (shouldOptimistic) {
          setMessages((prev) => [...prev, withDefaults]);
        }
        setNewMessage('');
        setShowEmojiPicker(false);
        return;
      }

      const { publicKey: senderPublicKey } = await ensureKeypair();
      const cipherToRecipient = await encryptMessageForRecipient(recipientKey, newMessage);
      const cipherToSelf = await encryptMessageForRecipient(senderPublicKey, newMessage);
      const payload = JSON.stringify({ v: 1, r: cipherToRecipient, s: cipherToSelf });
      const outboxKey = `${conversationUsername || ''}|ENC:${payload}`;
      pendingOutboxRef.current.push({ key: outboxKey, ts: Date.now() });
      const response = await api.sendMessage(conversationUsername, `ENC:${payload}`);
      const sentMessage = response?.message || response;
      const withDefaults = {
        ...sentMessage,
        content: newMessage,
        from_username: sentMessage?.from_username ?? user?.username,
        to_username: sentMessage?.to_username ?? conversationUsername,
        created_at: sentMessage?.created_at ?? new Date().toISOString(),
        _optimisticKey: outboxKey
      };
      if (shouldOptimistic) {
        setMessages((prev) => [...prev, withDefaults]);
      }
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
        <div className="chat-header-actions">
          <label className="chat-e2ee-toggle">
            <input
              type="checkbox"
              checked={e2eeEnabled}
              onChange={async (e) => {
                const next = e.target.checked;
                if (next) {
                  try {
                    resetE2EESession();
                    clearE2EEUnlock(true);
                    await initE2EE();
                  } catch (error) {
                    setE2eeError(error?.message || 'E2EE unavailable');
                    e.target.checked = false;
                    localStorage.setItem('e2ee_enabled', 'false');
                    setE2eeEnabled(false);
                    return;
                  }
                } else {
                  resetE2EESession();
                }
                localStorage.setItem('e2ee_enabled', next ? 'true' : 'false');
                setE2eeEnabled(next);
              }}
            />
            <span>Encrypt</span>
          </label>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
      </div>

      <div className="chat-messages">
        {e2eeEnabled && e2eeError && (
          <div className="chat-loading">Encrypted chat unavailable: {e2eeError}</div>
        )}
        {messages.length === 0 ? (
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