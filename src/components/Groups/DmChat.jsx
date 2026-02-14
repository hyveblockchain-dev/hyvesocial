// src/components/Groups/DmChat.jsx — Discord-style DM chat view
import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import { SmileIcon } from '../Icons/Icons';
import GifPicker from '../GifPicker/GifPicker';
import { formatDateTime } from '../../utils/date';

export default function DmChat({ selectedUser, onBack }) {
  const { user, socket } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [expandedGif, setExpandedGif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfilePanel, setShowProfilePanel] = useState(true);
  const [profileData, setProfileData] = useState(null);
  const messagesEndRef = useRef(null);
  const hasInitialScrollRef = useRef(false);
  const inputRef = useRef(null);

  const targetUsername = (selectedUser?.username || '').toLowerCase();
  const targetDisplay = selectedUser?.username || 'Unknown';
  const targetImage = selectedUser?.profileImage || selectedUser?.profile_image || '';
  const cacheKey = targetUsername ? `chat_messages_${targetUsername}` : null;

  const getMessageKey = (m) =>
    m?.id || m?.message_id ||
    `${m?.from_username || m?.fromUsername || ''}-${m?.to_username || m?.toUsername || ''}-${m?.created_at || m?.createdAt || ''}`;

  // ── Load messages ──
  useEffect(() => {
    if (!targetUsername) { setLoading(false); return; }
    setMessages([]);
    hasInitialScrollRef.current = false;
    loadMessages();

    if (socket) socket.on('new_message', handleNewMessage);
    return () => { if (socket) socket.off('new_message', handleNewMessage); };
  }, [targetUsername, socket]);

  // ── Load profile data for right panel ──
  useEffect(() => {
    if (!targetUsername) return;
    (async () => {
      try {
        const data = await api.getUserProfile(targetUsername);
        setProfileData(data?.user || data || null);
      } catch { setProfileData(null); }
    })();
  }, [targetUsername]);

  useLayoutEffect(() => {
    if (!messages.length) return;
    if (!hasInitialScrollRef.current) {
      scrollToBottom('auto');
      hasInitialScrollRef.current = true;
      return;
    }
    scrollToBottom('smooth');
  }, [messages]);

  function handleNewMessage(message) {
    const from = (message.from_username || message.fromUsername || message.sender_username || message.from || message.sender || message.username || '').toLowerCase();
    const to = (message.to_username || message.toUsername || message.recipient_username || message.to || message.recipient || '').toLowerCase();
    if (targetUsername && (from === targetUsername || to === targetUsername)) {
      setMessages((prev) => {
        const key = getMessageKey(message);
        if (prev.some((e) => getMessageKey(e) === key)) return prev;
        return [...prev, message];
      });
    }
  }

  async function loadMessages() {
    if (!targetUsername) return;
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
          } catch {}
        }
      }
      if (!hadCache) setLoading(false);

      const data = await api.getMessages(targetUsername);
      const loaded = data.messages || [];
      hasInitialScrollRef.current = false;

      setMessages((prev) => {
        if (!prev.length) return loaded;
        const map = new Map();
        prev.forEach((m) => map.set(getMessageKey(m), m));
        loaded.forEach((m) => map.set(getMessageKey(m), m));
        const merged = Array.from(map.values()).sort((a, b) =>
          new Date(a.created_at || a.createdAt || 0) - new Date(b.created_at || b.createdAt || 0)
        );
        if (cacheKey) { try { sessionStorage.setItem(cacheKey, JSON.stringify(merged)); } catch {} }
        return merged;
      });
    } catch (err) { console.error('DmChat loadMessages error:', err); }
    finally { setLoading(false); }
  }

  async function handleSend(e) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    try {
      const msg = newMessage;
      setNewMessage('');
      setShowEmojiPicker(false);
      const response = await api.sendMessage(targetUsername, msg);
      const sent = response?.message || response;
      const withDefaults = {
        ...sent,
        content: msg,
        from_username: sent?.from_username ?? user?.username,
        to_username: sent?.to_username ?? targetUsername,
        created_at: sent?.created_at ?? new Date().toISOString(),
      };
      if (!socket?.connected) setMessages((prev) => [...prev, withDefaults]);
    } catch (err) { console.error('Send error:', err); }
  }

  async function handleSendGif(gif) {
    try {
      const gifMsg = `[gif]${gif.url}[/gif]`;
      const response = await api.sendMessage(targetUsername, gifMsg);
      const sent = response?.message || response;
      const withDefaults = {
        ...sent,
        content: gifMsg,
        from_username: sent?.from_username ?? user?.username,
        to_username: sent?.to_username ?? targetUsername,
        created_at: sent?.created_at ?? new Date().toISOString(),
      };
      if (!socket?.connected) setMessages((prev) => [...prev, withDefaults]);
      setShowGifPicker(false);
    } catch (err) { console.error('Send GIF error:', err); }
  }

  function renderContent(content) {
    const gifMatch = content?.match(/^\[gif\](.*?)\[\/gif\]$/);
    if (gifMatch) return <div className="dm-msg-gif" onClick={() => setExpandedGif(gifMatch[1])}><img src={gifMatch[1]} alt="GIF" loading="lazy" /></div>;
    if (/^https?:\/\/.*(\.gif|giphy\.com|tenor\.com)/i.test(content?.trim()))
      return <div className="dm-msg-gif" onClick={() => setExpandedGif(content.trim())}><img src={content.trim()} alt="GIF" loading="lazy" /></div>;
    return <span>{content}</span>;
  }

  function formatTime(msg) {
    const raw = msg?.created_at || msg?.createdAt || msg?.timestamp || msg?.sent_at;
    if (!raw) return '';
    const d = new Date(raw);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    if (isToday) return `Today at ${time}`;
    if (isYesterday) return `Yesterday at ${time}`;
    return `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })} ${time}`;
  }

  function scrollToBottom(behavior = 'smooth') {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }

  const emojiOptions = ['😀','😄','😁','😅','😂','😍','🥳','😎','😮','😢','😡','👍','❤️','🔥','🎉'];

  // ── Build grouped messages ──
  const grouped = [];
  messages.forEach((msg, i) => {
    const from = (msg.from_username || msg.fromUsername || msg.sender_username || msg.from || msg.sender || msg.username || '').toLowerCase();
    const prev = i > 0 ? messages[i - 1] : null;
    const prevFrom = prev ? (prev.from_username || prev.fromUsername || prev.sender_username || prev.from || prev.sender || prev.username || '').toLowerCase() : '';
    const timeDiff = prev ? (new Date(msg.created_at || msg.createdAt || 0) - new Date(prev.created_at || prev.createdAt || 0)) : Infinity;
    const isGrouped = from === prevFrom && timeDiff < 7 * 60 * 1000; // 7 min
    grouped.push({ ...msg, _from: from, _isGrouped: isGrouped });
  });

  const myUsername = (user?.username || '').toLowerCase();
  const profileImg = profileData?.profile_image || profileData?.profileImage || targetImage || '';
  const aboutMe = profileData?.bio || profileData?.about || '';
  const memberSince = profileData?.created_at || profileData?.createdAt || '';

  return (
    <div className="dm-chat-container">
      {/* ── Header ── */}
      <div className="dm-chat-header">
        <div className="dm-chat-header-left">
          <span className="dm-chat-header-at">@</span>
          <span className="dm-chat-header-name">{targetDisplay}</span>
        </div>
        <div className="dm-chat-header-actions">
          <button title="Voice Call" className="dm-header-action">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 00-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"/></svg>
          </button>
          <button title="Video Call" className="dm-header-action">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
          </button>
          <button title="Pinned Messages" className="dm-header-action">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4zm3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>
          </button>
          <button
            title="Toggle Profile"
            className={`dm-header-action${showProfilePanel ? ' active' : ''}`}
            onClick={() => setShowProfilePanel((p) => !p)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
          </button>
        </div>
      </div>

      <div className="dm-chat-body">
        {/* ── Messages ── */}
        <div className="dm-chat-messages">
          {loading ? (
            <div className="dm-chat-loading">Loading messages...</div>
          ) : messages.length === 0 ? (
            <div className="dm-chat-empty">
              <div className="dm-chat-empty-avatar">
                {profileImg
                  ? <img src={profileImg} alt="" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                  : <div className="dm-empty-letter">{(targetDisplay)[0]?.toUpperCase() || '?'}</div>}
              </div>
              <h2>{targetDisplay}</h2>
              <p>This is the beginning of your direct message history with <strong>{targetDisplay}</strong>.</p>
            </div>
          ) : (
            grouped.map((msg, i) => {
              const isOwn = msg._from === myUsername;
              const senderName = isOwn ? (user?.username || 'You') : targetDisplay;
              const senderImg = isOwn
                ? (user?.profile_image || user?.profileImage || '/default-avatar.png')
                : (profileImg || '/default-avatar.png');

              if (msg._isGrouped) {
                return (
                  <div key={i} className="dm-msg dm-msg-grouped">
                    <span className="dm-msg-hover-time">{formatTime(msg)?.split(' at ')?.[1] || formatTime(msg)}</span>
                    <div className="dm-msg-content">{renderContent(msg.content)}</div>
                  </div>
                );
              }

              return (
                <div key={i} className="dm-msg dm-msg-full">
                  <div className="dm-msg-avatar">
                    <img src={senderImg} alt="" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                  </div>
                  <div className="dm-msg-body">
                    <div className="dm-msg-header">
                      <span className="dm-msg-author">{senderName}</span>
                      <span className="dm-msg-time">{formatTime(msg)}</span>
                    </div>
                    <div className="dm-msg-content">{renderContent(msg.content)}</div>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Profile panel ── */}
        {showProfilePanel && (
          <div className="dm-profile-panel">
            <div className="dm-profile-banner" />
            <div className="dm-profile-avatar-wrap">
              <img
                src={profileImg || '/default-avatar.png'}
                alt=""
                className="dm-profile-avatar"
                onError={(e) => { e.target.src = '/default-avatar.png'; }}
              />
              <span className="dm-profile-status-dot" />
            </div>
            <div className="dm-profile-body">
              <h3 className="dm-profile-name">{targetDisplay}</h3>
              <span className="dm-profile-handle">{targetUsername}</span>
              <div className="dm-profile-divider" />
              {aboutMe && (
                <div className="dm-profile-section">
                  <h4>About Me</h4>
                  <p>{aboutMe}</p>
                </div>
              )}
              {memberSince && (
                <div className="dm-profile-section">
                  <h4>Member Since</h4>
                  <p>{new Date(memberSince).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                </div>
              )}
              <div className="dm-profile-mutual">
                <button className="dm-profile-mutual-btn">
                  <span>Mutual Servers</span>
                  <span className="dm-profile-mutual-arrow">›</span>
                </button>
                <button className="dm-profile-mutual-btn">
                  <span>Mutual Friends</span>
                  <span className="dm-profile-mutual-arrow">›</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Input ── */}
      <form className="dm-chat-input-bar" onSubmit={handleSend}>
        <button type="button" className="dm-input-attach" title="Attach file">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          placeholder={`Message @${targetDisplay}`}
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
        />
        <div className="dm-input-actions">
          <button
            type="button"
            className="dm-input-btn"
            onClick={() => { setShowGifPicker((p) => !p); setShowEmojiPicker(false); }}
            title="GIF"
          >
            <span className="dm-gif-label">GIF</span>
          </button>
          <button
            type="button"
            className="dm-input-btn"
            onClick={() => { setShowEmojiPicker((p) => !p); setShowGifPicker(false); }}
            title="Emoji"
          >
            <SmileIcon size={22} />
          </button>
        </div>
      </form>

      {/* ── GIF picker ── */}
      {showGifPicker && (
        <div className="dm-gif-picker-wrap">
          <GifPicker onSelect={handleSendGif} onClose={() => setShowGifPicker(false)} />
        </div>
      )}

      {/* ── Emoji picker ── */}
      {showEmojiPicker && (
        <div className="dm-emoji-picker">
          {emojiOptions.map((emoji) => (
            <button key={emoji} type="button" className="dm-emoji-option" onClick={() => { setNewMessage((p) => `${p}${emoji}`); setShowEmojiPicker(false); }}>
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* ── GIF lightbox ── */}
      {expandedGif && (
        <div className="gif-lightbox" onClick={() => setExpandedGif(null)}>
          <div className="gif-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={expandedGif} alt="GIF" />
            <button className="gif-lightbox-close" onClick={() => setExpandedGif(null)}>✕</button>
          </div>
        </div>
      )}
    </div>
  );
}
