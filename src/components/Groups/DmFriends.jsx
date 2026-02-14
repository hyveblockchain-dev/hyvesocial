import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

export default function DmFriends({ onSelectUser }) {
  const { user, socket } = useAuth();

  const [activeTab, setActiveTab] = useState('online');
  const [searchQuery, setSearchQuery] = useState('');
  const [friends, setFriends] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [presenceMap, setPresenceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [addFriendInput, setAddFriendInput] = useState('');
  const [addFriendStatus, setAddFriendStatus] = useState(null); // { type: 'success'|'error', msg }
  const [contextMenu, setContextMenu] = useState(null); // { username, x, y }

  const getUserHandle = (obj) =>
    (obj?.username || obj?.user?.username || obj?.name || '').toLowerCase();

  // ── Load data ──
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [friendsData, requestsData, usersData, blockedData] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
        api.getUsers(),
        api.getBlockedUsers ? api.getBlockedUsers() : Promise.resolve({ blocked: [] }),
      ]);

      const blockedList = blockedData.blocks || blockedData.blocked || blockedData.users || blockedData || [];
      const blockedSet = new Set(
        (Array.isArray(blockedList) ? blockedList : []).map(getUserHandle).filter(Boolean)
      );
      setBlockedUsers(Array.isArray(blockedList) ? blockedList : []);

      const filteredFriends = (friendsData.friends || friendsData || []).filter(
        (f) => !blockedSet.has(getUserHandle(f))
      );
      setFriends(filteredFriends);

      const filteredRequests = (requestsData.requests || []).filter(
        (r) => !blockedSet.has(getUserHandle(r))
      );
      setFriendRequests(filteredRequests);

      const friendHandles = filteredFriends.map(getUserHandle).filter(Boolean);
      const reqHandles = filteredRequests.map(getUserHandle).filter(Boolean);
      const filtered = (usersData.users || [])
        .filter((u) => getUserHandle(u) !== user?.username?.toLowerCase?.())
        .filter((u) => !friendHandles.includes(getUserHandle(u)))
        .filter((u) => !reqHandles.includes(getUserHandle(u)))
        .filter((u) => !blockedSet.has(getUserHandle(u)))
        .slice(0, 30);
      setSuggestions(filtered);
    } catch (err) {
      console.error('DmFriends loadData error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const loadPresence = useCallback(async () => {
    if (!api.getPresence) return;
    try {
      const data = await api.getPresence();
      const list = data?.presence || [];
      const m = {};
      list.forEach((e) => {
        if (e?.username) m[e.username.toLowerCase()] = { online: !!e.online, lastSeen: e.lastSeen || null };
      });
      setPresenceMap(m);
    } catch {
      setPresenceMap({});
    }
  }, []);

  useEffect(() => {
    loadData();
    loadPresence();
  }, [loadData, loadPresence]);

  // ── Socket listeners ──
  useEffect(() => {
    if (!socket) return;
    const reload = () => loadData();
    const handlePresence = (p) => {
      if (!p?.username) return;
      setPresenceMap((prev) => ({
        ...prev,
        [p.username.toLowerCase()]: { online: p.status === 'online', lastSeen: p.lastSeen || null },
      }));
    };
    socket.on('friend_request', reload);
    socket.on('friend_request_accepted', reload);
    socket.on('presence:update', handlePresence);
    return () => {
      socket.off('friend_request', reload);
      socket.off('friend_request_accepted', reload);
      socket.off('presence:update', handlePresence);
    };
  }, [socket, loadData]);

  // ── Close context menu on outside click ──
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  // ── Actions ──
  const handleAccept = async (id) => {
    try { await api.acceptFriendRequest(id); loadData(); } catch (e) { console.error(e); }
  };
  const handleDecline = async (id) => {
    try { await api.declineFriendRequest(id); setFriendRequests((p) => p.filter((r) => r.id !== id)); } catch (e) { console.error(e); }
  };
  const handleRemoveFriend = async (username) => {
    try { await api.removeFriend(username); setFriends((p) => p.filter((f) => getUserHandle(f) !== username.toLowerCase())); } catch (e) { console.error(e); }
  };
  const handleAddFriend = async (username) => {
    try { await api.sendFriendRequest(username); setSuggestions((p) => p.filter((s) => getUserHandle(s) !== username.toLowerCase())); } catch (e) { console.error(e); }
  };
  const handleAddFriendSubmit = async () => {
    if (!addFriendInput.trim()) return;
    try {
      await api.sendFriendRequest(addFriendInput.trim());
      setAddFriendStatus({ type: 'success', msg: `Friend request sent to ${addFriendInput.trim()}!` });
      setAddFriendInput('');
    } catch {
      setAddFriendStatus({ type: 'error', msg: `Could not send request to "${addFriendInput.trim()}". Check the username.` });
    }
  };
  const handleMessage = (person) => {
    const username = person?.username || person?.name || 'User';
    const profileImage = person?.profile_image || person?.profileImage || '';
    onSelectUser?.({ username, profileImage });
  };

  // ── Computed lists ──
  const onlineFriends = friends.filter((f) => presenceMap[getUserHandle(f)]?.online);
  const getStatusText = (username) => {
    const key = username.toLowerCase();
    const p = presenceMap[key];
    if (!p) return 'Offline';
    if (p.online) return 'Online';
    return 'Offline';
  };

  const getList = () => {
    let list = [];
    if (activeTab === 'online') list = onlineFriends;
    else if (activeTab === 'all') list = friends;
    else if (activeTab === 'pending') list = friendRequests;
    else if (activeTab === 'suggestions') list = suggestions;
    else return [];

    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((p) => (p.username || p.name || '').toLowerCase().includes(q));
  };

  const filteredList = getList();

  // ── Render tab content ──
  const renderAddFriendTab = () => (
    <div className="dmf-add-friend-tab">
      <h3>ADD FRIEND</h3>
      <p>You can add friends with their username.</p>
      <div className="dmf-add-input-row">
        <input
          type="text"
          placeholder="You can add friends with their username."
          value={addFriendInput}
          onChange={(e) => { setAddFriendInput(e.target.value); setAddFriendStatus(null); }}
          onKeyDown={(e) => e.key === 'Enter' && handleAddFriendSubmit()}
        />
        <button className="dmf-add-send-btn" disabled={!addFriendInput.trim()} onClick={handleAddFriendSubmit}>
          Send Friend Request
        </button>
      </div>
      {addFriendStatus && (
        <p className={`dmf-add-status ${addFriendStatus.type}`}>{addFriendStatus.msg}</p>
      )}
    </div>
  );

  const renderRow = (person, idx) => {
    const username = person.username || person.name || 'User';
    const pKey = username.toLowerCase();
    const isOnline = presenceMap[pKey]?.online;
    const statusText = getStatusText(username);
    const profileImg = person.profile_image || person.profileImage || '';

    return (
      <div key={person.id || username} className="dmf-row">
        <div className="dmf-row-left">
          <div className="dmf-row-avatar">
            {profileImg ? (
              <img src={profileImg} alt="" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
            ) : (
              <div className="dmf-row-letter">{(username || '?')[0].toUpperCase()}</div>
            )}
            <span className={`dmf-row-status-dot ${isOnline ? 'online' : statusText === 'Idle' ? 'idle' : statusText === 'Do Not Disturb' ? 'dnd' : 'offline'}`} />
          </div>
          <div className="dmf-row-info">
            <span className="dmf-row-name">{username}</span>
            <span className="dmf-row-status-text">{statusText}</span>
          </div>
        </div>
        <div className="dmf-row-actions">
          {activeTab === 'pending' ? (
            <>
              <button className="dmf-action-btn accept" title="Accept" onClick={() => handleAccept(person.id)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
              </button>
              <button className="dmf-action-btn decline" title="Decline" onClick={() => handleDecline(person.id)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </>
          ) : activeTab === 'suggestions' ? (
            <>
              <button className="dmf-action-btn accept" title="Add Friend" onClick={() => handleAddFriend(username)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </button>
              <button className="dmf-action-btn decline" title="Dismiss" onClick={() => setSuggestions((p) => p.filter((s) => getUserHandle(s) !== username.toLowerCase()))}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </>
          ) : (
            <>
              <button className="dmf-action-btn" title="Message" onClick={() => handleMessage(person)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>
              </button>
              <button className="dmf-action-btn" title="More" onClick={(e) => { e.stopPropagation(); setContextMenu({ username, x: e.clientX, y: e.clientY }); }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  const tabLabel = activeTab === 'online' ? 'ONLINE' : activeTab === 'all' ? 'ALL FRIENDS' : activeTab === 'pending' ? 'PENDING' : 'SUGGESTIONS';
  const countLabel = filteredList.length;

  return (
    <div className="dmf-container">
      {/* ── Header bar ── */}
      <div className="dmf-header">
        <div className="dmf-header-left">
          <svg className="dmf-header-icon" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.5 13c-1.2 0-3.07.34-4.5 1-1.43-.67-3.3-1-4.5-1C5.33 13 1 14.08 1 16.25V19h22v-2.75c0-2.17-4.33-3.25-6.5-3.25zm-4 4.5h-10v-1.25c0-.54 2.56-1.75 5-1.75s5 1.21 5 1.75v1.25zm9 0H14v-1.25c0-.46-.2-.86-.52-1.22.88-.3 1.96-.53 3.02-.53 2.44 0 5 1.21 5 1.75v1.25zM7.5 12c1.93 0 3.5-1.57 3.5-3.5S9.43 5 7.5 5 4 6.57 4 8.5 5.57 12 7.5 12zm9 0c1.93 0 3.5-1.57 3.5-3.5S18.43 5 16.5 5 13 6.57 13 8.5s1.57 3.5 3.5 3.5z"/>
          </svg>
          <span className="dmf-header-title">Friends</span>
          <div className="dmf-header-divider" />
          <button className={`dmf-tab ${activeTab === 'online' ? 'active' : ''}`} onClick={() => setActiveTab('online')}>Online</button>
          <button className={`dmf-tab ${activeTab === 'all' ? 'active' : ''}`} onClick={() => setActiveTab('all')}>All</button>
          <button className={`dmf-tab ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => setActiveTab('pending')}>
            Pending
            {friendRequests.length > 0 && <span className="dmf-tab-badge">{friendRequests.length}</span>}
          </button>
          <button className={`dmf-tab ${activeTab === 'suggestions' ? 'active' : ''}`} onClick={() => setActiveTab('suggestions')}>
            Suggestions
            {suggestions.length > 0 && <span className="dmf-tab-badge">{suggestions.length}</span>}
          </button>
          <button className={`dmf-tab dmf-tab-add ${activeTab === 'add' ? 'active' : ''}`} onClick={() => setActiveTab('add')}>Add Friend</button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="dmf-body">
        <div className="dmf-content">
          {activeTab === 'add' ? (
            renderAddFriendTab()
          ) : (
            <>
              {/* Search bar */}
              <div className="dmf-search">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <svg className="dmf-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
              </div>

              {/* Section count header */}
              <div className="dmf-section-header">
                {tabLabel} — {countLabel}
              </div>

              {/* Friend list */}
              <div className="dmf-list">
                {loading ? (
                  <div className="dmf-empty">Loading...</div>
                ) : filteredList.length === 0 ? (
                  <div className="dmf-empty">
                    {activeTab === 'online' && 'No friends are online right now.'}
                    {activeTab === 'all' && 'No friends yet.'}
                    {activeTab === 'pending' && 'No pending friend requests.'}
                    {activeTab === 'suggestions' && 'No suggestions right now.'}
                  </div>
                ) : (
                  filteredList.map(renderRow)
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Active Now sidebar ── */}
        <div className="dmf-active-sidebar">
          <h3>Active Now</h3>
          {onlineFriends.length === 0 ? (
            <div className="dmf-active-empty">
              <p>It's quiet for now...</p>
              <span>When a friend starts an activity, it'll show up here.</span>
            </div>
          ) : (
            <div className="dmf-active-list">
              {onlineFriends.slice(0, 10).map((f) => {
                const username = f.username || f.name || 'User';
                const profileImg = f.profile_image || f.profileImage || '';
                return (
                  <div key={username} className="dmf-active-item">
                    <div className="dmf-active-avatar">
                      {profileImg ? (
                        <img src={profileImg} alt="" onError={(e) => { e.target.src = '/default-avatar.png'; }} />
                      ) : (
                        <div className="dmf-active-letter">{(username || '?')[0].toUpperCase()}</div>
                      )}
                      <span className="dmf-active-dot" />
                    </div>
                    <div className="dmf-active-info">
                      <span className="dmf-active-name">{username}</span>
                      <span className="dmf-active-status">Online</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Context menu ── */}
      {contextMenu && (
        <div className="dmf-context-menu" style={{ top: contextMenu.y, left: contextMenu.x }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { handleMessage({ username: contextMenu.username }); setContextMenu(null); }}>Message</button>
          <button onClick={() => { handleRemoveFriend(contextMenu.username); setContextMenu(null); }}>Remove Friend</button>
          <button onClick={() => setContextMenu(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
