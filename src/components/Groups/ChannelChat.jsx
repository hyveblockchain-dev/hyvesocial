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

const QUICK_REACTIONS = ['👍','❤️','😂','😮','😢','🔥','🎉','💯'];

function extractUrls(text) {
  if (!text) return [];
  const urlRegex = /https?:\/\/[^\s<>]+/g;
  return [...new Set(text.match(urlRegex) || [])];
}

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
  const [searchResults, setSearchResults] = useState(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);
  const [showPinnedPanel, setShowPinnedPanel] = useState(false);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [pinnedLoading, setPinnedLoading] = useState(false);
  const [mentionQuery, setMentionQuery] = useState(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showJumpToPresent, setShowJumpToPresent] = useState(false);
  const [userPopup, setUserPopup] = useState(null);
  // Thread state
  const [activeThread, setActiveThread] = useState(null);
  const [threadInput, setThreadInput] = useState('');
  const [threadSending, setThreadSending] = useState(false);
  // Poll state
  const [showPollCreator, setShowPollCreator] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollExpiry, setPollExpiry] = useState(0);
  // Bulk delete state
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  // Slowmode state
  const [slowmodeRemaining, setSlowmodeRemaining] = useState(0);
  const slowmodeTimerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const threadEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  const searchTimeoutRef = useRef(null);

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
      // Acknowledge channel read
      const msgs = data?.messages || [];
      if (msgs.length > 0) {
        api.acknowledgeChannel(channel.id, msgs[msgs.length - 1].id).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoading(false);
    }
  }, [channel?.id]);

  // Load pinned messages
  const loadPinnedMessages = useCallback(async () => {
    if (!channel?.id) return;
    setPinnedLoading(true);
    try {
      const data = await api.getPinnedMessages(channel.id);
      setPinnedMessages(data?.pins || []);
    } catch (err) {
      console.error('Failed to load pinned messages:', err);
    } finally {
      setPinnedLoading(false);
    }
  }, [channel?.id]);

  // Toggle pin on a message
  const handleTogglePin = async (messageId) => {
    try {
      const data = await api.togglePinMessage(channel.id, messageId);
      // Update the message in the list
      setMessages(prev => prev.map(m => m.id === messageId ? { ...m, is_pinned: data.pinned } : m));
      // Refresh pinned panel if open
      if (showPinnedPanel) loadPinnedMessages();
    } catch (err) {
      console.error('Failed to pin/unpin:', err);
    }
  };

  // Check slowmode status
  const checkSlowmode = useCallback(async () => {
    if (!channel?.id || !channel?.slowmode) { setSlowmodeRemaining(0); return; }
    try {
      const data = await api.getSlowmodeStatus(channel.id);
      if (data.remainingSeconds > 0) {
        setSlowmodeRemaining(data.remainingSeconds);
        clearInterval(slowmodeTimerRef.current);
        slowmodeTimerRef.current = setInterval(() => {
          setSlowmodeRemaining(prev => { if (prev <= 1) { clearInterval(slowmodeTimerRef.current); return 0; } return prev - 1; });
        }, 1000);
      }
    } catch (err) { /* ignore */ }
  }, [channel?.id, channel?.slowmode]);

  useEffect(() => {
    loadMessages();
    setInput('');
    setReplyTo(null);
    setEditingId(null);
    setActiveThread(null);
    setSearchResults(null);
    setSearchQuery('');
    setSlowmodeRemaining(0);
    checkSlowmode();
    return () => clearInterval(slowmodeTimerRef.current);
  }, [loadMessages, checkSlowmode]);

  // Socket.io real-time
  useEffect(() => {
    if (!channel?.id || !socketService.socket) return;

    socketService.socket.emit('join_channel', channel.id);

    const handleNewMessage = (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, { ...msg, reactions: msg.reactions || [], thread: msg.thread || null }];
      });
      api.acknowledgeChannel(channel.id, msg.id).catch(() => {});
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

    const handleReactionUpdate = ({ messageId, reactions }) => {
      setMessages((prev) => prev.map((m) => m.id !== messageId ? m : { ...m, reactions: reactions || [] }));
    };

    const handleThreadCreated = ({ thread, parentMessageId }) => {
      setMessages((prev) => prev.map((m) => m.id !== parentMessageId ? m : { ...m, thread }));
    };

    const handleThreadUpdate = ({ threadId, messageCount }) => {
      setMessages((prev) => prev.map((m) => m.thread?.id !== threadId ? m : { ...m, thread: { ...m.thread, message_count: messageCount } }));
    };

    socketService.socket.on('channel_message', handleNewMessage);
    socketService.socket.on('channel_message_deleted', handleDeletedMessage);
    socketService.socket.on('channel_message_edited', handleEditedMessage);
    socketService.socket.on('channel_typing', handleTyping);
    socketService.socket.on('channel_reaction_update', handleReactionUpdate);
    socketService.socket.on('channel_thread_created', handleThreadCreated);
    socketService.socket.on('channel_thread_update', handleThreadUpdate);

    return () => {
      socketService.socket.emit('leave_channel', channel.id);
      socketService.socket.off('channel_message', handleNewMessage);
      socketService.socket.off('channel_message_deleted', handleDeletedMessage);
      socketService.socket.off('channel_message_edited', handleEditedMessage);
      socketService.socket.off('channel_typing', handleTyping);
      socketService.socket.off('channel_reaction_update', handleReactionUpdate);
      socketService.socket.off('channel_thread_created', handleThreadCreated);
      socketService.socket.off('channel_thread_update', handleThreadUpdate);
    };
  }, [channel?.id]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Auto-scroll thread
  useEffect(() => {
    if (threadEndRef.current) {
      threadEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeThread?.messages]);

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
    if (slowmodeRemaining > 0 && !isAdmin) return;
    setSending(true);
    try {
      await api.sendChannelMessage(channel.id, {
        content: input.trim(),
        replyTo: replyTo?.id || null,
      });
      setInput('');
      setReplyTo(null);
      if (channel?.slowmode && !isAdmin) {
        setSlowmodeRemaining(channel.slowmode);
        clearInterval(slowmodeTimerRef.current);
        slowmodeTimerRef.current = setInterval(() => {
          setSlowmodeRemaining(prev => { if (prev <= 1) { clearInterval(slowmodeTimerRef.current); return 0; } return prev - 1; });
        }, 1000);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      if (err.message?.includes('Slowmode')) {
        const match = err.message.match(/Wait (\d+)/);
        if (match) setSlowmodeRemaining(parseInt(match[1]));
      }
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

  // File attachment — supports images and other files
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > 25 * 1024 * 1024) {
      alert('File must be under 25 MB.');
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
      const content = file.type.startsWith('image/') ? (input.trim() || '') : (input.trim() || `📎 ${file.name}`);
      await api.sendChannelMessage(channel.id, {
        content,
        imageUrl: base64,
        replyTo: replyTo?.id || null,
      });
      setInput('');
      setReplyTo(null);
    } catch (err) {
      console.error('Failed to send file:', err);
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

  // Persistent reaction toggle via API
  const handleAddReaction = async (msgId, emoji) => {
    setReactionPickerMsgId(null);
    try {
      await api.toggleReaction(channel.id, msgId, emoji);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // ── Thread functions ──
  const openThread = async (msg) => {
    try {
      const data = await api.getThread(channel.id, msg.id);
      if (data.thread) {
        setActiveThread({ thread: data.thread, messages: data.messages || [], parentMsg: msg });
        if (socketService.socket) socketService.socket.emit('join_thread', data.thread.id);
      } else {
        const createData = await api.createThread(channel.id, msg.id, `Thread: ${(msg.content || '').slice(0, 40)}`);
        setActiveThread({ thread: createData.thread, messages: [], parentMsg: msg });
        if (socketService.socket) socketService.socket.emit('join_thread', createData.thread.id);
      }
    } catch (err) {
      console.error('Failed to open thread:', err);
    }
  };

  const closeThread = () => {
    if (activeThread?.thread?.id && socketService.socket) socketService.socket.emit('leave_thread', activeThread.thread.id);
    setActiveThread(null);
    setThreadInput('');
  };

  const sendThreadMessage = async () => {
    if (!threadInput.trim() || threadSending || !activeThread?.thread?.id) return;
    setThreadSending(true);
    try {
      const data = await api.sendThreadMessage(activeThread.thread.id, threadInput.trim());
      setActiveThread(prev => ({ ...prev, messages: [...(prev.messages || []), data.message] }));
      setThreadInput('');
    } catch (err) {
      console.error('Failed to send thread message:', err);
    } finally {
      setThreadSending(false);
    }
  };

  // Listen for thread messages via socket
  useEffect(() => {
    if (!activeThread?.thread?.id || !socketService.socket) return;
    const handleThreadMsg = (msg) => {
      setActiveThread(prev => {
        if (!prev) return prev;
        if (prev.messages.some(m => m.id === msg.id)) return prev;
        return { ...prev, messages: [...prev.messages, msg] };
      });
    };
    socketService.socket.on('thread_message', handleThreadMsg);
    return () => socketService.socket.off('thread_message', handleThreadMsg);
  }, [activeThread?.thread?.id]);

  // ── Server-side search ──
  const handleSearchChange = (query) => {
    setSearchQuery(query);
    clearTimeout(searchTimeoutRef.current);
    if (!query || query.length < 2) { setSearchResults(null); return; }
    setSearchLoading(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const data = await api.searchGroupMessages(groupId, query, { channelId: channel.id, limit: 25 });
        setSearchResults(data.results || []);
      } catch (err) {
        const filtered = messages.filter(m => m.content?.toLowerCase().includes(query.toLowerCase()));
        setSearchResults(filtered);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
  };

  // ── Poll creation ──
  const handleCreatePoll = async () => {
    const validOpts = pollOptions.filter(o => o.trim());
    if (!pollQuestion.trim() || validOpts.length < 2) return;
    try {
      await api.createPoll(channel.id, pollQuestion.trim(), validOpts.map(label => ({ label })), pollMultiple, pollExpiry || null);
      setShowPollCreator(false);
      setPollQuestion('');
      setPollOptions(['', '']);
      setPollMultiple(false);
      setPollExpiry(0);
    } catch (err) {
      console.error('Failed to create poll:', err);
    }
  };

  // ── Poll voting ──
  const handleVotePoll = async (pollId, optionId) => {
    try {
      const data = await api.votePoll(pollId, optionId);
      setMessages(prev => prev.map(m => {
        if (m.poll && m.poll.id === pollId) {
          return { ...m, poll: { ...m.poll, options: data.options, totalVotes: data.totalVotes } };
        }
        return m;
      }));
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  // ── Bulk delete ──
  const handleBulkDelete = async () => {
    if (bulkSelected.size === 0) return;
    try {
      await api.bulkDeleteMessages(channel.id, Array.from(bulkSelected));
      setMessages(prev => prev.filter(m => !bulkSelected.has(m.id)));
      setBulkSelected(new Set());
      setBulkSelectMode(false);
    } catch (err) {
      console.error('Bulk delete failed:', err);
    }
  };

  const toggleBulkSelect = (msgId) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else if (next.size < 100) next.add(msgId);
      return next;
    });
  };

  // Listen for poll updates
  useEffect(() => {
    if (!socketService.socket || !channel?.id) return;
    const handlePollUpdate = (data) => {
      setMessages(prev => prev.map(m => {
        if (m.poll && m.poll.id === data.pollId) {
          return { ...m, poll: { ...m.poll, options: data.options, totalVotes: data.totalVotes } };
        }
        return m;
      }));
    };
    const handleBulkDeleted = (data) => {
      const ids = new Set(data.messageIds);
      setMessages(prev => prev.filter(m => !ids.has(m.id)));
    };
    socketService.socket.on('poll_update', handlePollUpdate);
    socketService.socket.on('messages_bulk_deleted', handleBulkDeleted);
    return () => {
      socketService.socket.off('poll_update', handlePollUpdate);
      socketService.socket.off('messages_bulk_deleted', handleBulkDeleted);
    };
  }, [channel?.id]);

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
    // Split on code blocks, inline code, and spoiler tags
    const parts = text.split(/(```[\s\S]*?```|`[^`\n]+`|\|\|[^|]+\|\|)/g);
    return parts.map((part, i) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\n/, '');
        return <pre key={i} className="msg-code-block"><code>{code}</code></pre>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="msg-inline-code">{part.slice(1, -1)}</code>;
      }
      if (part.startsWith('||') && part.endsWith('||') && part.length > 4) {
        return <span key={i} className="msg-spoiler" onClick={(e) => e.currentTarget.classList.toggle('revealed')}>{part.slice(2, -2)}</span>;
      }
      return <span key={i}>{renderInline(part)}</span>;
    });
  }

  function renderInline(text) {
    const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~|__[^_]+__|\|\|[^|]+\|\||https?:\/\/[^\s<>]+|<@([^>]+)>)/g;
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
      if (part.startsWith('||') && part.endsWith('||') && part.length > 4)
        return <span key={i} className="msg-spoiler" onClick={(e) => e.currentTarget.classList.toggle('revealed')}>{part.slice(2, -2)}</span>;
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

  // ── Link embed rendering ──
  function renderLinkEmbeds(text) {
    const urls = extractUrls(text);
    if (urls.length === 0) return null;
    return (
      <div className="channel-msg-embeds">
        {urls.slice(0, 3).map((url, i) => {
          const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
          if (ytMatch) {
            return (
              <div key={i} className="channel-embed channel-embed-youtube">
                <div className="channel-embed-provider">YouTube</div>
                <a href={url} target="_blank" rel="noopener noreferrer" className="channel-embed-title">{url}</a>
                <div className="channel-embed-video">
                  <iframe src={`https://www.youtube.com/embed/${ytMatch[1]}`} title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope" allowFullScreen style={{ width: '100%', height: 200, border: 'none', borderRadius: 4 }} />
                </div>
              </div>
            );
          }
          if (url.includes('twitter.com') || url.includes('x.com')) {
            return (
              <div key={i} className="channel-embed channel-embed-twitter">
                <div className="channel-embed-provider">Twitter / X</div>
                <a href={url} target="_blank" rel="noopener noreferrer" className="channel-embed-title">{url}</a>
              </div>
            );
          }
          if (url.includes('github.com')) {
            const ghParts = url.replace('https://github.com/', '').split('/');
            return (
              <div key={i} className="channel-embed channel-embed-github">
                <div className="channel-embed-provider">GitHub</div>
                <a href={url} target="_blank" rel="noopener noreferrer" className="channel-embed-title">{ghParts.slice(0, 2).join('/')}</a>
              </div>
            );
          }
          return (
            <div key={i} className="channel-embed">
              <a href={url} target="_blank" rel="noopener noreferrer" className="channel-embed-title">{url}</a>
            </div>
          );
        })}
      </div>
    );
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
    <div className={`channel-chat${activeThread ? ' has-thread' : ''}`}>
      <div className="channel-chat-main">
      {/* Channel header */}
      <div className="channel-chat-header">
        <span className="channel-hash">{channel.type === 'voice' ? '🔊' : channel.type === 'announcement' ? '📢' : '#'}</span>
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
            onClick={() => { setShowSearch((p) => !p); setSearchQuery(''); setSearchResults(null); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21.53 20.47l-3.66-3.66A8.45 8.45 0 0019 13a8 8 0 10-8 8 8.45 8.45 0 003.81-1.13l3.66 3.66a.75.75 0 001.06-1.06zM3.5 13a7.5 7.5 0 117.5 7.5A7.508 7.508 0 013.5 13z"/></svg>
          </button>
          <button
            className={`channel-header-btn${showPinnedPanel ? ' active' : ''}`}
            title="Pinned Messages"
            onClick={() => { const next = !showPinnedPanel; setShowPinnedPanel(next); if (next) loadPinnedMessages(); }}
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
            placeholder="Search messages in this channel..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            autoFocus
          />
          {searchLoading && <span className="channel-search-count">Searching...</span>}
          {!searchLoading && searchResults && (
            <span className="channel-search-count">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
          )}
          <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults(null); }}>✕</button>
        </div>
      )}

      {/* Search results overlay */}
      {searchResults && searchResults.length > 0 && (
        <div className="channel-search-results">
          {searchResults.map(msg => (
            <div key={msg.id} className="channel-search-result-item">
              <img src={msg.profile_image || '/default-avatar.png'} alt="" className="channel-search-avatar" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
              <div className="channel-search-result-body">
                <div className="channel-search-result-header">
                  <span className="channel-search-result-user">{msg.username || 'Unknown'}</span>
                  <span className="channel-search-result-time">{new Date(msg.created_at).toLocaleString()}</span>
                </div>
                <div className="channel-search-result-text">{msg.content}</div>
              </div>
            </div>
          ))}
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
            {pinnedLoading ? (
              <div className="channel-pinned-empty"><p>Loading...</p></div>
            ) : pinnedMessages.length === 0 ? (
              <div className="channel-pinned-empty">
                <span>📌</span>
                <p>No pinned messages in this channel yet.</p>
                <p className="channel-pinned-hint">Pin important messages so they're easy to find.</p>
              </div>
            ) : (
              pinnedMessages.map((pin) => (
                <div key={pin.id} className="channel-pinned-msg">
                  <img src={pin.profile_image || '/default-avatar.png'} alt="" className="channel-pinned-avatar" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                  <div className="channel-pinned-msg-body">
                    <div className="channel-pinned-msg-header">
                      <span className="channel-pinned-username">{pin.username || 'Unknown'}</span>
                      <span className="channel-pinned-time">{new Date(pin.created_at).toLocaleDateString()}</span>
                    </div>
                    <div className="channel-pinned-msg-text">{pin.content}</div>
                    {pin.image_url && <img src={pin.image_url} alt="" className="channel-pinned-msg-image" />}
                  </div>
                  {isAdmin && (
                    <button className="channel-pinned-unpin" title="Unpin" onClick={() => handleTogglePin(pin.id)}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.4 4L12 10.4L5.6 4L4 5.6L10.4 12L4 18.4L5.6 20L12 13.6L18.4 20L20 18.4L13.6 12L20 5.6L18.4 4Z"/></svg>
                    </button>
                  )}
                </div>
              ))
            )}
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
            const filtered = searchQuery && searchResults
              ? searchResults
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
                  <div className={`channel-msg${showHeader ? '' : ' channel-msg-compact'}${isMe ? ' channel-msg-mine' : ''}${bulkSelectMode ? ' bulk-mode' : ''}`}>
                    {bulkSelectMode && isAdmin && (
                      <label className="channel-bulk-checkbox">
                        <input type="checkbox" checked={bulkSelected.has(msg.id)} onChange={() => toggleBulkSelect(msg.id)} />
                      </label>
                    )}
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
                      {/* Link embeds */}
                      {renderLinkEmbeds(msg.content)}
                      {/* Poll embed */}
                      {msg.poll && (
                        <div className="channel-poll">
                          <div className="channel-poll-question">📊 {msg.poll.question}</div>
                          <div className="channel-poll-options">
                            {(msg.poll.options || []).map(opt => {
                              const total = msg.poll.totalVotes || msg.poll.options.reduce((s, o) => s + (o.votes || 0), 0) || 1;
                              const pct = Math.round(((opt.votes || 0) / total) * 100) || 0;
                              return (
                                <button key={opt.id} className={`channel-poll-option${opt.voted ? ' voted' : ''}`} onClick={() => handleVotePoll(msg.poll.id, opt.id)}>
                                  <div className="channel-poll-bar" style={{ width: `${pct}%` }} />
                                  <span className="channel-poll-option-label">{opt.emoji && <span>{opt.emoji} </span>}{opt.label}</span>
                                  <span className="channel-poll-option-pct">{pct}%</span>
                                  <span className="channel-poll-option-votes">{opt.votes || 0}</span>
                                </button>
                              );
                            })}
                          </div>
                          <div className="channel-poll-footer">
                            {msg.poll.totalVotes || msg.poll.options?.reduce((s, o) => s + (o.votes || 0), 0) || 0} votes
                            {msg.poll.expires_at && <span> · Expires {new Date(msg.poll.expires_at).toLocaleDateString()}</span>}
                          </div>
                        </div>
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
                        <button className="channel-reaction-add" onClick={() => setReactionPickerMsgId(p => p === msg.id ? null : msg.id)}>
                          <span>+</span>
                        </button>
                      </div>
                    )}
                    {/* Thread indicator */}
                    {msg.thread && (
                      <button className="channel-thread-indicator" onClick={() => openThread(msg)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5.43 21a.997.997 0 01-.707-.293.999.999 0 01-.293-.707V16H3a1 1 0 01-1-1V3a1 1 0 011-1h18a1 1 0 011 1v12a1 1 0 01-1 1h-8.96l-5.9 4.86A1 1 0 015.43 21z"/></svg>
                        <span>{msg.thread.message_count} {msg.thread.message_count === 1 ? 'reply' : 'replies'}</span>
                        <span className="thread-last-reply">Last reply {new Date(msg.thread.last_message_at).toLocaleDateString()}</span>
                      </button>
                    )}
                    {/* Reaction picker */}
                    {reactionPickerMsgId === msg.id && (
                      <div className="channel-reaction-picker">
                        {QUICK_REACTIONS.map((em) => (
                          <button key={em} onClick={() => handleAddReaction(msg.id, em)}>{em}</button>
                        ))}
                        <button onClick={() => setReactionPickerMsgId(null)}>✕</button>
                      </div>
                    )}
                    {/* Actions */}
                      <div className="channel-msg-actions">
                      <button title="Add Reaction" onClick={() => setReactionPickerMsgId((prev) => prev === msg.id ? null : msg.id)}>😊</button>
                      <button title="Reply" onClick={() => setReplyTo(msg)}>↩</button>
                      <button title="Create Thread" onClick={() => openThread(msg)}>🧵</button>
                      {isAdmin && (
                        <button title={msg.is_pinned ? 'Unpin Message' : 'Pin Message'} onClick={() => handleTogglePin(msg.id)} className={msg.is_pinned ? 'pinned' : ''}>📌</button>
                      )}
                      {canEdit && (
                        <button title="Edit" onClick={() => { setEditingId(msg.id); setEditText(msg.content); }}>✏️</button>
                      )}
                      {canDelete && (
                        <button title="Delete" onClick={() => handleDelete(msg.id)}>🗑️</button>
                      )}
                      {isAdmin && !bulkSelectMode && (
                        <button title="Bulk Select" onClick={() => { setBulkSelectMode(true); setBulkSelected(new Set([msg.id])); }}>☑️</button>
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

      {/* Slowmode indicator */}
      {slowmodeRemaining > 0 && !isAdmin && (
        <div className="channel-slowmode-bar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
          <span>Slowmode: {slowmodeRemaining}s remaining</span>
        </div>
      )}

      {/* Hidden file input — accept all files */}
      <input
        type="file"
        ref={fileInputRef}
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

      {/* Bulk delete bar */}
      {bulkSelectMode && (
        <div className="channel-bulk-bar">
          <span>{bulkSelected.size} message{bulkSelected.size !== 1 ? 's' : ''} selected</span>
          <button className="channel-bulk-delete-btn" onClick={handleBulkDelete} disabled={bulkSelected.size === 0}>Delete Selected</button>
          <button className="channel-bulk-cancel-btn" onClick={() => { setBulkSelectMode(false); setBulkSelected(new Set()); }}>Cancel</button>
        </div>
      )}

      {/* Poll creator */}
      {showPollCreator && (
        <div className="channel-poll-creator">
          <div className="channel-poll-creator-header">
            <h3>Create a Poll</h3>
            <button onClick={() => setShowPollCreator(false)}>✕</button>
          </div>
          <input className="channel-poll-question-input" placeholder="Ask a question..." value={pollQuestion} onChange={(e) => setPollQuestion(e.target.value)} maxLength={300} />
          <div className="channel-poll-options-list">
            {pollOptions.map((opt, i) => (
              <div key={i} className="channel-poll-option-input-row">
                <input placeholder={`Option ${i + 1}`} value={opt} onChange={(e) => { const next = [...pollOptions]; next[i] = e.target.value; setPollOptions(next); }} maxLength={100} />
                {pollOptions.length > 2 && <button className="channel-poll-remove-opt" onClick={() => setPollOptions(pollOptions.filter((_, j) => j !== i))}>✕</button>}
              </div>
            ))}
            {pollOptions.length < 10 && <button className="channel-poll-add-opt" onClick={() => setPollOptions([...pollOptions, ''])}>+ Add Option</button>}
          </div>
          <div className="channel-poll-settings">
            <label><input type="checkbox" checked={pollMultiple} onChange={(e) => setPollMultiple(e.target.checked)} /> Allow multiple answers</label>
            <select value={pollExpiry} onChange={(e) => setPollExpiry(Number(e.target.value))}>
              <option value={0}>No expiry</option>
              <option value={1}>1 hour</option>
              <option value={4}>4 hours</option>
              <option value={8}>8 hours</option>
              <option value={24}>24 hours</option>
              <option value={72}>3 days</option>
              <option value={168}>7 days</option>
            </select>
          </div>
          <button className="channel-poll-submit" onClick={handleCreatePoll} disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}>Create Poll</button>
        </div>
      )}

      {/* Input area */}
      <form className="channel-input-form" onSubmit={handleSend}>
        <button type="button" className="channel-input-icon channel-attach-btn" title="Attach file" onClick={() => fileInputRef.current?.click()}>+</button>
        <input
          ref={inputRef}
          type="text"
          className="channel-input"
          placeholder={slowmodeRemaining > 0 && !isAdmin ? `Slowmode: wait ${slowmodeRemaining}s` : `Message #${channel.name}`}
          value={input}
          onChange={handleInputChangeWithMentions}
          onKeyDown={(e) => {
            if (!handleMentionKeyDown(e) && e.key === 'Enter' && !e.shiftKey) {
              handleSend(e);
            }
          }}
          disabled={sending || (slowmodeRemaining > 0 && !isAdmin)}
        />
        <div className="channel-input-right">
          <button type="button" className={`channel-input-icon${showPollCreator ? ' active' : ''}`} title="Create Poll" onClick={() => { setShowPollCreator((p) => !p); setShowGifPicker(false); setShowEmojiPicker(false); }}>📊</button>
          <button type="button" className={`channel-input-icon${showGifPicker ? ' active' : ''}`} title="GIF" onClick={() => { setShowGifPicker((p) => !p); setShowEmojiPicker(false); setShowPollCreator(false); }}>GIF</button>
          <button type="button" className={`channel-input-icon${showEmojiPicker ? ' active' : ''}`} title="Emoji" onClick={() => { setShowEmojiPicker((p) => !p); setShowGifPicker(false); setShowPollCreator(false); }}>😊</button>
          {input.trim() && (
            <button type="submit" className="channel-input-icon channel-send-icon" disabled={sending}>➤</button>
          )}
        </div>
      </form>
      </div>{/* end channel-chat-main */}

      {/* Thread panel */}
      {activeThread && (
        <div className="channel-thread-panel">
          <div className="channel-thread-header">
            <div className="channel-thread-header-info">
              <h3>Thread</h3>
              <span className="channel-thread-name">{activeThread.thread.name || 'Thread'}</span>
            </div>
            <button className="channel-thread-close" onClick={closeThread}>✕</button>
          </div>
          <div className="channel-thread-parent">
            <img src={activeThread.parentMsg?.profile_image || '/default-avatar.png'} alt="" className="channel-msg-avatar" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
            <div>
              <div className="channel-msg-header">
                <span className="channel-msg-username">{activeThread.parentMsg?.username || 'Unknown'}</span>
                <span className="channel-msg-time">{new Date(activeThread.parentMsg?.created_at).toLocaleString()}</span>
              </div>
              <span className="channel-msg-text">{renderMarkdown(activeThread.parentMsg?.content)}</span>
              {activeThread.parentMsg?.image_url && <img src={activeThread.parentMsg.image_url} alt="" className="channel-msg-image" onClick={() => setLightboxUrl(activeThread.parentMsg.image_url)} />}
            </div>
          </div>
          <div className="channel-thread-divider">
            <span>{activeThread.messages.length} {activeThread.messages.length === 1 ? 'reply' : 'replies'}</span>
          </div>
          <div className="channel-thread-messages">
            {activeThread.messages.map((msg) => (
              <div key={msg.id} className="channel-thread-msg">
                <img src={msg.profile_image || '/default-avatar.png'} alt="" className="channel-msg-avatar" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                <div>
                  <div className="channel-msg-header">
                    <span className="channel-msg-username">{msg.username || 'Unknown'}</span>
                    <span className="channel-msg-time">{new Date(msg.created_at).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}</span>
                  </div>
                  <span className="channel-msg-text">{renderMarkdown(msg.content)}</span>
                  {msg.image_url && <img src={msg.image_url} alt="" className="channel-msg-image" onClick={() => setLightboxUrl(msg.image_url)} />}
                </div>
              </div>
            ))}
            <div ref={threadEndRef} />
          </div>
          <form className="channel-thread-input-form" onSubmit={(e) => { e.preventDefault(); sendThreadMessage(); }}>
            <input type="text" placeholder="Reply in thread..." value={threadInput} onChange={(e) => setThreadInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendThreadMessage(); } }} disabled={threadSending} />
            {threadInput.trim() && <button type="submit" disabled={threadSending}>➤</button>}
          </form>
        </div>
      )}

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
