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

export default function ChannelChat({ channel, groupId, user, isAdmin, onToggleMembers, showMembers }) {
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
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  const myUsername = (user?.username || '').toLowerCase();
  const myAddress = (user?.wallet_address || user?.walletAddress || '').toLowerCase();

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

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container && container.scrollTop < 100 && hasMore && !loading) {
      loadMore();
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

  // Typing indicator
  const handleInputChange = (e) => {
    setInput(e.target.value);
    if (socketService.socket && channel?.id && user?.username) {
      socketService.socket.emit('typing_channel', { channelId: channel.id, username: user.username });
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {}, 2000);
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
        {channel.topic && <span className="channel-chat-topic">{channel.topic}</span>}
        <div className="channel-header-actions">
          <button
            className={`channel-header-btn${showSearch ? ' active' : ''}`}
            title="Search"
            onClick={() => { setShowSearch((p) => !p); setSearchQuery(''); }}
          >🔍</button>
          <button className="channel-header-btn" title="Pinned Messages">📌</button>
          <button
            className={`channel-header-btn${showMembers ? ' active' : ''}`}
            title="Members"
            onClick={onToggleMembers}
          >👥</button>
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

      {/* Messages area */}
      <div
        className="channel-messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {loading && messages.length === 0 ? (
          <div className="channel-messages-loading">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="channel-welcome">
            <div className="channel-welcome-hash">#</div>
            <h2>Welcome to #{channel.name}!</h2>
            <p>This is the start of the #{channel.name} channel.</p>
          </div>
        ) : (
          (searchQuery
            ? messages.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase()))
            : messages
          ).map((msg, idx, arr) => {
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
              <div
                key={msg.id}
                className={`channel-msg${showHeader ? '' : ' channel-msg-compact'}${isMe ? ' channel-msg-mine' : ''}`}
              >
                {showHeader && (
                  <div className="channel-msg-header">
                    <img
                      src={msg.profile_image || '/default-avatar.png'}
                      alt=""
                      className="channel-msg-avatar"
                      onError={(e) => { e.target.src = '/default-avatar.png'; }}
                    />
                    <span className="channel-msg-username">{msg.username || 'Unknown'}</span>
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
                      <span className="channel-msg-text">{msg.content}</span>
                      {msg.edited_at && <span className="channel-msg-edited">(edited)</span>}
                    </>
                  )}
                  {msg.image_url && (
                    <img src={msg.image_url} alt="" className="channel-msg-image" />
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
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="channel-typing">
          <span className="typing-dots">●●●</span>
          {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
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

      {/* Input area */}
      <form className="channel-input-form" onSubmit={handleSend}>
        <button type="button" className="channel-input-icon channel-attach-btn" title="Attach file" onClick={() => fileInputRef.current?.click()}>+</button>
        <input
          ref={inputRef}
          type="text"
          className="channel-input"
          placeholder={`Message #${channel.name}`}
          value={input}
          onChange={handleInputChange}
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
    </div>
  );
}
