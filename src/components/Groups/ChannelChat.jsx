import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../services/api';
import socketService from '../../services/socket';
import { formatDate, formatDateTime } from '../../utils/date';
import GifPicker from '../GifPicker/GifPicker';
import './ChannelChat.css';

// Common emoji grid for quick picking
const EMOJI_LIST = [
  '😀','😂','😍','🥰','😎','🤔','😮','😢','😡','🥳',
  '👍','👎','❤️','🔥','🎉','💯','✅','❌','⭐','💀',
  '🙏','👏','🤝','💪','👀','🧠','💡','📌','🚀','🏆',
  '😊','😁','😆','🤣','😅','😇','🙂','😉','😌','😋',
  '😜','🤪','😝','🤑','🤗','🤭','🤫','🤨','😐','😑',
  '😶','😏','😒','🙄','😬','😮‍💨','🤥','😌','😔','😪',
];

export default function ChannelChat({ channel, groupId, user, isAdmin, onToggleMembers, showMembers, members = [] }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [typingUsers, setTypingUsers] = useState([]);
  const [hasMore, setHasMore] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showGifPicker, setShowGifPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const [userPopup, setUserPopup] = useState(null); // { username, profileImage, role, x, y }
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const myUsername = (user?.username || '').toLowerCase();
  const myAddress = (user?.wallet_address || user?.walletAddress || '').toLowerCase();

  // Close user popup on click outside
  useEffect(() => {
    if (!userPopup) return;
    const handler = (e) => {
      if (!e.target.closest('.channel-user-popup')) setUserPopup(null);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [userPopup]);

  const showUserCard = (msg, e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const member = members.find((m) => (m.username || '').toLowerCase() === (msg.username || '').toLowerCase());
    setUserPopup({
      username: msg.username || 'Unknown',
      profileImage: msg.profile_image || '/default-avatar.png',
      role: member?.role || null,
      userAddress: msg.user_address,
      x: rect.right + 8,
      y: rect.top,
    });
  };

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!channel?.id) return;
    setLoading(true);
    try {
      const data = await api.getChannelMessages(channel.id, { limit: 50 });
      setMessages(data?.messages || []);
      setHasMore((data?.messages || []).length >= 50);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }, [channel?.id]);

  useEffect(() => {
    loadMessages();
    setInput('');
    setReplyTo(null);
    setEditingId(null);
  }, [loadMessages]);

  // Socket.io real-time
  useEffect(() => {
    if (!channel?.id || !socketService.socket) return;

    socketService.socket.emit('join_channel', channel.id);

    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    const handleDeletedMessage = ({ messageId }) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    };

    const handleEditedMessage = (msg) => {
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, ...msg } : m)));
    };

    const handleTyping = ({ channelId, username }) => {
      if (channelId !== channel.id) return;
      setTypingUsers((prev) => {
        if (prev.includes(username)) return prev;
        return [...prev, username];
      });
      setTimeout(() => {
        setTypingUsers((prev) => prev.filter((u) => u !== username));
      }, 3000);
    };

    socketService.socket.on('channel_message', handleNewMessage);
    socketService.socket.on('channel_message_deleted', handleDeletedMessage);
    socketService.socket.on('channel_message_edited', handleEditedMessage);
    socketService.socket.on('channel_typing', handleTyping);

    return () => {
      socketService.socket.emit('leave_channel', channel.id);
      socketService.socket.off('channel_message', handleNewMessage);
      socketService.socket.off('channel_message_deleted', handleDeletedMessage);
      socketService.socket.off('channel_message_edited', handleEditedMessage);
      socketService.socket.off('channel_typing', handleTyping);
    };
  }, [channel?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Load more (scroll up)
  const loadMore = async () => {
    if (!hasMore || loading || messages.length === 0) return;
    const firstId = messages[0]?.id;
    try {
      const data = await api.getChannelMessages(channel.id, { limit: 50, before: firstId });
      const older = data?.messages || [];
      setHasMore(older.length >= 50);
      setMessages((prev) => [...older, ...prev]);
    } catch (err) {
      console.error('Failed to load more messages:', err);
    }
  };

  // Send message
  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api.sendChannelMessage(channel.id, {
        content: input.trim(),
        replyTo: replyTo?.id || null,
      });
      setInput('');
      setReplyTo(null);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Edit message
  const handleEdit = async (messageId) => {
    if (!editText.trim()) return;
    try {
      await api.editChannelMessage(channel.id, messageId, editText.trim());
      setEditingId(null);
      setEditText('');
    } catch (err) {
      console.error('Failed to edit:', err);
    }
  };

  // Delete message
  const handleDelete = async (messageId) => {
    try {
      await api.deleteChannelMessage(channel.id, messageId);
    } catch (err) {
      console.error('Failed to delete:', err);
    }
  };

  // File attachment — convert to base64 and send as imageUrl
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset file input so same file can be re-selected
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
      await api.sendChannelMessage(channel.id, {
        content: input.trim() || '',
        imageUrl: base64,
        replyTo: replyTo?.id || null,
      });
      setInput('');
      setReplyTo(null);
    } catch (err) {
      console.error('Failed to send image:', err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // GIF select
  const handleGifSelect = async (gif) => {
    setShowGifPicker(false);
    setSending(true);
    try {
      await api.sendChannelMessage(channel.id, {
        content: '',
        imageUrl: gif.url,
        replyTo: replyTo?.id || null,
      });
      setReplyTo(null);
    } catch (err) {
      console.error('Failed to send GIF:', err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Emoji insert into input
  const handleEmojiSelect = (emoji) => {
    setInput((prev) => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  // Add reaction to message (client-side toggle — backend support can be added later)
  const handleAddReaction = (msgId, emoji) => {
    setReactionPickerMsgId(null);
    setMessages((prev) => prev.map((m) => {
      if (m.id !== msgId) return m;
      const reactions = [...(m.reactions || [])];
      const idx = reactions.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        reactions[idx] = { ...reactions[idx], count: reactions[idx].count + 1 };
      } else {
        reactions.push({ emoji, count: 1 });
      }
      return { ...m, reactions };
    }));
  };

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const date = new Date(msg.created_at).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(msg);
    return groups;
  }, {});

  // Check if message is from same author as previous (for compact display)
  const shouldShowHeader = (msg, idx) => {
    if (idx === 0) return true;
    const prev = messages[idx - 1];
    if (!prev) return true;
    if (prev.user_address !== msg.user_address) return true;
    const gap = new Date(msg.created_at) - new Date(prev.created_at);
    return gap > 5 * 60 * 1000; // 5 minutes
  };

  // ── Markdown rendering ──
  function renderMarkdown(text) {
    if (!text) return null;
    const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\n/, '');
        return <pre key={i} className="msg-code-block"><code>{code}</code></pre>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="msg-inline-code">{part.slice(1, -1)}</code>;
      }
      return <span key={i}>{renderInline(part)}</span>;
    });
  }

  function renderInline(text) {
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|__[^_]+__|https?:\/\/[^\s<>]+|<@([^>]+)>)/g;
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
        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="msg-link">{part}</a>;
      // @mention
      if (part.startsWith('<@') && part.endsWith('>'))
        return null; // consumed by capture group
      // Check if it's a captured username from <@username>
      const memberMatch = members.find(m => (m.username || '').toLowerCase() === (part || '').toLowerCase());
      if (memberMatch && parts[i - 1] && parts[i - 1].startsWith('<@'))
        return <span key={i} className="msg-mention">@{memberMatch.username}</span>;
      return part;
    });
  }

  // ── @mention autocomplete ──
  const mentionResults = mentionQuery !== null
    ? members.filter(m => (m.username || '').toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 8)
    : [];

  function handleMentionKeyDown(e) {
    if (mentionQuery !== null && mentionResults.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(p => (p + 1) % mentionResults.length);
        return true;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(p => (p - 1 + mentionResults.length) % mentionResults.length);
        return true;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
        return true;
      }
      if (e.key === 'Escape') {
        setMentionQuery(null);
        return true;
      }
    }
    return false;
  }

  function insertMention(member) {
    const atIdx = input.lastIndexOf('@');
    if (atIdx >= 0) {
      const before = input.slice(0, atIdx);
      setInput(before + `@${member.username} `);
    }
    setMentionQuery(null);
    setMentionIndex(0);
    inputRef.current?.focus();
  }

  function handleInputChangeWithMentions(e) {
    const val = e.target.value;
    setInput(val);
    // Check for @mention trigger
    const cursor = e.target.selectionStart;
    const textBeforeCursor = val.slice(0, cursor);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionQuery(atMatch[1]);
      setMentionIndex(0);
    } else {
      setMentionQuery(null);
    }
    // Typing indicator
    if (socketService.socket && channel?.id && user?.username) {
      socketService.socket.emit('typing_channel', { channelId: channel.id, username: user.username });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {}, 2000);
    }
  }

  // ── Scroll tracking for "Jump to Present" ──
  const handleScrollWithJump = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    if (container.scrollTop < 100 && hasMore && !loading) loadMore();
    const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    setShowJumpToPresent(distFromBottom > 300);
  };

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }

  if (!channel) {
    return (
      <div className="channel-chat-empty">
        <div className="channel-chat-empty-icon">#</div>
        <p>Select a channel to start chatting</p>
      </div>
    );
  }

  return (
    <div className="channel-chat">
      {/* Channel header */}
      <div className="channel-chat-header">
        <span className="channel-hash">#</span>
        <span className="channel-chat-name">{channel.name}</span>
        {channel.topic && (
          <>
            <div className="channel-header-divider" />
            <span className="channel-chat-topic">{channel.topic}</span>
          </>
        )}
        <div className="channel-header-actions">
          <button
            className={`channel-header-btn${showSearch ? ' active' : ''}`}
            title="Search"
            onClick={() => { setShowSearch((p) => !p); setSearchQuery(''); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.53 20.47l-3.66-3.66A8.45 8.45 0 0019 13a8 8 0 10-8 8 8.45 8.45 0 003.81-1.13l3.66 3.66a.75.75 0 001.06-1.06zM3.5 13a7.5 7.5 0 117.5 7.5A7.508 7.508 0 013.5 13z"/></svg>
          </button>
          <button
            className={`channel-header-btn${showPinnedPanel ? ' active' : ''}`}
            title="Pinned Messages"
            onClick={() => setShowPinnedPanel(p => !p)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12l-4.2-3.78-.01-.01a.72.72 0 00-.49-.21c-.44 0-.72.36-.72.72v2.28H5.35c-.09 0-.37 0-.37.37v1.26c0 .09 0 .37.37.37h11.23v2.28c0 .2.06.39.22.52a.72.72 0 001-.03L22 12z"/></svg>
          </button>
          <button
            className={`channel-header-btn${showMembers ? ' active' : ''}`}
            title="Member List"
            onClick={onToggleMembers}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M14 8.006c0 2.206-1.346 4-3 4s-3-1.794-3-4 1.346-4 3-4 3 1.794 3 4zm-6.6 8.004c0-.69.18-1.34.5-1.904A3.998 3.998 0 004 18.006v1c0 .55.45 1 1 1h3.6a5.967 5.967 0 01-1.2-4zm12.6 0c0 1.63-.63 3.12-1.65 4.23.032-.077.05-.16.05-.24v-1c0-1.32-.64-2.49-1.63-3.23.43.72.68 1.56.68 2.46 0 .79-.19 1.54-.55 2.2l.15.01a1 1 0 001-.99v-1a4 4 0 00-4-4h-4a4 4 0 00-4 4v1a1 1 0 001 1h8a1 1 0 001-1v-1c0-.34-.04-.67-.12-.99A5.005 5.005 0 0120 16.01zM18 8.006c0 1.654-1.346 3-3 3s-3-1.346-3-3 1.346-3 3-3 3 1.346 3 3z"/></svg>
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="channel-search-bar">
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
          {searchQuery && (
            <span className="channel-search-count">
              {messages.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase())).length} results
            </span>
          )}
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); }}>✕</button>
        </div>
      )}

      {/* Pinned messages panel */}
      {showPinnedPanel && (
        <div className="channel-pinned-panel">
          <div className="channel-pinned-header">
            <span>Pinned Messages</span>
            <button onClick={() => setShowPinnedPanel(false)}>✕</button>
          </div>
          <div className="channel-pinned-body">
            <div className="channel-pinned-empty">
              <span>📌</span>
              <p>No pinned messages in this channel yet.</p>
              <p className="channel-pinned-hint">Pin important messages so they're easy to find.</p>
            </div>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div
        className="channel-messages"
        ref={messagesContainerRef}
        onScroll={handleScrollWithJump}
      >
        {loading && messages.length === 0 ? (
          <div className="channel-messages-loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="channel-welcome">
            <div className="channel-welcome-hash">#</div>
            <h2>Welcome to #{channel.name}!</h2>
            <p>This is the start of the <strong>#{channel.name}</strong> channel.{channel.topic ? ` ${channel.topic}` : ''}</p>
          </div>
        ) : (
          (() => {
            const filtered = searchQuery
              ? messages.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
              : messages;
            let lastDate = null;
            return filtered.map((msg, idx, arr) => {
              const msgDate = new Date(msg.created_at).toLocaleDateString('en-US', {
                weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
              });
              const showDateDivider = msgDate !== lastDate;
              lastDate = msgDate;

              const showHeader = idx === 0 || (() => {
                const prev = arr[idx - 1];
                if (!prev) return true;
                if (prev.user_address !== msg.user_address) return true;
                return (new Date(msg.created_at) - new Date(prev.created_at)) > 5 * 60 * 1000;
              })();
              const isMe = msg.user_address?.toLowerCase() === myAddress;
              const canDelete = isMe || isAdmin;
              const canEdit = isMe;
              const repliedMsg = msg.reply_to ? messages.find((m) => m.id === msg.reply_to) : null;

              return (
                <div key={msg.id}>
                  {showDateDivider && (
                    <div className="channel-date-divider">
                      <span>{msgDate}</span>
                    </div>
                  )}
                  <div className={`channel-msg${showHeader ? '' : ' channel-msg-compact'}${isMe ? ' channel-msg-mine' : ''}`}>
                    {showHeader && (
                      <div className="channel-msg-header">
                        <img
                          src={msg.profile_image || '/default-avatar.png'}
                          alt=""
                          className="channel-msg-avatar"
                          onError={(e) => { e.target.src = '/default-avatar.png'; }}
                          onClick={(e) => showUserCard(msg, e)}
                        />
                        <span className="channel-msg-username" onClick={(e) => showUserCard(msg, e)}>{msg.username || 'Unknown'}</span>
                        <span className="channel-msg-time">
                          {new Date(msg.created_at).toLocaleString('en-US', {
                            hour: 'numeric', minute: '2-digit', hour12: true,
                            month: 'short', day: 'numeric',
                          })}
                        </span>
                      </div>
                    )}
                    {repliedMsg && (
                      <div className="channel-msg-reply-ref">
                        <span className="reply-arrow">↩</span>
                        <img src={repliedMsg.profile_image || '/default-avatar.png'} alt="" className="reply-avatar" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                        <span className="reply-username">{repliedMsg.username}</span>
                        <span className="reply-preview">{repliedMsg.content?.slice(0, 80)}</span>
                      </div>
                    )}
                    <div className="channel-msg-content">
                      {editingId === msg.id ? (
                        <div className="channel-msg-edit">
                          <input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleEdit(msg.id);
                              if (e.key === 'Escape') { setEditingId(null); setEditText(''); }
                            }}
                            autoFocus
                          />
                          <div className="channel-msg-edit-actions">
                            <button onClick={() => handleEdit(msg.id)}>Save</button>
                            <button onClick={() => { setEditingId(null); setEditText(''); }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="channel-msg-text">{renderMarkdown(msg.content)}</span>
                          {msg.edited_at && <span className="channel-msg-edited">(edited)</span>}
                        </>
                      )}
                      {msg.image_url && (
                        <img
                          src={msg.image_url}
                          alt=""
                          className="channel-msg-image"
                          onClick={() => setLightboxUrl(msg.image_url)}
                        />
                      )}
                    </div>
                    {/* Reactions */}
                    {msg.reactions && msg.reactions.length > 0 && (
                      <div className="channel-msg-reactions">
                        {msg.reactions.map((r, ri) => (
                          <button key={ri} className="channel-reaction-badge" onClick={() => handleAddReaction(msg.id, r.emoji)}>
                            <span className="reaction-emoji">{r.emoji}</span>
                            <span className="reaction-count">{r.count}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    {/* Reaction picker */}
                    {reactionPickerMsgId === msg.id && (
                      <div className="channel-reaction-picker">
                        {['👍','❤️','😂','😮','😢','🔥','🎉','💯'].map((em) => (
                          <button key={em} onClick={() => handleAddReaction(msg.id, em)}>{em}</button>
                        ))}
                        <button onClick={() => setReactionPickerMsgId(null)}>✕</button>
                      </div>
                    )}
                    {/* Actions */}
                    <div className="channel-msg-actions">
                      <button title="Add Reaction" onClick={() => setReactionPickerMsgId((prev) => prev === msg.id ? null : msg.id)}>😊</button>
                      <button title="Reply" onClick={() => setReplyTo(msg)}>↩</button>
                      {canEdit && (
                        <button title="Edit" onClick={() => { setEditingId(msg.id); setEditText(msg.content); }}>✏️</button>
                      )}
                      {canDelete && (
                        <button title="Delete" onClick={() => handleDelete(msg.id)}>🗑️</button>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
          })()
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Jump to present */}
      {showJumpToPresent && (
        <button className="channel-jump-present" onClick={scrollToBottom}>
          Jump to present <span>↓</span>
        </button>
      )}

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="channel-typing">
          <span className="typing-dots"><span /></span>
          <strong>{typingUsers.join(', ')}</strong> {typingUsers.length === 1 ? 'is' : 'are'} typing...
        </div>
      )}

      {/* Reply bar */}
      {replyTo && (
        <div className="channel-reply-bar">
          <span>Replying to <strong>{replyTo.username}</strong>: {replyTo.content?.slice(0, 60)}</span>
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

      {/* GIF picker */}
      {showGifPicker && (
        <div className="channel-gif-picker-wrap">
          <GifPicker
            onSelect={handleGifSelect}
            onClose={() => setShowGifPicker(false)}
          />
        </div>
      )}

      {/* Emoji picker */}
      {showEmojiPicker && (
        <div className="channel-emoji-picker">
          <div className="channel-emoji-picker-header">
            <span>Emoji</span>
            <button onClick={() => setShowEmojiPicker(false)}>✕</button>
          </div>
          <div className="channel-emoji-grid">
            {EMOJI_LIST.map((em) => (
              <button key={em} onClick={() => handleEmojiSelect(em)}>{em}</button>
            ))}
          </div>
        </div>
      )}

      {/* @Mention autocomplete */}
      {mentionQuery !== null && mentionResults.length > 0 && (
        <div className="channel-mention-dropdown">
          {mentionResults.map((m, i) => (
            <button
              key={m.username}
              className={`channel-mention-item${i === mentionIndex ? ' active' : ''}`}
              onClick={() => insertMention(m)}
              onMouseEnter={() => setMentionIndex(i)}
            >
              <img src={m.profile_image || '/default-avatar.png'} alt="" className="channel-mention-avatar" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
              <span className="channel-mention-name">{m.username}</span>
              {m.role && <span className="channel-mention-role">{m.role}</span>}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <form className="channel-input-form" onSubmit={handleSend}>
        <button type="button" className="channel-input-icon channel-attach-btn" title="Attach file" onClick={() => fileInputRef.current?.click()}>+</button>
        <input
          ref={inputRef}
          type="text"
          className="channel-input"
          placeholder={`Message #${channel.name}`}
          value={input}
          onChange={handleInputChangeWithMentions}
          onKeyDown={(e) => {
            if (!handleMentionKeyDown(e) && e.key === 'Enter' && !e.shiftKey) {
              handleSend(e);
            }
          }}
          disabled={sending}
        />
        <div className="channel-input-right">
          <button type="button" className={`channel-input-icon${showGifPicker ? ' active' : ''}`} title="GIF" onClick={() => { setShowGifPicker((p) => !p); setShowEmojiPicker(false); }}>GIF</button>
          <button type="button" className={`channel-input-icon${showEmojiPicker ? ' active' : ''}`} title="Emoji" onClick={() => { setShowEmojiPicker((p) => !p); setShowGifPicker(false); }}>😊</button>
          {input.trim() && (
            <button type="submit" className="channel-input-icon channel-send-icon" disabled={sending}>➤</button>
          )}
        </div>
      </form>

      {/* Image lightbox */}
      {lightboxUrl && (
        <div className="channel-lightbox" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
          <button className="channel-lightbox-close" onClick={() => setLightboxUrl(null)}>✕</button>
        </div>
      )}

      {/* User profile popup card */}
      {userPopup && (
        <div
          className="channel-user-popup"
          style={{ top: Math.min(userPopup.y, window.innerHeight - 320), left: Math.min(userPopup.x, window.innerWidth - 320) }}
        >
          <div className="channel-user-popup-banner" />
          <div className="channel-user-popup-avatar-wrap">
            <img
              src={userPopup.profileImage}
              alt=""
              className="channel-user-popup-avatar"
              onError={(e) => { e.target.src = '/default-avatar.png'; }}
            />
            <span className="channel-user-popup-status-dot" />
          </div>
          <div className="channel-user-popup-body">
            <h3 className="channel-user-popup-name">{userPopup.username}</h3>
            {userPopup.role && (
              <span className="channel-user-popup-role">{userPopup.role}</span>
            )}
            <div className="channel-user-popup-divider" />
            <div className="channel-user-popup-section">
              <h4>Member Since</h4>
              <p>{new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
            </div>
            <div className="channel-user-popup-section">
              <h4>Roles</h4>
              <div className="channel-user-popup-roles">
                {userPopup.role ? (
                  <span className="channel-user-popup-role-tag">{userPopup.role}</span>
                ) : (
                  <span className="channel-user-popup-role-tag">@everyone</span>
                )}
              </div>
            </div>
            <div className="channel-user-popup-input-wrap">
              <input
                type="text"
                placeholder={`Message @${userPopup.username}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.target.value.trim()) {
                    setInput(`@${userPopup.username} ${e.target.value.trim()} `);
                    setUserPopup(null);
                    inputRef.current?.focus();
                  }
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
