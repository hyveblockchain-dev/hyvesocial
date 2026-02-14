// src/components/Groups/DmChat.jsx — Discord-style DM chat view
// Features: edit, delete, typing indicators, reactions, file attachments, markdown, reply-to
import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import socketService from '../../services/socket';
import { SmileIcon } from '../Icons/Icons';
import GifPicker from '../GifPicker/GifPicker';
import { formatDateTime } from '../../utils/date';

const EMOJI_LIST = [
  '😀','😂','😍','🥰','😎','🤔','😮','😢','😡','🥳',
  '👍','👎','❤️','🔥','🎉','💯','✅','❌','⭐','💀',
  '🙏','👏','🤝','💪','👀','🧠','💡','📌','🚀','🏆',
  '😊','😁','😆','🤣','😅','😇','🙂','😉','😌','😋',
  '😜','🤪','😝','🤑','🤗','🤭','🤫','🤨','😐','😑',
  '😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪',
];

const REACTION_EMOJIS = ['👍','❤️','😂','😮','😢','🔥','🎉','💯'];

export default function DmChat({ selectedUser, onBack }) {
  const { user, socket } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [expandedGif, setExpandedGif] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showProfilePanel, setShowProfilePanel] = useState(() => window.innerWidth > 1024);
  const [profileData, setProfileData] = useState(null);

  // New feature state
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const [sending, setSending] = useState(false);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const hasInitialScrollRef = useRef(false);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const targetUsername = (selectedUser?.username || '').toLowerCase();
  const targetDisplay = selectedUser?.username || 'Unknown';
  const targetImage = selectedUser?.profileImage || selectedUser?.profile_image || '';
  const cacheKey = targetUsername ? `chat_messages_${targetUsername}` : null;

  const getMessageKey = (m) =>
    m?.id || m?.message_id ||
    `${m?.from_username || m?.fromUsername || ''}-${m?.to_username || m?.toUsername || ''}-${m?.created_at || m?.createdAt || ''}`;

  const getMsgFrom = (msg) =>
    (msg.from_username || msg.fromUsername || msg.sender_username || msg.from || msg.sender || msg.username || '').toLowerCase();

  const myUsername = (user?.username || '').toLowerCase();

  // ── Load messages ──
  useEffect(() => {
    if (!targetUsername) { setLoading(false); return; }
    setMessages([]);
    hasInitialScrollRef.current = false;
    setEditingId(null);
    setReplyTo(null);
    loadMessages();
  }, [targetUsername]);

  // ── Socket: new messages + edit + delete ──
  useEffect(() => {
    const sock = socket || socketService.socket;
    if (!sock || !targetUsername) return;

    const handleNewMessage = (message) => {
      const from = getMsgFrom(message);
      const to = (message.to_username || message.toUsername || message.recipient_username || message.to || message.recipient || '').toLowerCase();
      if (from === targetUsername || to === targetUsername) {
        setMessages((prev) => {
          const key = getMessageKey(message);
          if (prev.some((e) => getMessageKey(e) === key)) return prev;
          return [...prev, message];
        });
      }
    };

    const handleEdited = (msg) => {
      setMessages((prev) => prev.map((m) => {
        const mKey = getMessageKey(m);
        const editKey = getMessageKey(msg);
        return mKey === editKey ? { ...m, ...msg } : m;
      }));
    };

    const handleDeleted = (data) => {
      const id = data?.messageId || data?.id || data?.message_id;
      if (id) {
        setMessages((prev) => prev.filter((m) => (m.id || m.message_id) !== id));
      }
    };

    const handleTyping = (data) => {
      const typer = (data?.from || data?.username || '').toLowerCase();
      if (typer && typer === targetUsername) {
        setTypingUsers((prev) => prev.includes(typer) ? prev : [...prev, typer]);
        setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u !== typer));
        }, 3000);
      }
    };

    const handleStopTyping = (data) => {
      const typer = (data?.from || data?.username || '').toLowerCase();
      setTypingUsers((prev) => prev.filter((u) => u !== typer));
    };

    sock.on('new_message', handleNewMessage);
    sock.on('dm_message_edited', handleEdited);
    sock.on('dm_message_deleted', handleDeleted);
    sock.on('user_typing', handleTyping);
    sock.on('user_stopped_typing', handleStopTyping);

    return () => {
      sock.off('new_message', handleNewMessage);
      sock.off('dm_message_edited', handleEdited);
      sock.off('dm_message_deleted', handleDeleted);
      sock.off('user_typing', handleTyping);
      sock.off('user_stopped_typing', handleStopTyping);
    };
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
    // Only auto-scroll if near bottom
    const container = messagesContainerRef.current;
    if (container) {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distFromBottom < 150) scrollToBottom('smooth');
    }
  }, [messages]);

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

  // ── Send message ──
  async function handleSend(e) {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      const msg = newMessage;
      setNewMessage('');
      setShowEmojiPicker(false);
      const replyId = replyTo ? (replyTo.id || replyTo.message_id) : null;
      const content = replyId ? `[reply:${replyId}]${msg}` : msg;
      const response = await api.sendMessage(targetUsername, content);
      const sent = response?.message || response;
      const withDefaults = {
        ...sent,
        content: msg,
        reply_to: replyId,
        from_username: sent?.from_username ?? user?.username,
        to_username: sent?.to_username ?? targetUsername,
        created_at: sent?.created_at ?? new Date().toISOString(),
      };
      const sock = socket || socketService.socket;
      if (!sock?.connected) setMessages((prev) => [...prev, withDefaults]);
      setReplyTo(null);
      // Stop typing
      socketService.stopTyping(user?.username, targetUsername);
    } catch (err) { console.error('Send error:', err); }
    finally { setSending(false); inputRef.current?.focus(); }
  }

  // ── Edit message ──
  async function handleEdit(messageId) {
    if (!editText.trim()) return;
    try {
      await api.editDmMessage(messageId, editText.trim());
      // Optimistic update
      setMessages((prev) => prev.map((m) =>
        (m.id || m.message_id) === messageId
          ? { ...m, content: editText.trim(), edited_at: new Date().toISOString() }
          : m
      ));
      setEditingId(null);
      setEditText('');
    } catch (err) {
      console.error('Edit DM error:', err);
      // Still apply locally if backend doesn't support it yet
      setMessages((prev) => prev.map((m) =>
        (m.id || m.message_id) === messageId
          ? { ...m, content: editText.trim(), edited_at: new Date().toISOString() }
          : m
      ));
      setEditingId(null);
      setEditText('');
    }
  }

  // ── Delete message ──
  async function handleDelete(messageId) {
    try {
      await api.deleteDmMessage(messageId);
      setMessages((prev) => prev.filter((m) => (m.id || m.message_id) !== messageId));
    } catch (err) {
      console.error('Delete DM error:', err);
      // Still remove locally
      setMessages((prev) => prev.filter((m) => (m.id || m.message_id) !== messageId));
    }
  }

  // ── Send GIF ──
  async function handleSendGif(gif) {
    setSending(true);
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
      const sock = socket || socketService.socket;
      if (!sock?.connected) setMessages((prev) => [...prev, withDefaults]);
      setShowGifPicker(false);
    } catch (err) { console.error('Send GIF error:', err); }
    finally { setSending(false); }
  }

  // ── File attachment ──
  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (!file.type.startsWith('image/')) {
      alert('Only image files are supported.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert('File must be under 10 MB.');
      return;
    }
    setSending(true);
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const response = await api.sendMessage(targetUsername, newMessage.trim() || '', base64);
      const sent = response?.message || response;
      const withDefaults = {
        ...sent,
        content: newMessage.trim() || '',
        image_url: base64,
        from_username: sent?.from_username ?? user?.username,
        to_username: sent?.to_username ?? targetUsername,
        created_at: sent?.created_at ?? new Date().toISOString(),
      };
      const sock = socket || socketService.socket;
      if (!sock?.connected) setMessages((prev) => [...prev, withDefaults]);
      setNewMessage('');
      setReplyTo(null);
    } catch (err) { console.error('Send image error:', err); }
    finally { setSending(false); inputRef.current?.focus(); }
  }

  // ── Reactions (client-side with local persistence) ──
  function handleAddReaction(msgId, emoji) {
    setReactionPickerMsgId(null);
    setMessages((prev) => prev.map((m) => {
      const mId = m.id || m.message_id;
      if (mId !== msgId) return m;
      const reactions = [...(m.reactions || [])];
      const idx = reactions.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        const hasMe = reactions[idx].me;
        if (hasMe) {
          reactions[idx] = { ...reactions[idx], count: Math.max(0, reactions[idx].count - 1), me: false };
          if (reactions[idx].count <= 0) reactions.splice(idx, 1);
        } else {
          reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1, me: true };
        }
      } else {
        reactions.push({ emoji, count: 1, me: true });
      }
      return { ...m, reactions };
    }));
  }

  // ── Typing indicator ──
  function handleInputChange(e) {
    setNewMessage(e.target.value);
    if (user?.username && targetUsername) {
      socketService.sendTyping(user.username, targetUsername);
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        socketService.stopTyping(user.username, targetUsername);
      }, 2000);
    }
  }

  // ── Scroll tracking ──
  function handleScroll() {
    const container = messagesContainerRef.current;
    if (!container) return;
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowJumpToPresent(distFromBottom > 300);
  }

  // ── Markdown rendering ──
  function renderMarkdown(text) {
    if (!text) return null;
    const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\n/, '');
        return <pre key={i} className="dm-code-block"><code>{code}</code></pre>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="dm-inline-code">{part.slice(1, -1)}</code>;
      }
      return <span key={i}>{renderInline(part)}</span>;
    });
  }

  function renderInline(text) {
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|__[^_]+__|https?:\/\/[^\s<>]+)/g;
    const parts = text.split(pattern);
    return parts.map((part, i) => {
      if (!part) return null;
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('__') && part.endsWith('__'))
        return <u key={i}>{part.slice(2, -2)}</u>;
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
        return <em key={i}>{part.slice(1, -1)}</em>;
      if (part.startsWith('~~') && part.endsWith('~~'))
        return <del key={i}>{part.slice(2, -2)}</del>;
      if (/^https?:\/\//.test(part))
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="dm-msg-link">{part}</a>;
      return part;
    });
  }

  // ── Content rendering ──
  function renderContent(content) {
    if (!content) return null;
    const gifMatch = content?.match(/^\[gif\](.*?)\[\/gif\]$/);
    if (gifMatch) return <div className="dm-msg-gif" onClick={() => setExpandedGif(gifMatch[1])}><img src={gifMatch[1]} alt="GIF" loading="lazy" /></div>;
    if (/^https?:\/\/.*(\.gif|giphy\.com|tenor\.com)/i.test(content?.trim()))
      return <div className="dm-msg-gif" onClick={() => setExpandedGif(content.trim())}><img src={content.trim()} alt="GIF" loading="lazy" /></div>;
    return <span className="dm-msg-text">{renderMarkdown(content)}</span>;
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

  function formatDateDivider(msg) {
    const raw = msg?.created_at || msg?.createdAt || msg?.timestamp;
    if (!raw) return '';
    return new Date(raw).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
  }

  function scrollToBottom(behavior = 'smooth') {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }

  // ── Build grouped messages with date dividers ──
  const grouped = [];
  let lastDateStr = '';
  messages.forEach((msg, i) => {
    const from = getMsgFrom(msg);
    const prev = i > 0 ? messages[i - 1] : null;
    const prevFrom = prev ? getMsgFrom(prev) : '';
    const timeDiff = prev ? (new Date(msg.created_at || msg.createdAt || 0) - new Date(prev.created_at || prev.createdAt || 0)) : Infinity;
    const isGrouped = from === prevFrom && timeDiff < 7 * 60 * 1000;

    const dateStr = formatDateDivider(msg);
    const showDateDivider = dateStr !== lastDateStr;
    lastDateStr = dateStr;

    grouped.push({ ...msg, _from: from, _isGrouped: isGrouped && !showDateDivider, _showDateDivider: showDateDivider, _dateStr: dateStr });
  });

  const profileImg = profileData?.profile_image || profileData?.profileImage || targetImage || '';
  const aboutMe = profileData?.bio || profileData?.about || '';
  const memberSince = profileData?.created_at || profileData?.createdAt || '';

  // Filter for search
  const displayMessages = searchQuery
    ? grouped.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
    : grouped;

  return (
    <div className="dm-chat-container">
      {/* ── Header ── */}
      <div className="dm-chat-header">
        <div className="dm-chat-header-left">
          {onBack && (
            <button className="dm-header-back" onClick={onBack} title="Back">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
            </button>
          )}
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
            title="Search"
            className={`dm-header-action${showSearch ? ' active' : ''}`}
            onClick={() => { setShowSearch((p) => !p); setSearchQuery(''); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.53 20.47l-3.66-3.66A8.45 8.45 0 0019 13a8 8 0 10-8 8 8.45 8.45 0 003.81-1.13l3.66 3.66a.75.75 0 001.06-1.06zM3.5 13a7.5 7.5 0 117.5 7.5A7.508 7.508 0 013.5 13z"/></svg>
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

      {/* Search bar */}
      {showSearch && (
        <div className="dm-search-bar">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <span className="dm-search-count">
              {messages.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase())).length} results
            </span>
          )}
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}>✕</button>
        </div>
      )}

      <div className={`dm-chat-body${showProfilePanel ? ' profile-open' : ''}`}>
        {/* ── Messages ── */}
        <div className="dm-chat-messages" ref={messagesContainerRef} onScroll={handleScroll}>
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
            displayMessages.map((msg, i) => {
              const isOwn = msg._from === myUsername;
              const msgId = msg.id || msg.message_id;
              const senderName = isOwn ? (user?.username || 'You') : targetDisplay;
              const senderImg = isOwn
                ? (user?.profile_image || user?.profileImage || '/default-avatar.png')
                : (profileImg || '/default-avatar.png');

              // Find replied message
              const replyId = msg.reply_to || (msg.content?.match(/^\[reply:(\d+)\]/)?.[1]);
              const repliedMsg = replyId ? messages.find((m) => (m.id || m.message_id) == replyId) : null;
              const displayContent = msg.content?.replace(/^\[reply:\d+\]/, '') || msg.content;

              return (
                <div key={msgId || i}>
                  {/* Date divider */}
                  {msg._showDateDivider && (
                    <div className="dm-date-divider">
                      <span>{msg._dateStr}</span>
                    </div>
                  )}

                  {/* Grouped (continuation) message */}
                  {msg._isGrouped ? (
                    <div className={`dm-msg dm-msg-grouped${editingId === msgId ? ' dm-msg-editing' : ''}`}>
                      <span className="dm-msg-hover-time">{formatTime(msg)?.split(' at ')?.[1] || formatTime(msg)}</span>
                      <div className="dm-msg-content">
                        {editingId === msgId ? (
                          <div className="dm-msg-edit">
                            <input
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleEdit(msgId);
                                if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                              }}
                              autoFocus
                            />
                            <div className="dm-msg-edit-hint">
                              escape to <button onClick={() => { setEditingId(null); setEditText(''); }}>cancel</button> · enter to <button onClick={() => handleEdit(msgId)}>save</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {renderContent(displayContent)}
                            {msg.edited_at && <span className="dm-msg-edited">(edited)</span>}
                          </>
                        )}
                        {msg.image_url && (
                          <img
                            src={msg.image_url}
                            alt=""
                            className="dm-msg-image"
                            onClick={() => setLightboxUrl(msg.image_url)}
                          />
                        )}
                      </div>
                      {/* Reactions */}
                      {msg.reactions && msg.reactions.length > 0 && (
                        <div className="dm-msg-reactions">
                          {msg.reactions.map((r, ri) => (
                            <button
                              key={ri}
                              className={`dm-reaction-badge${r.me ? ' dm-reaction-mine' : ''}`}
                              onClick={() => handleAddReaction(msgId, r.emoji)}
                            >
                              <span className="reaction-emoji">{r.emoji}</span>
                              <span className="reaction-count">{r.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {/* Reaction picker inline */}
                      {reactionPickerMsgId === msgId && (
                        <div className="dm-reaction-picker">
                          {REACTION_EMOJIS.map((em) => (
                            <button key={em} onClick={() => handleAddReaction(msgId, em)}>{em}</button>
                          ))}
                          <button onClick={() => setReactionPickerMsgId(null)}>✕</button>
                        </div>
                      )}
                      {/* Hover actions */}
                      {editingId !== msgId && (
                        <div className="dm-msg-actions">
                          <button title="Add Reaction" onClick={() => setReactionPickerMsgId((p) => p === msgId ? null : msgId)}>😊</button>
                          <button title="Reply" onClick={() => setReplyTo(msg)}>↩</button>
                          {isOwn && <button title="Edit" onClick={() => { setEditingId(msgId); setEditText(displayContent); }}>✏️</button>}
                          {isOwn && <button title="Delete" onClick={() => handleDelete(msgId)}>🗑️</button>}
                        </div>
                      )}
                    </div>
                  ) : (
                    /* Full (header) message */
                    <div className={`dm-msg dm-msg-full${editingId === msgId ? ' dm-msg-editing' : ''}`}>
                      <div className="dm-msg-avatar">
                        <img src={senderImg} alt="" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                      </div>
                      <div className="dm-msg-body">
                        <div className="dm-msg-header">
                          <span className="dm-msg-author">{senderName}</span>
                          <span className="dm-msg-time">{formatTime(msg)}</span>
                        </div>
                        {/* Reply reference */}
                        {repliedMsg && (
                          <div className="dm-msg-reply-ref">
                            <span className="dm-reply-arrow">↩</span>
                            <img src={getMsgFrom(repliedMsg) === myUsername ? (user?.profile_image || user?.profileImage || '/default-avatar.png') : (profileImg || '/default-avatar.png')} alt="" className="dm-reply-avatar" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                            <span className="dm-reply-username">{getMsgFrom(repliedMsg) === myUsername ? (user?.username || 'You') : targetDisplay}</span>
                            <span className="dm-reply-preview">{(repliedMsg.content?.replace(/^\[reply:\d+\]/, '') || repliedMsg.content || '').slice(0, 80)}</span>
                          </div>
                        )}
                        <div className="dm-msg-content">
                          {editingId === msgId ? (
                            <div className="dm-msg-edit">
                              <input
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleEdit(msgId);
                                  if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                                }}
                                autoFocus
                              />
                              <div className="dm-msg-edit-hint">
                                escape to <button onClick={() => { setEditingId(null); setEditText(''); }}>cancel</button> · enter to <button onClick={() => handleEdit(msgId)}>save</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {renderContent(displayContent)}
                              {msg.edited_at && <span className="dm-msg-edited">(edited)</span>}
                            </>
                          )}
                          {msg.image_url && (
                            <img
                              src={msg.image_url}
                              alt=""
                              className="dm-msg-image"
                              onClick={() => setLightboxUrl(msg.image_url)}
                            />
                          )}
                        </div>
                        {/* Reactions */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="dm-msg-reactions">
                            {msg.reactions.map((r, ri) => (
                              <button
                                key={ri}
                                className={`dm-reaction-badge${r.me ? ' dm-reaction-mine' : ''}`}
                                onClick={() => handleAddReaction(msgId, r.emoji)}
                              >
                                <span className="reaction-emoji">{r.emoji}</span>
                                <span className="reaction-count">{r.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        {/* Reaction picker inline */}
                        {reactionPickerMsgId === msgId && (
                          <div className="dm-reaction-picker">
                            {REACTION_EMOJIS.map((em) => (
                              <button key={em} onClick={() => handleAddReaction(msgId, em)}>{em}</button>
                            ))}
                            <button onClick={() => setReactionPickerMsgId(null)}>✕</button>
                          </div>
                        )}
                      </div>
                      {/* Hover actions */}
                      {editingId !== msgId && (
                        <div className="dm-msg-actions">
                          <button title="Add Reaction" onClick={() => setReactionPickerMsgId((p) => p === msgId ? null : msgId)}>😊</button>
                          <button title="Reply" onClick={() => setReplyTo(msg)}>↩</button>
                          {isOwn && <button title="Edit" onClick={() => { setEditingId(msgId); setEditText(displayContent); }}>✏️</button>}
                          {isOwn && <button title="Delete" onClick={() => handleDelete(msgId)}>🗑️</button>}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ── Profile panel ── */}
        {showProfilePanel && (
          <div className="dm-profile-panel">
            <button className="dm-profile-close-mobile" onClick={() => setShowProfilePanel(false)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
              Back
            </button>
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

      {/* Jump to present */}
      {showJumpToPresent && (
        <button className="dm-jump-present" onClick={() => scrollToBottom('smooth')}>
          Jump to present <span>↓</span>
        </button>
      )}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="dm-typing">
          <span className="dm-typing-dots"><span /><span /><span /></span>
          <strong>{typingUsers.map(u => u === targetUsername ? targetDisplay : u).join(', ')}</strong> is typing...
        </div>
      )}

      {/* Reply bar */}
      {replyTo && (
        <div className="dm-reply-bar">
          <span>Replying to <strong>{getMsgFrom(replyTo) === myUsername ? 'yourself' : targetDisplay}</strong>: {(replyTo.content?.replace(/^\[reply:\d+\]/, '') || replyTo.content || '').slice(0, 60)}</span>
          <button onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* ── Input ── */}
      <form className="dm-chat-input-bar" onSubmit={handleSend}>
        <button type="button" className="dm-input-attach" title="Attach file" onClick={() => fileInputRef.current?.click()}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/></svg>
        </button>
        <input
          ref={inputRef}
          type="text"
          placeholder={`Message @${targetDisplay}`}
          value={newMessage}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) handleSend(e);
          }}
          disabled={sending}
        />
        <div className="dm-input-actions">
          <button
            type="button"
            className={`dm-input-btn${showGifPicker ? ' active' : ''}`}
            onClick={() => { setShowGifPicker((p) => !p); setShowEmojiPicker(false); }}
            title="GIF"
          >
            <span className="dm-gif-label">GIF</span>
          </button>
          <button
            type="button"
            className={`dm-input-btn${showEmojiPicker ? ' active' : ''}`}
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

      {/* ── Emoji picker (expanded) ── */}
      {showEmojiPicker && (
        <div className="dm-emoji-picker">
          <div className="dm-emoji-picker-header">
            <span>Emoji</span>
            <button onClick={() => setShowEmojiPicker(false)}>✕</button>
          </div>
          <div className="dm-emoji-grid">
            {EMOJI_LIST.map((emoji) => (
              <button key={emoji} type="button" onClick={() => { setNewMessage((p) => `${p}${emoji}`); setShowEmojiPicker(false); }}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── GIF lightbox ── */}
      {expandedGif && (
        <div className="dm-lightbox" onClick={() => setExpandedGif(null)}>
          <div className="dm-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={expandedGif} alt="GIF" />
            <button className="dm-lightbox-close" onClick={() => setExpandedGif(null)}>✕</button>
          </div>
        </div>
      )}

      {/* ── Image lightbox ── */}
      {lightboxUrl && !expandedGif && (
        <div className="dm-lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
          <button className="dm-lightbox-close" onClick={() => setLightboxUrl(null)}>✕</button>
        </div>
      )}
    </div>
  );
}
