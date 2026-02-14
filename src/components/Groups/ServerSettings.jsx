import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime } from '../../utils/date';
import { compressImage } from '../../utils/imageCompression';
import './ServerSettings.css';

const BANNER_GRADIENTS = [
  'linear-gradient(135deg, #f5af19, #f12711)',
  'linear-gradient(135deg, #f953c6, #b91d73)',
  'linear-gradient(135deg, #eb3349, #f45c43)',
  'linear-gradient(135deg, #ff6a00, #ee0979)',
  'linear-gradient(135deg, #f7971e, #ffd200)',
  'linear-gradient(135deg, #a855f7, #6d28d9)',
  'linear-gradient(135deg, #667eea, #764ba2)',
  'linear-gradient(135deg, #06b6d4, #3b82f6)',
  'linear-gradient(135deg, #00b09b, #96c93d)',
  'linear-gradient(135deg, #56ab2f, #a8e063)',
  'linear-gradient(135deg, #bdc3c7, #2c3e50)',
  'linear-gradient(135deg, #9ca3af, #6b7280)',
];

const NAV_SECTIONS = [
  { category: null, items: [{ key: 'profile', label: 'Server Profile' }, { key: 'serverTag', label: 'Server Tag' }] },
  { category: null, items: [
    { key: 'engagement', label: 'Engagement' },
    { key: 'boostPerks', label: 'Boost Perks' },
  ]},
  { category: 'EXPRESSION', items: [
    { key: 'emoji', label: 'Emoji' },
    { key: 'stickers', label: 'Stickers' },
    { key: 'soundboard', label: 'Soundboard' },
  ]},
  { category: 'PEOPLE', items: [
    { key: 'members', label: 'Members' },
    { key: 'roles', label: 'Roles' },
    { key: 'invites', label: 'Invites' },
    { key: 'access', label: 'Access' },
  ]},
  { category: 'APPS', items: [
    { key: 'integrations', label: 'Integrations' },
    { key: 'appDirectory', label: 'App Directory', external: true },
  ]},
  { category: 'MODERATION', items: [
    { key: 'safetySetup', label: 'Safety Setup' },
    { key: 'auditLog', label: 'Audit Log' },
    { key: 'bans', label: 'Bans' },
    { key: 'automod', label: 'AutoMod' },
  ]},
];

export default function ServerSettings({
  group,
  groupId,
  members,
  bannedMembers,
  requests,
  customRoles,
  channels,
  categories,
  postingPermission,
  setPostingPermission,
  requirePostApproval,
  setRequirePostApproval,
  adminsBypassApproval,
  setAdminsBypassApproval,
  onClose,
  onRefreshGroup,
  onRefreshMembers,
  onSavePostingPermission,
  onSaveModeration,
  onApprove,
  onDecline,
  onUnban,
  onDeleteGroup,
  isOwner,
  busy,
  setBusy,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('profile');
  const [serverName, setServerName] = useState(group?.name || '');
  const [serverDesc, setServerDesc] = useState(group?.description || '');
  const [selectedBanner, setSelectedBanner] = useState(0);
  const [notice, setNotice] = useState('');
  const coverInputRef = useRef(null);
  const avatarInputRef = useRef(null);

  const [tagName, setTagName] = useState('');
  const [selectedBadge, setSelectedBadge] = useState(0);
  const [selectedBadgeColor, setSelectedBadgeColor] = useState(0);
  const [showAllBadges, setShowAllBadges] = useState(false);

  // Engagement states
  const [sysWelcome, setSysWelcome] = useState(false);
  const [sysSticker, setSysSticker] = useState(false);
  const [sysBoost, setSysBoost] = useState(true);
  const [sysTips, setSysTips] = useState(true);
  const [activityFeed, setActivityFeed] = useState(true);
  const [defaultNotif, setDefaultNotif] = useState('all');
  const [inactiveChannel, setInactiveChannel] = useState('none');
  const [inactiveTimeout, setInactiveTimeout] = useState('5min');
  const [serverWidget, setServerWidget] = useState(false);

  // Boost Perks states
  const [showBoostBar, setShowBoostBar] = useState(false);

  // Members states
  const [showChannelMembers, setShowChannelMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  // Roles states
  const [roleSearch, setRoleSearch] = useState('');
  const [rolesNoticeOpen, setRolesNoticeOpen] = useState(true);
  const [rolePermPin, setRolePermPin] = useState(true);
  const [rolePermBypass, setRolePermBypass] = useState(true);

  // Role editor states
  const [editingRole, setEditingRole] = useState(null); // null = list view, object = editor view
  const [editRoleName, setEditRoleName] = useState('new role');
  const [editRoleColor, setEditRoleColor] = useState(0);
  const [editRoleTab, setEditRoleTab] = useState('display');
  const [editRoleHoist, setEditRoleHoist] = useState(false);
  const [editRoleMention, setEditRoleMention] = useState(false);
  const [permSearch, setPermSearch] = useState('');
  const [rolePerms, setRolePerms] = useState({
    viewChannels: false, manageChannels: false, manageRoles: false,
    createExpressions: false, manageExpressions: false, viewAuditLog: false,
    manageWebhooks: false, manageServer: false,
    createInvite: false, changeNickname: false, manageNicknames: false,
    kickMembers: false, banMembers: false, timeoutMembers: false,
    sendMessages: false, sendMessagesInThreads: false, createPublicThreads: false,
    createPrivateThreads: false, embedLinks: false, attachFiles: false,
    addReactions: false, useExternalEmoji: false, useExternalStickers: false,
    mentionEveryone: false, manageMessages: false, pinMessages: false,
    bypassSlowmode: false, manageThreads: false, readMessageHistory: false,
    sendTTS: false, sendVoiceMessages: false, createPolls: false,
    connect: false, speak: false, video: false, useSoundboard: false,
    useExternalSounds: false, useVoiceActivity: false, prioritySpeaker: false,
    muteMembers: false, deafenMembers: false, moveMembers: false,
    setVoiceStatus: false,
    useApplicationCommands: false, useActivities: false, useExternalApps: false,
    createEvents: false, manageEvents: false,
    administrator: false
  });

  const ROLE_COLORS = [
    '#99aab5', '#1abc9c', '#2ecc71', '#3498db', '#9b59b6', '#e91e63',
    '#f1c40f', '#e67e22', '#e74c3c', '#95a5a6', '#607d8b', '#11806a',
    '#1f8b4c', '#206694', '#71368a', '#ad1457', '#c27c0e', '#a84300',
    '#992d22', '#979c9f',
  ];

  // Access states
  const [accessMode, setAccessMode] = useState('invite');
  const [ageRestricted, setAgeRestricted] = useState(false);
  const [serverRulesEnabled, setServerRulesEnabled] = useState(false);
  const [accessRules, setAccessRules] = useState(['']);

  // Safety Setup states
  const [showMembersInChannel, setShowMembersInChannel] = useState(false);
  const [require2FA, setRequire2FA] = useState(false);
  const [activityAlerts, setActivityAlerts] = useState(false);
  const [safetyChannel, setSafetyChannel] = useState('');

  // Bans states
  const [banSearch, setBanSearch] = useState('');

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const groupName = group?.name || '';
  const avatarUrl = group?.avatar_url || group?.avatar || '';
  const coverUrl = group?.cover_photo || group?.cover_url || '';
  const memberCount = group?.member_count || members?.length || 0;
  const createdAt = group?.created_at;
  const privacy = group?.privacy || 'public';

  // Close on Escape
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Prevent background scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Upload handlers
  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      const compressed = await compressImage(file, { maxWidth: 512, maxHeight: 512, quality: 0.85 });
      const fd = new FormData();
      fd.append('avatar', compressed);
      await api.updateGroupAvatar(groupId, fd);
      onRefreshGroup(groupId);
      setNotice('Avatar updated!');
    } catch (err) { setNotice('Failed to upload avatar'); }
    finally { setBusy(false); }
  }

  async function handleCoverUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setBusy(true);
      const compressed = await compressImage(file, { maxWidth: 1200, maxHeight: 400, quality: 0.85 });
      const fd = new FormData();
      fd.append('cover', compressed);
      await api.updateGroupCover(groupId, fd);
      onRefreshGroup(groupId);
      setNotice('Cover updated!');
    } catch (err) { setNotice('Failed to upload cover'); }
    finally { setBusy(false); }
  }

  async function handleSaveName() {
    if (!serverName.trim() || serverName === groupName) return;
    try {
      setBusy(true);
      await api.updateGroup(groupId, { name: serverName.trim() });
      onRefreshGroup(groupId);
      setNotice('Server name updated!');
    } catch { setNotice('Failed to update name'); }
    finally { setBusy(false); }
  }

  async function handleSaveDesc() {
    try {
      setBusy(true);
      await api.updateGroup(groupId, { description: serverDesc.trim() });
      onRefreshGroup(groupId);
      setNotice('Description updated!');
    } catch { setNotice('Failed to update description'); }
    finally { setBusy(false); }
  }

  return (
    <div className="ss-overlay" onClick={onClose}>
      <div className="ss-layout" onClick={(e) => e.stopPropagation()}>
        {/* Sidebar */}
        <div className="ss-sidebar">
          <div className="ss-sidebar-scroll">
            {/* Server name heading */}
            <div className="ss-nav-server-name">{groupName.toUpperCase()}</div>

            {NAV_SECTIONS.map((sec, si) => (
              <div key={si} className="ss-nav-group">
                {sec.category && <div className="ss-nav-category">{sec.category}</div>}
                {sec.items.map((item) => (
                  <button
                    key={item.key}
                    className={`ss-nav-item${activeSection === item.key ? ' active' : ''}`}
                    onClick={() => {
                      setActiveSection(item.key);
                    }}
                  >
                    {item.label}
                    {item.external && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 'auto', opacity: 0.6 }}>
                        <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
                      </svg>
                    )}
                  </button>
                ))}
                {si === 0 && <div className="ss-nav-sep" />}
              </div>
            ))}

            <div className="ss-nav-sep" />
            <button className="ss-nav-item" onClick={() => setActiveSection('community')}>
              Enable Community
            </button>
            <button className="ss-nav-item" onClick={() => setActiveSection('template')}>
              Server Template
            </button>
            {isOwner && (
              <button className="ss-nav-item ss-nav-danger" onClick={() => setShowDeleteModal(true)}>
                Delete Server
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 'auto' }}>
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="ss-content">
          {notice && (
            <div className="ss-notice" onClick={() => setNotice('')}>{notice}</div>
          )}

          {/* ── Server Profile ── */}
          {activeSection === 'profile' && (
            <div className="ss-section">
              <div className="ss-profile-layout">
                <div className="ss-profile-main">
                  <h2>Server Profile</h2>
                  <p className="ss-subtitle">Customize how your server appears in invite links and, if enabled, in Server Discovery and Announcement Channel messages</p>

                  {/* Name */}
                  <div className="ss-field">
                    <label className="ss-label">Name</label>
                    <input
                      type="text"
                      className="ss-input"
                      value={serverName}
                      onChange={(e) => setServerName(e.target.value)}
                      onBlur={handleSaveName}
                    />
                  </div>

                  {/* Icon */}
                  <div className="ss-field">
                    <label className="ss-label">Icon</label>
                    <p className="ss-hint">We recommend an image of at least 512x512.</p>
                    <div className="ss-icon-actions">
                      <input ref={avatarInputRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
                      <button className="ss-btn-green" onClick={() => avatarInputRef.current?.click()} disabled={busy}>
                        Change Server Icon
                      </button>
                      <button className="ss-btn-link" onClick={() => {}}>Remove Icon</button>
                    </div>
                  </div>

                  {/* Banner */}
                  <div className="ss-field">
                    <label className="ss-label">Banner</label>
                    <div className="ss-banner-grid">
                      {BANNER_GRADIENTS.map((g, i) => (
                        <div
                          key={i}
                          className={`ss-banner-swatch${selectedBanner === i ? ' active' : ''}`}
                          style={{ background: g }}
                          onClick={() => setSelectedBanner(i)}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Traits */}
                  <div className="ss-field">
                    <label className="ss-label">Traits</label>
                    <p className="ss-hint">Add up to 5 traits to show off your server's interests and personality.</p>
                    <div className="ss-traits-grid">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <div key={i} className="ss-trait-input">
                          <span className="ss-trait-emoji">😀</span>
                          <input type="text" placeholder="" />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Description */}
                  <div className="ss-field">
                    <label className="ss-label">Description</label>
                    <p className="ss-hint">How did your server get started? Why should people join?</p>
                    <textarea
                      className="ss-textarea"
                      placeholder="Tell the world a bit about this server."
                      value={serverDesc}
                      onChange={(e) => setServerDesc(e.target.value)}
                      onBlur={handleSaveDesc}
                      rows={4}
                    />
                  </div>

                  {/* Games */}
                  <div className="ss-field">
                    <label className="ss-label">Games</label>
                    <p className="ss-hint">What games does your server play?</p>
                    <div className="ss-game-search">
                      <input type="text" placeholder="Search for a game..." readOnly />
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#72767d" strokeWidth="2" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>

                  {/* Private Profile */}
                  <div className="ss-field">
                    <div className="ss-toggle-row">
                      <div>
                        <span className="ss-label">Private Profile</span>
                        <p className="ss-hint">When enabled, only server members can view profile content. Non-members won't be able to see this content unless they have an invite.</p>
                      </div>
                      <button className={`notif-toggle${privacy === 'private' ? ' active' : ''}`} onClick={() => {}}>
                        <span className="notif-toggle-knob" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Preview card */}
                <div className="ss-profile-preview">
                  <div className="ss-preview-card">
                    <div className="ss-preview-banner" style={{ background: BANNER_GRADIENTS[selectedBanner] }} />
                    <div className="ss-preview-avatar">
                      {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{(groupName || '?').slice(0, 1).toUpperCase()}</span>}
                    </div>
                    <div className="ss-preview-info">
                      <h3>{serverName || groupName}</h3>
                      <div className="ss-preview-meta">
                        <span className="ss-preview-online">● 4 Online</span>
                        <span className="ss-preview-members">● {memberCount} Members</span>
                      </div>
                      {createdAt && <span className="ss-preview-est">Est. {new Date(createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Members ── */}
          {activeSection === 'members' && (() => {
            const timeAgo = (dateStr) => {
              if (!dateStr) return 'Unknown';
              const d = new Date(dateStr);
              if (isNaN(d)) return 'Unknown';
              const diff = Date.now() - d.getTime();
              const mins = Math.floor(diff / 60000);
              if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`;
              const hrs = Math.floor(mins / 60);
              if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`;
              const days = Math.floor(hrs / 24);
              if (days < 30) return `${days} day${days !== 1 ? 's' : ''} ago`;
              const months = Math.floor(days / 30);
              if (months < 12) return `${months} month${months !== 1 ? 's' : ''} ago`;
              const years = Math.floor(months / 12);
              return `${years} year${years !== 1 ? 's' : ''} ago`;
            };
            const filteredMembers = members.filter(m => {
              if (!memberSearch) return true;
              const q = memberSearch.toLowerCase();
              return (m.username || '').toLowerCase().includes(q) || (m.handle || '').toLowerCase().includes(q);
            });
            return (
            <div className="ss-section">
              <h2>Server Members</h2>

              {/* Show Members In Channel List toggle */}
              <div className="ss-toggle-row" style={{ marginBottom: 24 }}>
                <div>
                  <span className="ss-toggle-label" style={{ color: '#00a8fc', fontWeight: 600 }}>Show Members In Channel List</span>
                  <p className="ss-muted" style={{ margin: '4px 0 0', maxWidth: 600 }}>Enabling this will show the members page in the channel list, allowing you to quickly see who's recently joined your server, and find any users flagged for unusual activity.</p>
                </div>
                <label className="ss-switch">
                  <input type="checkbox" checked={showChannelMembers} onChange={() => setShowChannelMembers(!showChannelMembers)} />
                  <span className="ss-slider" />
                </label>
              </div>

              {/* Recent Members header */}
              <div className="ss-members-toolbar">
                <h3 className="ss-members-toolbar-title">Recent Members</h3>
                <div className="ss-members-toolbar-actions">
                  <div className="ss-members-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#b5bac1"><path d="M21.7 20.3l-4.5-4.5A7.5 7.5 0 1 0 3 10.5a7.5 7.5 0 0 0 12.3 5.7l4.5 4.5a1 1 0 0 0 1.4-1.4zM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0z"/></svg>
                    <input type="text" placeholder="Search by username or id" value={memberSearch} onChange={e => setMemberSearch(e.target.value)} />
                  </div>
                  <button className="ss-btn-secondary"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4 }}><path d="M3 6h18M3 12h12M3 18h6" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round"/></svg> Sort</button>
                  <button className="ss-btn-danger-sm">Prune</button>
                </div>
              </div>

              {/* Members table */}
              <div className="ss-members-table">
                <div className="ss-members-thead">
                  <div className="ss-members-th ss-mcol-check"><input type="checkbox" disabled /></div>
                  <div className="ss-members-th ss-mcol-name">NAME</div>
                  <div className="ss-members-th ss-mcol-since">MEMBER SINCE</div>
                  <div className="ss-members-th ss-mcol-joined">JOINED HYVE</div>
                  <div className="ss-members-th ss-mcol-method">JOIN METHOD</div>
                  <div className="ss-members-th ss-mcol-roles">ROLES</div>
                  <div className="ss-members-th ss-mcol-signals">SIGNALS</div>
                </div>
                {filteredMembers.map((m, i) => {
                  const uname = m.username || m.user?.username || '';
                  const handle = m.handle || uname;
                  const role = m.role || 'member';
                  const avatar = m.profile_image || m.profileImage || '/default-avatar.png';
                  const memberSince = timeAgo(m.joined_at);
                  const joinedHyve = timeAgo(m.created_at || m.user_created_at);
                  const roleColor = role === 'owner' ? '#f0b232' : role === 'admin' ? '#5865f2' : '#3ba55c';
                  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
                  return (
                    <div key={`${uname}-${i}`} className="ss-members-tr">
                      <div className="ss-members-td ss-mcol-check"><input type="checkbox" /></div>
                      <div className="ss-members-td ss-mcol-name">
                        <img src={avatar} alt="" className="ss-member-avatar" onError={e => { e.target.src = '/default-avatar.png'; }} />
                        <div className="ss-member-identity">
                          <span className="ss-member-name">{uname}</span>
                          <span className="ss-member-handle">{handle}</span>
                        </div>
                      </div>
                      <div className="ss-members-td ss-mcol-since">{memberSince}</div>
                      <div className="ss-members-td ss-mcol-joined">{joinedHyve}</div>
                      <div className="ss-members-td ss-mcol-method">
                        <span className="ss-method-icon">🔗</span>
                      </div>
                      <div className="ss-members-td ss-mcol-roles">
                        <span className="ss-role-pill" style={{ background: roleColor }}>{roleLabel}</span>
                        {role !== 'member' && <span className="ss-role-extra">+1</span>}
                      </div>
                      <div className="ss-members-td ss-mcol-signals">
                        <button className="ss-signal-btn" title="View profile"><svg width="16" height="16" viewBox="0 0 24 24" fill="#b5bac1"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z"/></svg></button>
                        <button className="ss-signal-btn" title="More"><svg width="16" height="16" viewBox="0 0 24 24" fill="#b5bac1"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="ss-members-footer">Showing <span className="ss-members-footer-link">{filteredMembers.length} members</span></p>
            </div>
          );})()}

          {/* ── Roles ── */}
          {activeSection === 'roles' && (() => {
            const filteredRoles = customRoles.filter(r => {
              if (!roleSearch) return true;
              return (r.name || '').toLowerCase().includes(roleSearch.toLowerCase());
            });

            // All roles list for the editor sidebar
            const allRolesForList = [...customRoles, { id: '__everyone', name: '@everyone', color: '#99aab5' }];
            const selectedColor = ROLE_COLORS[editRoleColor] || ROLE_COLORS[0];

            // ── Role Editor View ──
            if (editingRole) {
              return (
                <div className="ss-role-editor-layout">
                  {/* Left: Role list sidebar */}
                  <div className="ss-role-list-panel">
                    <div className="ss-role-list-header">
                      <button className="ss-role-back-btn" onClick={() => setEditingRole(null)}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
                        BACK
                      </button>
                      <button className="ss-role-add-btn" onClick={() => {
                        setEditRoleName('new role');
                        setEditRoleColor(0);
                        setEditRoleTab('display');
                        setEditRoleHoist(false);
                        setEditRoleMention(false);
                        setEditingRole({ id: '__new__' + Date.now(), name: 'new role', color: '#99aab5', isNew: true });
                      }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                      </button>
                    </div>
                    <div className="ss-role-list-items">
                      {allRolesForList.map((r) => (
                        <button
                          key={r.id}
                          className={`ss-role-list-item${editingRole?.id === r.id ? ' active' : ''}`}
                          onClick={() => {
                            setEditingRole(r);
                            setEditRoleName(r.name || 'new role');
                            setEditRoleColor(ROLE_COLORS.indexOf(r.color) !== -1 ? ROLE_COLORS.indexOf(r.color) : 0);
                            setEditRoleTab('display');
                            setEditRoleHoist(false);
                            setEditRoleMention(false);
                          }}
                        >
                          <span className="ss-role-dot" style={{ background: r.color || '#99aab5' }} />
                          <span className="ss-role-list-name">{r.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Right: Role editor panel */}
                  <div className="ss-role-editor-panel">
                    <div className="ss-role-editor-top">
                      <h3 className="ss-role-editor-title">EDIT ROLE — {editRoleName.toUpperCase()}</h3>
                      <button className="ss-signal-btn" title="More options">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="#b5bac1"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
                      </button>
                    </div>

                    {/* Editor tabs */}
                    <div className="ss-role-editor-tabs">
                      {['display', 'permissions', 'links', 'members'].map(t => (
                        <button
                          key={t}
                          className={`ss-role-editor-tab${editRoleTab === t ? ' active' : ''}`}
                          onClick={() => setEditRoleTab(t)}
                        >
                          {t === 'members' ? 'Manage Members (0)' : t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ))}
                    </div>

                    {/* Display tab content */}
                    {editRoleTab === 'display' && (
                      <div className="ss-role-editor-body">
                        {/* Role name */}
                        <div className="ss-field-group">
                          <label className="ss-field-label">Role name <span style={{ color: '#ed4245' }}>*</span></label>
                          <input className="ss-input" value={editRoleName} onChange={e => setEditRoleName(e.target.value)} />
                        </div>

                        {/* Role Style */}
                        <div className="ss-field-group" style={{ marginTop: 20 }}>
                          <label className="ss-field-label">Role Style</label>
                          <div className="ss-role-style-grid">
                            <div className="ss-role-style-card active">
                              <div className="ss-role-style-preview" style={{ background: '#2b2d31' }}>
                                <div className="ss-role-style-msg">
                                  <div className="ss-role-style-avatar" />
                                  <div>
                                    <span style={{ color: selectedColor, fontWeight: 600, fontSize: 13 }}>Wumpus</span>
                                    <span style={{ color: '#b5bac1', fontSize: 11, marginLeft: 4 }}>rocks a...</span>
                                  </div>
                                </div>
                              </div>
                              <span className="ss-role-style-label">Solid</span>
                            </div>
                            {['Gradient', 'Sequential', 'Holographic'].map((s) => (
                              <div key={s} className="ss-role-style-card locked">
                                <div className="ss-role-style-preview" style={{ background: '#2b2d31', opacity: 0.4 }}>
                                  <div className="ss-role-style-msg">
                                    <div className="ss-role-style-avatar" />
                                    <div>
                                      <span style={{ color: '#b5bac1', fontWeight: 600, fontSize: 13 }}>Wumpus</span>
                                      <span style={{ color: '#b5bac1', fontSize: 11, marginLeft: 4 }}>rocks a...</span>
                                    </div>
                                  </div>
                                </div>
                                <span className="ss-role-style-label">{s}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Boost upsell */}
                        <div className="ss-role-boost-upsell">
                          <span>Make certain roles <strong>magical</strong>.</span>
                          <span style={{ color: '#b5bac1', fontSize: 12 }}>Unlock new role styles with Boosting.</span>
                          <button className="ss-role-boost-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="#f47fff" style={{ marginRight: 4 }}><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61z"/></svg>
                            Unlock with Boosting
                          </button>
                        </div>

                        {/* Role color */}
                        <div className="ss-field-group" style={{ marginTop: 20 }}>
                          <label className="ss-field-label">Role color <span style={{ color: '#ed4245' }}>*</span></label>
                          <p className="ss-muted" style={{ marginBottom: 8, fontSize: 12 }}>Members use the color of the highest role they have on the roles list.</p>
                          <div className="ss-role-color-grid">
                            {ROLE_COLORS.map((c, i) => (
                              <button
                                key={i}
                                className={`ss-role-color-swatch${editRoleColor === i ? ' active' : ''}`}
                                style={{ background: c }}
                                onClick={() => setEditRoleColor(i)}
                              >
                                {editRoleColor === i && (
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
                                )}
                                {i === 1 && editRoleColor !== i && (
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Role icon */}
                        <div className="ss-field-group" style={{ marginTop: 20 }}>
                          <label className="ss-field-label">Role icon <span className="ss-badge-sm">🔒 LVL.2</span></label>
                          <p className="ss-muted" style={{ marginBottom: 8, fontSize: 12 }}>Upload an image under 256 KB or pick a custom emoji from this server. We recommend at least 64x64 pixels. Members will see the icon for their highest role if they have multiple roles.</p>
                          <div className="ss-role-icon-upload">
                            <div className="ss-role-icon-placeholder">
                              <svg width="24" height="24" viewBox="0 0 24 24" fill="#b5bac1"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2M8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                            </div>
                            <button className="ss-btn-secondary">Choose Image</button>
                          </div>
                        </div>

                        {/* Message preview */}
                        <div className="ss-role-preview-msgs">
                          {[0, 1, 2, 3].map(i => (
                            <div key={i} className="ss-role-preview-msg" style={{ background: i === 3 ? `${selectedColor}18` : 'transparent' }}>
                              <div className="ss-role-preview-avatar" />
                              <div className="ss-role-preview-content">
                                <span className="ss-role-preview-name" style={{ color: selectedColor }}>Wumpus</span>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="#5865f2" style={{ marginLeft: 2 }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                                <span className="ss-role-preview-time">8:17 PM</span>
                              </div>
                              <span className="ss-role-preview-text">rocks are really old</span>
                            </div>
                          ))}
                        </div>

                        {/* Toggle options */}
                        <div className="ss-role-toggle-row">
                          <div className="ss-role-toggle-info">
                            <span className="ss-role-toggle-label">Display role members separately from online members</span>
                          </div>
                          <label className="ss-switch">
                            <input type="checkbox" checked={editRoleHoist} onChange={() => setEditRoleHoist(!editRoleHoist)} />
                            <span className="ss-slider" />
                          </label>
                        </div>

                        <div className="ss-role-toggle-row">
                          <div className="ss-role-toggle-info">
                            <span className="ss-role-toggle-label">Allow anyone to @mention this role</span>
                            <p className="ss-muted" style={{ margin: '4px 0 0', fontSize: 12 }}>Note: Members with the "Mention @everyone, @here, and All Roles" permission will always be able to ping this role.</p>
                          </div>
                          <label className="ss-switch">
                            <input type="checkbox" checked={editRoleMention} onChange={() => setEditRoleMention(!editRoleMention)} />
                            <span className="ss-slider" />
                          </label>
                        </div>

                        {/* View Server As Role */}
                        <div className="ss-role-view-as">
                          <h4 className="ss-role-view-as-title">View Server As Role</h4>
                          <p className="ss-muted" style={{ fontSize: 12, marginBottom: 8 }}>This will let you test what actions this role can take and what channels it can see. Only available to Server Owners and Admins.</p>
                          <button className="ss-role-view-as-link">
                            View Server As Role
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ marginLeft: 4 }}><path d="M10 6l6 6-6 6z"/></svg>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Permissions tab */}
                    {editRoleTab === 'permissions' && (() => {
                      const PERM_SECTIONS = [
                        { heading: 'General Server Permissions', showClear: true, perms: [
                          { key: 'viewChannels', label: 'View Channels', desc: 'Allows members to view channels by default (excluding private channels).' },
                          { key: 'manageChannels', label: 'Manage Channels', desc: 'Allows members to create, edit, or delete channels.', warn: 'This permission will soon stop granting the ability to bypass slowmode.' },
                          { key: 'manageRoles', label: 'Manage Roles', desc: 'Allows members to create new roles and edit or delete roles lower than their highest role. Also allows members to change permissions of individual channels that they have access to.' },
                          { key: 'createExpressions', label: 'Create Expressions', desc: 'Allows members to add custom emoji, stickers, and sounds in this server.' },
                          { key: 'manageExpressions', label: 'Manage Expressions', desc: 'Allows members to edit or remove custom emoji, stickers, and sounds in this server.' },
                          { key: 'viewAuditLog', label: 'View Audit Log', desc: 'Allows members to view a record of who made which changes in this server.' },
                          { key: 'manageWebhooks', label: 'Manage Webhooks', desc: 'Allows members to create, edit, or delete webhooks, which can post messages from other apps or sites into this server.' },
                          { key: 'manageServer', label: 'Manage Server', desc: "Allows members to change this server's name, switch regions, view all invites, add apps to this server and create and update AutoMod rules." },
                        ]},
                        { heading: 'Membership Permissions', perms: [
                          { key: 'createInvite', label: 'Create Invite', desc: 'Allows members to invite new people to this server.' },
                          { key: 'changeNickname', label: 'Change Nickname', desc: 'Allows members to change their own nickname, a custom name for just this server.' },
                          { key: 'manageNicknames', label: 'Manage Nicknames', desc: 'Allows members to change the nicknames of other members.' },
                          { key: 'kickMembers', label: 'Kick, Approve, and Reject Members', desc: 'Kick will remove other members from this server. Kicked members will be able to rejoin if they have another invite. If the server enables Member Requirements, this permission enables the ability to approve or reject members who request to join.' },
                          { key: 'banMembers', label: 'Ban Members', desc: 'Allows members to permanently ban and delete the message history of other members from this server.' },
                          { key: 'timeoutMembers', label: 'Timeout Members', desc: 'When you put a user in timeout they will not be able to send messages in chat, reply within threads, react to messages, or speak in voice or Stage channels.' },
                        ]},
                        { heading: 'Text Channel Permissions', perms: [
                          { key: 'sendMessages', label: 'Send Messages and Create Posts', desc: 'Allows members to send messages in text channels and create posts in forum channels.' },
                          { key: 'sendMessagesInThreads', label: 'Send Messages in Threads and Posts', desc: 'Allows members to send messages in threads and in posts on forum channels.' },
                          { key: 'createPublicThreads', label: 'Create Public Threads', desc: 'Allows members to create threads that everyone in a channel can view.' },
                          { key: 'createPrivateThreads', label: 'Create Private Threads', desc: 'Allows members to create invite-only threads.' },
                          { key: 'embedLinks', label: 'Embed Links', desc: 'Allows links that members share to show embedded content in text channels.' },
                          { key: 'attachFiles', label: 'Attach Files', desc: 'Allows members to upload files or media in text channels.' },
                          { key: 'addReactions', label: 'Add Reactions', desc: 'Allows members to add new emoji reactions to a message. If this permission is disabled, members can still react using any existing reactions on a message.' },
                          { key: 'useExternalEmoji', label: 'Use External Emoji', desc: "Allows members to use emoji from other servers, if they're a Discord Nitro member." },
                          { key: 'useExternalStickers', label: 'Use External Stickers', desc: "Allows members to use stickers from other servers, if they're a Discord Nitro member." },
                          { key: 'mentionEveryone', label: 'Mention @everyone, @here, and All Roles', desc: 'Allows members to use @everyone (everyone in the server) or @here (only online members in that channel). They can also @mention all roles, even if the role\'s "Allow anyone to mention this role" permission is disabled.' },
                          { key: 'manageMessages', label: 'Manage Messages', desc: 'Allows members to delete or remove embeds from messages by other members.', warn: 'This permission will soon stop granting the ability to pin messages or bypass slowmode.' },
                          { key: 'pinMessages', label: 'Pin Messages', desc: 'Allows members to pin or unpin any message.' },
                          { key: 'bypassSlowmode', label: 'Bypass Slowmode', desc: 'Allows members to send messages without being affected by slowmode.' },
                          { key: 'manageThreads', label: 'Manage Threads and Posts', desc: 'Allows members to rename, delete, close, and turn on slow mode for threads and posts. They can also view private threads.', warn: 'This permission will soon stop granting the ability to bypass slowmode.' },
                          { key: 'readMessageHistory', label: 'Read Message History', desc: 'Allows members to read previous messages sent in channels. If this permission is disabled, members only see messages sent when they are online. This does not fully apply to threads and forum posts.' },
                          { key: 'sendTTS', label: 'Send Text-to-Speech Messages', desc: 'Allows members to send text-to-speech messages by starting a message with /tts. These messages can be heard by anyone focused on the channel.' },
                          { key: 'sendVoiceMessages', label: 'Send Voice Messages', desc: 'Allows members to send voice messages.' },
                          { key: 'createPolls', label: 'Create Polls', desc: 'Allows members to create polls.' },
                        ]},
                        { heading: 'Voice Channel Permissions', perms: [
                          { key: 'connect', label: 'Connect', desc: 'Allows members to join voice channels and hear others.' },
                          { key: 'speak', label: 'Speak', desc: 'Allows members to talk in voice channels. If this permission is disabled, members are default-muted until somebody with the "Mute Members" permission un-mutes them.' },
                          { key: 'video', label: 'Video', desc: 'Allows members to share their video, screen share, or stream a game in this server.' },
                          { key: 'useSoundboard', label: 'Use Soundboard', desc: 'Allows members to send sounds from server soundboard.', link: 'Learn more' },
                          { key: 'useExternalSounds', label: 'Use External Sounds', desc: "Allows members to use sounds from other servers, if they're a Discord Nitro member." },
                          { key: 'useVoiceActivity', label: 'Use Voice Activity', desc: 'Allows members to speak in voice channels by simply talking. If this permission is disabled, members are required to use Push-to-Talk. Good for controlling background noise or noisy members.' },
                          { key: 'prioritySpeaker', label: 'Priority Speaker', desc: 'Allows members to be more easily heard in voice channels. When activated, the volume of others without this permission will be automatically lowered. Priority Speaker is activated by using the Push to Talk (Priority) keybind.' },
                          { key: 'muteMembers', label: 'Mute Members', desc: 'Allows members to mute other members in voice channels for everyone.' },
                          { key: 'deafenMembers', label: 'Deafen Members', desc: 'Allows members to deafen other members in voice channels, which means they won\'t be able to speak or hear others.' },
                          { key: 'moveMembers', label: 'Move Members', desc: 'Allows members to disconnect or move other members between voice channels that the member with this permission has access to.' },
                          { key: 'setVoiceStatus', label: 'Set Voice Channel Status', desc: 'Allows members to create and edit voice channel status.' },
                        ]},
                        { heading: 'Apps Permissions', perms: [
                          { key: 'useApplicationCommands', label: 'Use Application Commands', desc: 'Allows members to use commands from applications, including slash commands and context menu commands.' },
                          { key: 'useActivities', label: 'Use Activities', desc: 'Allows members to use Activities.' },
                          { key: 'useExternalApps', label: 'Use External Apps', desc: 'Allows apps that members have added to their account to post messages. When disabled, the messages will be private.' },
                        ]},
                        { heading: 'Events Permissions', perms: [
                          { key: 'createEvents', label: 'Create Events', desc: 'Allows members to create events.' },
                          { key: 'manageEvents', label: 'Manage Events', desc: 'Allows members to edit and cancel events.' },
                        ]},
                        { heading: 'Advanced Permissions', perms: [
                          { key: 'administrator', label: 'Administrator', desc: 'Members with this permission will have every permission and will also bypass all channel specific permissions or restrictions (for example, these members would get access to all private channels). This is a dangerous permission to grant.' },
                        ]},
                      ];
                      const q = permSearch.toLowerCase();
                      return (
                      <div className="ss-role-editor-body">
                        <div className="ss-perm-search-wrap">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#b5bac1"><path d="M21.71 20.29l-5.4-5.4A7.92 7.92 0 0018 10a8 8 0 10-8 8 7.92 7.92 0 004.89-1.69l5.4 5.4a1 1 0 001.42-1.42zM4 10a6 6 0 116 6 6 6 0 01-6-6z"/></svg>
                          <input className="ss-perm-search" placeholder="Search permissions" value={permSearch} onChange={e => setPermSearch(e.target.value)} />
                        </div>
                        {PERM_SECTIONS.map(section => {
                          const filtered = section.perms.filter(p => !q || p.label.toLowerCase().includes(q) || p.desc.toLowerCase().includes(q));
                          if (filtered.length === 0) return null;
                          return (
                            <div className="ss-perm-section" key={section.heading}>
                              <div className="ss-perm-section-header">
                                <h3>{section.heading}</h3>
                                {section.showClear && <button className="ss-perm-clear" onClick={() => setRolePerms(prev => { const n = { ...prev }; Object.keys(n).forEach(k => n[k] = false); return n; })}>Clear permissions</button>}
                              </div>
                              {filtered.map(p => (
                                <div className="ss-perm-row" key={p.key}>
                                  <div className="ss-perm-info">
                                    <span className="ss-perm-label">{p.label}</span>
                                    <span className="ss-perm-desc">{p.desc}</span>
                                    {p.warn && (
                                      <div className="ss-perm-warn">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#f0b132"><path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm-1 5v4h2v-4h-2zm0 6v2h2v-2h-2z"/></svg>
                                        <span>{p.warn}</span>
                                      </div>
                                    )}
                                    {p.link && <a className="ss-perm-link" href="#">{p.link}</a>}
                                  </div>
                                  <label className="ss-toggle">
                                    <input type="checkbox" checked={rolePerms[p.key]} onChange={() => setRolePerms(prev => ({ ...prev, [p.key]: !prev[p.key] }))} />
                                    <span className="ss-toggle-slider" />
                                  </label>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    );})()}

                    {/* Links tab placeholder */}
                    {editRoleTab === 'links' && (
                      <div className="ss-role-editor-body">
                        <p className="ss-muted" style={{ padding: '24px 0' }}>Links editor coming soon.</p>
                      </div>
                    )}

                    {/* Members tab placeholder */}
                    {editRoleTab === 'members' && (
                      <div className="ss-role-editor-body">
                        <p className="ss-muted" style={{ padding: '24px 0' }}>No members with this role.</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // ── Roles list view (default) ──
            return (
            <div className="ss-section">
              <h2>Roles</h2>
              <p className="ss-subtitle">Use roles to group your server members and assign permissions.</p>

              {/* Permission change notice */}
              <div className="ss-roles-notice">
                <div className="ss-roles-notice-header" onClick={() => setRolesNoticeOpen(!rolesNoticeOpen)}>
                  <div className="ss-roles-notice-title">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#f0b232"><circle cx="12" cy="12" r="10"/><text x="12" y="17" textAnchor="middle" fill="#000" fontSize="14" fontWeight="700">!</text></svg>
                    <span>There are upcoming changes to messaging permissions</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#b5bac1" style={{ transform: rolesNoticeOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path d="M7 10l5 5 5-5z"/></svg>
                </div>
                {rolesNoticeOpen && (
                  <div className="ss-roles-notice-body">
                    <p>Historically, Pin Messages and Bypass Slowmode were controlled by permissions intended for moderators, such as <strong>Manage Messages</strong> and <strong>Manage Channels</strong>. However, these permissions grant access to more destructive actions, such as deleting other people's messages. As such, we are adding two new permissions to more granularly control access:</p>
                    <p><strong>Pin Messages:</strong> Pin messages in channels<br/><strong>Bypass Slowmode:</strong> Send messages without slowmode restrictions</p>
                    <div className="ss-roles-notice-transition">
                      <p><strong>Transition Timeline:</strong><br/>Until February 23, 2026: If a user has either the old required permissions or the new permission, they will be able to perform the action.<br/>After February 23, 2026: Users will <strong>need one of the granular permissions</strong> to perform these actions. The older permissions, such as <strong>Manage Messages</strong>, will no longer grant access.</p>
                    </div>
                    <p style={{ marginTop: 12 }}>Automatically update your role permissions below:</p>
                    <label className="ss-roles-checkbox"><input type="checkbox" checked={rolePermPin} onChange={() => setRolePermPin(!rolePermPin)} /><span>Grant Pin Messages to all users and roles that currently have Manage Messages</span></label>
                    <label className="ss-roles-checkbox"><input type="checkbox" checked={rolePermBypass} onChange={() => setRolePermBypass(!rolePermBypass)} /><span>Grant Bypass Slowmode to all users and roles that currently have Manage Messages or Manage Channel</span></label>
                    <button className="ss-btn-primary" style={{ marginTop: 12 }}>Apply</button>
                  </div>
                )}
              </div>

              {/* Default Permissions */}
              <div className="ss-roles-default">
                <div className="ss-roles-default-left">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#b5bac1"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z"/></svg>
                  <div>
                    <span className="ss-roles-default-title">Default Permissions</span>
                    <span className="ss-roles-default-sub">@everyone · applies to all server members</span>
                  </div>
                </div>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#b5bac1"><path d="M10 6l6 6-6 6z"/></svg>
              </div>

              {/* Search + Create */}
              <div className="ss-roles-toolbar">
                <div className="ss-members-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#b5bac1"><path d="M21.7 20.3l-4.5-4.5A7.5 7.5 0 1 0 3 10.5a7.5 7.5 0 0 0 12.3 5.7l4.5 4.5a1 1 0 0 0 1.4-1.4zM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0z"/></svg>
                  <input type="text" placeholder="Search Roles" value={roleSearch} onChange={e => setRoleSearch(e.target.value)} />
                </div>
                <button className="ss-btn-create-role" onClick={() => {
                  setEditRoleName('new role');
                  setEditRoleColor(0);
                  setEditRoleTab('display');
                  setEditRoleHoist(false);
                  setEditRoleMention(false);
                  setEditingRole({ id: '__new__' + Date.now(), name: 'new role', color: '#99aab5', isNew: true });
                }}>Create Role</button>
              </div>

              <p className="ss-muted" style={{ margin: '8px 0 16px', fontSize: 12 }}>Members use the color of the highest role they have on this list. Drag roles to reorder them. <span style={{ color: '#00a8fc', cursor: 'pointer' }}>Need help with permissions?</span></p>

              {/* Roles table */}
              <div className="ss-roles-table">
                <div className="ss-roles-table-header">
                  <span className="ss-roles-col-name">ROLES — {customRoles.length}</span>
                  <span className="ss-roles-col-members">MEMBERS</span>
                </div>
                {filteredRoles.map((r) => (
                  <div key={r.id} className="ss-roles-table-row">
                    <div className="ss-roles-col-name">
                      <span className="ss-role-dot" style={{ background: r.color || '#99aab5' }} />
                      <span className="ss-role-name">{r.name}</span>
                    </div>
                    <div className="ss-roles-col-members">
                      <span className="ss-role-count">{r.member_count || 0}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#b5bac1"><path d="M12 12c2.7 0 5-2.3 5-5s-2.3-5-5-5-5 2.3-5 5 2.3 5 5 5zm0 2c-3.3 0-10 1.7-10 5v2h20v-2c0-3.3-6.7-5-10-5z"/></svg>
                    </div>
                    <div className="ss-roles-col-actions">
                      <button className="ss-signal-btn" title="Edit" onClick={() => {
                        setEditRoleName(r.name || 'role');
                        setEditRoleColor(ROLE_COLORS.indexOf(r.color) !== -1 ? ROLE_COLORS.indexOf(r.color) : 0);
                        setEditRoleTab('display');
                        setEditRoleHoist(false);
                        setEditRoleMention(false);
                        setEditingRole(r);
                      }}><svg width="16" height="16" viewBox="0 0 24 24" fill="#b5bac1"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg></button>
                      <button className="ss-signal-btn" title="More"><svg width="16" height="16" viewBox="0 0 24 24" fill="#b5bac1"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg></button>
                    </div>
                  </div>
                ))}
                {filteredRoles.length === 0 && <div className="ss-roles-table-row"><p className="ss-muted" style={{ padding: '16px 0' }}>No roles found.</p></div>}
              </div>
            </div>
          );})()}

          {/* ── Bans ── */}
          {activeSection === 'bans' && (() => {
            const filteredBans = bannedMembers.filter(b => {
              if (!banSearch) return true;
              const q = banSearch.toLowerCase();
              const name = (b.username || b.handle || b.member_username || '').toLowerCase();
              return name.includes(q);
            });
            return (
            <div className="ss-section">
              <h2>Server Ban List</h2>
              <p className="ss-muted" style={{ maxWidth: 650 }}>Bans by default are by account and IP. A user can circumvent an IP ban by using a proxy. Ban circumvention can be made very hard by enabling phone verification in <span style={{ color: '#00a8fc', cursor: 'pointer' }}>Moderation</span>.</p>

              {/* Search bar */}
              <div className="ss-bans-search-row">
                <div className="ss-members-search" style={{ flex: 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#b5bac1"><path d="M21.7 20.3l-4.5-4.5A7.5 7.5 0 1 0 3 10.5a7.5 7.5 0 0 0 12.3 5.7l4.5 4.5a1 1 0 0 0 1.4-1.4zM5 10.5a5.5 5.5 0 1 1 11 0 5.5 5.5 0 0 1-11 0z"/></svg>
                  <input type="text" placeholder="Search Bans by User Id or Username" value={banSearch} onChange={e => setBanSearch(e.target.value)} />
                </div>
                <button className="ss-btn-primary">Search</button>
              </div>

              {/* Ban list */}
              <div className="ss-bans-list">
                {filteredBans.map((b, i) => {
                  const banName = b.username || b.handle || b.member_username || 'Banned member';
                  const avatar = b.profile_image || b.profileImage || '/default-avatar.png';
                  return (
                    <div key={`ban-${i}`} className="ss-bans-row">
                      <img src={avatar} alt="" className="ss-member-avatar" onError={e => { e.target.src = '/default-avatar.png'; }} />
                      <span className="ss-member-name">{banName}</span>
                    </div>
                  );
                })}
                {filteredBans.length === 0 && bannedMembers.length === 0 && (
                  <p className="ss-muted" style={{ padding: '24px 16px', textAlign: 'center' }}>No banned members.</p>
                )}
                {filteredBans.length === 0 && bannedMembers.length > 0 && (
                  <p className="ss-muted" style={{ padding: '24px 16px', textAlign: 'center' }}>No results found.</p>
                )}
              </div>
            </div>
          );})()}

          {/* ── Audit Log ── */}
          {activeSection === 'auditLog' && (
            <div className="ss-section">
              <div className="ss-audit-header">
                <h2>Audit Log</h2>
                <div className="ss-audit-filters">
                  <div className="ss-audit-filter">
                    <span className="ss-audit-filter-label">Filter by User</span>
                    <select className="ss-select">
                      <option>All Users</option>
                      {members.map((m, i) => (
                        <option key={i} value={m.username}>{m.username}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ss-audit-filter">
                    <span className="ss-audit-filter-label">Filter by Action</span>
                    <select className="ss-select">
                      <option>All Actions</option>
                      <option>Channel Create</option>
                      <option>Channel Update</option>
                      <option>Channel Delete</option>
                      <option>Role Create</option>
                      <option>Role Update</option>
                      <option>Role Delete</option>
                      <option>Member Kick</option>
                      <option>Member Ban</option>
                      <option>Member Unban</option>
                      <option>Message Delete</option>
                      <option>Message Pin</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="ss-audit-empty">
                <div className="ss-audit-illustration">
                  <svg width="120" height="100" viewBox="0 0 120 100" fill="none">
                    <rect x="20" y="15" width="60" height="70" rx="6" fill="#2b2d31" stroke="#3f4147" strokeWidth="2"/>
                    <rect x="40" y="25" width="60" height="70" rx="6" fill="#1e1f22" stroke="#3f4147" strokeWidth="2"/>
                    <circle cx="55" cy="45" r="4" fill="#3f4147"/>
                    <circle cx="55" cy="45" r="2" fill="#b5bac1"/>
                    <rect x="50" y="55" width="40" height="3" rx="1.5" fill="#3f4147"/>
                    <rect x="50" y="62" width="30" height="3" rx="1.5" fill="#3f4147"/>
                    <circle cx="85" cy="20" r="6" fill="#3f4147"/>
                    <text x="85" y="23" textAnchor="middle" fontSize="8" fill="#b5bac1">?</text>
                  </svg>
                </div>
                <h3 className="ss-audit-empty-title">NO LOGS YET</h3>
                <p className="ss-muted">Once moderators begin moderating, you can moderate the moderation here.</p>
              </div>
            </div>
          )}



          {/* ── Server Tag ── */}
          {activeSection === 'serverTag' && (
            <div className="ss-section">
              <div className="ss-profile-layout">
                <div className="ss-profile-main">
                  <h2>Server Tag</h2>
                  <p className="ss-subtitle">Create a tag that your server members can display next to their name! Anyone outside your server can view your Server Profile through the Server Tag, and if applications are enabled, they can apply to join.</p>

                  {/* Info banner */}
                  <div className="ss-info-banner ss-info-blue">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865f2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">i</text></svg>
                    <span>Your Server Profile is private. Users will not be able to see it from a Server Tag. <button className="ss-info-link" onClick={() => setActiveSection('profile')}>Edit Setting</button></span>
                  </div>

                  {/* Unlock button */}
                  <button className="ss-boost-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                    Unlock with Boosting
                  </button>

                  {/* Choose Name */}
                  <div className="ss-field" style={{ marginTop: 24 }}>
                    <label className="ss-label">Choose Name</label>
                    <div className="ss-tag-name-preview">
                      <div className="ss-tag-name-icon">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="#b5bac1"><path d="M5.88 21l1.54-5.22L3 12l6.18-.5L12 6l2.82 5.5L21 12l-4.42 3.78L18.12 21 12 17.77 5.88 21z"/></svg>
                      </div>
                      <input
                        type="text"
                        className="ss-tag-name-input"
                        placeholder="WUMP"
                        value={tagName}
                        onChange={(e) => setTagName(e.target.value.toUpperCase())}
                        maxLength={4}
                      />
                      <span className="ss-tag-name-hint">You can use 4 characters, numbers and symbols.</span>
                    </div>
                  </div>

                  {/* Update warning */}
                  <div className="ss-info-banner ss-info-green">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#3ba55c" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">i</text></svg>
                    <span>Updating your Server Tag will require all of your members to manually reapply the tag to their profile. We do this to prevent abuse. <button className="ss-info-link">Learn More</button></span>
                  </div>

                  {/* Choose Badge */}
                  <div className="ss-field" style={{ marginTop: 24 }}>
                    <label className="ss-label" style={{ fontSize: 14 }}>Choose Badge</label>
                    <div className="ss-badge-grid">
                      {['🍃', '⚒️', '🌸', '🔥', '☁️', '😊', '🌙', '⚡', '✨', '🤖'].slice(0, showAllBadges ? 10 : 10).map((emoji, i) => (
                        <button
                          key={i}
                          className={`ss-badge-cell${selectedBadge === i ? ' active' : ''}`}
                          onClick={() => setSelectedBadge(i)}
                        >
                          <span style={{ fontSize: 24 }}>{emoji}</span>
                        </button>
                      ))}
                    </div>
                    {!showAllBadges && (
                      <button className="ss-show-all-btn" onClick={() => setShowAllBadges(true)}>
                        Show all badges <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4 6l4 4 4-4"/></svg>
                      </button>
                    )}
                  </div>

                  {/* Choose Color */}
                  <div className="ss-field">
                    <label className="ss-label" style={{ fontSize: 14 }}>Choose Color</label>
                    <div className="ss-badge-grid">
                      {[
                        '#57f287', '#fee75c', '#ed4245', '#eb459e', '#5865f2',
                        '#3ba55c', '#faa61a', '#f47b67', '#e882c7', '#7289da',
                        '#2d7d46', '#d09215', '#a12d2f', '#ad357a', '#4752c4',
                      ].map((color, i) => (
                        <button
                          key={i}
                          className={`ss-badge-cell ss-color-cell${selectedBadgeColor === i ? ' active' : ''}`}
                          onClick={() => setSelectedBadgeColor(i)}
                        >
                          <span style={{ fontSize: 22, filter: `drop-shadow(0 0 0 ${color})`, color }}>
                            {['🍃', '⚒️', '🌸', '🔥', '☁️', '😊', '🌙', '⚡', '✨', '🤖'][selectedBadge]}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Preview chat */}
                <div className="ss-profile-preview ss-tag-preview">
                  <div className="ss-tag-chat-preview">
                    <div className="ss-tag-msg">
                      <div className="ss-tag-msg-avatar" style={{ background: '#5865f2' }}>O</div>
                      <div className="ss-tag-msg-body">
                        <span className="ss-tag-msg-name" style={{ color: '#57f287' }}>Olivia</span>
                        <span className="ss-tag-msg-text">anyone down for aram</span>
                      </div>
                    </div>
                    <div className="ss-tag-msg">
                      <div className="ss-tag-msg-avatar" style={{ background: '#faa61a' }}>K</div>
                      <div className="ss-tag-msg-body">
                        <span className="ss-tag-msg-name" style={{ color: '#faa61a' }}>Kongo</span>
                        <span className="ss-tag-msg-text">count me in</span>
                      </div>
                    </div>
                    <div className="ss-tag-msg">
                      <div className="ss-tag-msg-avatar" style={{ background: '#eb459e' }}>L</div>
                      <div className="ss-tag-msg-body">
                        <span className="ss-tag-msg-name">
                          <span style={{ color: '#eb459e' }}>Lily</span>
                          <span className="ss-tag-badge" style={{ background: '#5865f2' }}>
                            ✦ {tagName || 'WUMP'}
                          </span>
                        </span>
                        <span className="ss-tag-msg-text">check out my tag!</span>
                      </div>
                    </div>
                    <div className="ss-tag-msg">
                      <div className="ss-tag-msg-avatar" style={{ background: '#3ba55c' }}>S</div>
                      <div className="ss-tag-msg-body">
                        <span className="ss-tag-msg-name" style={{ color: '#3ba55c' }}>Sergio</span>
                        <span className="ss-tag-msg-text">woah how did you get that</span>
                      </div>
                    </div>
                    <div className="ss-tag-msg">
                      <div className="ss-tag-msg-avatar" style={{ background: '#eb459e' }}>L</div>
                      <div className="ss-tag-msg-body">
                        <span className="ss-tag-msg-name" style={{ color: '#eb459e' }}>Lily</span>
                        <span className="ss-tag-msg-text">anyone here can get it!</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Engagement ── */}
          {activeSection === 'engagement' && (
            <div className="ss-section">
              <h2>Engagement</h2>
              <p className="ss-subtitle">Manage settings that help keep your server active.</p>

              {/* System Messages */}
              <div className="ss-subsection">
                <h3 className="ss-subsection-title">System Messages</h3>
                <p className="ss-hint" style={{ marginBottom: 16 }}>Configure system event messages sent to your server.</p>

                <div className="ss-toggle-row" style={{ marginBottom: 14 }}>
                  <span className="ss-toggle-label">Send a random welcome message when someone joins this server.</span>
                  <button className={`notif-toggle${sysWelcome ? ' active' : ''}`} onClick={() => setSysWelcome(!sysWelcome)}><span className="notif-toggle-knob" /></button>
                </div>
                <div className="ss-toggle-row" style={{ marginBottom: 14 }}>
                  <span className="ss-toggle-label">Prompt members to reply to welcome messages with a sticker.</span>
                  <button className={`notif-toggle${sysSticker ? ' active' : ''}`} onClick={() => setSysSticker(!sysSticker)}><span className="notif-toggle-knob" /></button>
                </div>
                <div className="ss-toggle-row" style={{ marginBottom: 14 }}>
                  <span className="ss-toggle-label">Send a message when someone boosts this server.</span>
                  <button className={`notif-toggle${sysBoost ? ' active' : ''}`} onClick={() => setSysBoost(!sysBoost)}><span className="notif-toggle-knob" /></button>
                </div>
                <div className="ss-toggle-row" style={{ marginBottom: 14 }}>
                  <span className="ss-toggle-label"><strong>Send helpful tips</strong> for server setup.</span>
                  <button className={`notif-toggle${sysTips ? ' active' : ''}`} onClick={() => setSysTips(!sysTips)}><span className="notif-toggle-knob" /></button>
                </div>

                <div className="ss-toggle-row" style={{ marginBottom: 8 }}>
                  <div>
                    <span className="ss-toggle-label" style={{ fontWeight: 600 }}>System Messages Channel</span>
                    <p className="ss-hint" style={{ margin: '2px 0 0' }}>This is the channel we send system event messages to.</p>
                  </div>
                  <div className="ss-channel-selector">
                    <span className="ss-channel-pill">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#b5bac1"><path d="M5.88 21l1.54-5.22L3 12l6.18-.5L12 6l2.82 5.5L21 12l-4.42 3.78L18.12 21 12 17.77 5.88 21z"/></svg>
                    </span>
                    <select className="ss-select-inline" defaultValue="general">
                      {channels.map(ch => (
                        <option key={ch.id} value={ch.name}># {ch.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="ss-divider" />

              {/* Activity Feed Settings */}
              <div className="ss-subsection">
                <h3 className="ss-subsection-title">Activity Feed Settings</h3>
                <p className="ss-hint" style={{ marginBottom: 16 }}>Shows a feed of activity from games and connected apps in this server.</p>
                <div className="ss-toggle-row">
                  <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Display Activity Feed in this server</span>
                  <button className={`notif-toggle${activityFeed ? ' active' : ''}`} onClick={() => setActivityFeed(!activityFeed)}><span className="notif-toggle-knob" /></button>
                </div>
              </div>

              <div className="ss-divider" />

              {/* Default Notification Settings */}
              <div className="ss-subsection">
                <h3 className="ss-subsection-title">Default Notification Settings</h3>
                <p className="ss-hint" style={{ marginBottom: 16 }}>This will determine whether members who have not explicitly set their notification settings receive a notification for every message sent in this server or not.</p>

                <label className="ss-radio-row">
                  <input type="radio" name="defaultNotif" checked={defaultNotif === 'all'} onChange={() => setDefaultNotif('all')} />
                  <span className="ss-radio-custom" />
                  <span>All Messages</span>
                </label>
                <label className="ss-radio-row">
                  <input type="radio" name="defaultNotif" checked={defaultNotif === 'mentions'} onChange={() => setDefaultNotif('mentions')} />
                  <span className="ss-radio-custom" />
                  <span>Only @mentions</span>
                </label>
                <p className="ss-hint" style={{ marginTop: 4 }}>We highly recommend setting this to only @mentions for a Community Server.</p>
              </div>

              <div className="ss-divider" />

              {/* Inactive Channel & Timeout */}
              <div className="ss-subsection">
                <div className="ss-inline-fields">
                  <div className="ss-inline-field">
                    <label className="ss-label">Inactive Channel</label>
                    <select className="ss-select" value={inactiveChannel} onChange={(e) => setInactiveChannel(e.target.value)}>
                      <option value="none">No Inactive Channel</option>
                      {channels.map(ch => (
                        <option key={ch.id} value={ch.name}># {ch.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="ss-inline-field">
                    <label className="ss-label">Inactive Timeout</label>
                    <select className="ss-select" value={inactiveTimeout} onChange={(e) => setInactiveTimeout(e.target.value)}>
                      <option value="1min">1 minute</option>
                      <option value="5min">5 minutes</option>
                      <option value="15min">15 minutes</option>
                      <option value="30min">30 minutes</option>
                      <option value="1hr">1 hour</option>
                    </select>
                  </div>
                </div>
                <p className="ss-hint" style={{ marginTop: 8 }}>Automatically move members to this channel and mute them when they have been idle for longer than the inactive timeout. This does not affect browsers.</p>
              </div>

              <div className="ss-divider" />

              {/* Server Widget */}
              <div className="ss-subsection">
                <h3 className="ss-subsection-title">Server Widget</h3>
                <p className="ss-hint" style={{ marginBottom: 16 }}>Embed an HTML widget on your website to display your online members, voice channels, and invite link.</p>
                <div className="ss-toggle-row">
                  <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Enable Server Widget</span>
                  <button className={`notif-toggle${serverWidget ? ' active' : ''}`} onClick={() => setServerWidget(!serverWidget)}><span className="notif-toggle-knob" /></button>
                </div>
                <p className="ss-hint" style={{ marginTop: 8 }}>By enabling the widget, your server profile will be visible to others outside of this server. You can control Profile privacy in Server Settings &gt; Profile.</p>
              </div>
            </div>
          )}

          {/* ── Boost Perks ── */}
          {activeSection === 'boostPerks' && (
            <div className="ss-section">
              <div className="ss-profile-layout">
                <div className="ss-profile-main">
                  <h2>Boost Perks</h2>

                  {/* Show Boost progress bar */}
                  <div className="ss-toggle-row" style={{ marginBottom: 4 }}>
                    <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Show Boost progress bar</span>
                    <button className={`notif-toggle${showBoostBar ? ' active' : ''}`} onClick={() => setShowBoostBar(!showBoostBar)}><span className="notif-toggle-knob" /></button>
                  </div>
                  <p className="ss-hint" style={{ marginBottom: 28 }}>This progress bar will display in your channel list, attached to your server name (or server banner if you have one set).</p>

                  <div className="ss-divider" />

                  {/* Server Banner Background */}
                  <div className="ss-boost-perk-row">
                    <div className="ss-boost-perk-info">
                      <h3 className="ss-subsection-title">
                        Server Banner Background
                        <span className="ss-boost-lvl">🔒 LVL 2</span>
                      </h3>
                      <p className="ss-hint">This image will display at the top of your channels list.</p>
                      <p className="ss-hint">The recommended minimum size is 960x540 and recommended aspect ratio is 16:9. <button className="ss-info-link">Learn more</button>.</p>
                      <button className="ss-boost-btn" style={{ marginTop: 12 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                        Unlock with Boosting
                      </button>
                    </div>
                    <div className="ss-boost-perk-preview">
                      <div className="ss-boost-img-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="#72767d"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                      </div>
                    </div>
                  </div>

                  <div className="ss-divider" />

                  {/* Server Invite Background */}
                  <div className="ss-boost-perk-row">
                    <div className="ss-boost-perk-info">
                      <h3 className="ss-subsection-title">
                        Server Invite Background
                        <span className="ss-boost-lvl">🔒 LVL 1</span>
                      </h3>
                      <p className="ss-hint">This image will display when your server invite is viewed in a browser, as well as in invite confirmation screens and Server Onboarding.</p>
                      <p className="ss-hint">The recommended minimum size is 1920x1080 and recommended aspect ratio is 16:9. <button className="ss-info-link">Learn more</button></p>
                      <button className="ss-boost-btn" style={{ marginTop: 12 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                        Unlock with Boosting
                      </button>
                    </div>
                    <div className="ss-boost-perk-preview">
                      <div className="ss-boost-img-placeholder">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="#72767d"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>
                      </div>
                    </div>
                  </div>

                  <div className="ss-divider" />

                  {/* Custom Invite Link */}
                  <div className="ss-boost-perk-section">
                    <h3 className="ss-subsection-title">
                      Custom Invite Link
                      <span className="ss-boost-lvl">🔒 LVL 3</span>
                    </h3>
                    <p className="ss-hint">Bring others to your server easily with your own customized invite link. Heads up though, anyone with the link can join and you'll need at least one text channel that is open to all server members. <button className="ss-info-link">Learn more</button>.</p>
                    <button className="ss-boost-btn" style={{ marginTop: 12 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z"/></svg>
                      Unlock with Boosting
                    </button>
                  </div>
                </div>

                {/* Preview card */}
                <div className="ss-profile-preview">
                  <div className="ss-boost-preview-card">
                    <div className="ss-boost-preview-header">
                      <div className="ss-boost-preview-banner" style={{ background: 'linear-gradient(135deg, #5865f2, #eb459e)' }}>
                        <div className="ss-boost-preview-icons">
                          <span style={{ fontSize: 28 }}>🎮</span>
                        </div>
                      </div>
                      <div className="ss-boost-preview-name">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#3ba55c"><circle cx="12" cy="12" r="10"/></svg>
                        {groupName || 'Wumpus & Co'}
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="#72767d"><path d="M7 10l5 5 5-5H7z"/></svg>
                      </div>
                    </div>
                    <div className="ss-boost-preview-progress">
                      <span className="ss-boost-preview-goal">GOAL: LVL 3</span>
                      <span className="ss-boost-preview-count">10/14 Boosts &gt;</span>
                    </div>
                    <div className="ss-boost-preview-channel">
                      <span className="ss-boost-preview-cat">▾ TEXT CHANNEL</span>
                      <span className="ss-boost-preview-ch"># general</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Emoji ── */}
          {activeSection === 'emoji' && (
            <div className="ss-section">
              <h2>Emoji</h2>
              <p className="ss-subtitle">Add up to 50 custom emoji that anyone can use in this server. Animated GIF emoji may be used by members with Discord Nitro.</p>

              <button className="ss-btn-green" style={{ marginBottom: 16 }}>Upload Emoji</button>

              <p className="ss-hint" style={{ marginBottom: 24 }}>If you want to upload multiple emojis or skip the editor, drag and drop the file(s) onto this page. The emojis will be named using the file name.</p>

              {/* Static Emoji */}
              <div className="ss-emoji-section">
                <h3 className="ss-subsection-title">Emoji</h3>
                <p className="ss-hint">48 slots available</p>

                <div className="ss-emoji-table">
                  <div className="ss-emoji-table-header">
                    <span className="ss-emoji-col-img">Image</span>
                    <span className="ss-emoji-col-name">Name</span>
                    <span className="ss-emoji-col-by">Uploaded By</span>
                  </div>
                  <div className="ss-emoji-table-row">
                    <span className="ss-emoji-col-img"><span style={{ fontSize: 28 }}>😎</span></span>
                    <span className="ss-emoji-col-name">HYVE2</span>
                    <span className="ss-emoji-col-by">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#5865f2" style={{ marginRight: 4 }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z"/></svg>
                      tion45
                    </span>
                  </div>
                  <div className="ss-emoji-table-row">
                    <span className="ss-emoji-col-img"><span style={{ fontSize: 28 }}>😄</span></span>
                    <span className="ss-emoji-col-name">HYVE</span>
                    <span className="ss-emoji-col-by">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="#5865f2" style={{ marginRight: 4 }}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2a7.2 7.2 0 01-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08a7.2 7.2 0 01-6 3.22z"/></svg>
                      tion45
                    </span>
                  </div>
                </div>
              </div>

              {/* Animated Emoji */}
              <div className="ss-emoji-section" style={{ marginTop: 32 }}>
                <h3 className="ss-subsection-title">Animated Emoji</h3>
                <p className="ss-hint">50 slots available</p>
                <div className="ss-emoji-table">
                  <div className="ss-emoji-empty">NONE</div>
                </div>
              </div>
            </div>
          )}

          {/* ── Stickers ── */}
          {activeSection === 'stickers' && (
            <div className="ss-section">
              <h2>Stickers</h2>

              {/* Get Boosted banner */}
              <div className="ss-sticker-banner">
                <div className="ss-sticker-banner-bg">
                  <div className="ss-sticker-banner-content">
                    <h3>Get Boosted</h3>
                    <p>Enjoy more stickers and other perks by boosting your server to Level 1. Each Level unlocks more sticker slots and new benefits for everyone.</p>
                    <div className="ss-sticker-banner-btns">
                      <button className="ss-btn-outline">Boost Server</button>
                      <button className="ss-btn-outline">Learn More</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* No Server Boost notice */}
              <div className="ss-sticker-notice">
                <span className="ss-sticker-dot" style={{ background: '#ed4245' }} />
                <div>
                  <strong>No Server Boost</strong>
                  <p className="ss-hint" style={{ margin: 0 }}>No one has bestowed Boosts to this server yet. See if any members would kindly bless your server for server-wide Boost Perks!</p>
                </div>
              </div>

              {/* Free Slots */}
              <div className="ss-sticker-tier">
                <div className="ss-sticker-tier-header">
                  <div className="ss-sticker-tier-left">
                    <span className="ss-sticker-dot" style={{ background: '#f47fff' }} />
                    <div>
                      <strong style={{ color: '#f2f3f5' }}>Free Slots</strong>
                      <p className="ss-hint" style={{ margin: 0 }}>5 of 5 slots available</p>
                    </div>
                  </div>
                  <button className="ss-btn-green" style={{ fontSize: 12, padding: '6px 14px' }}>Upload Sticker</button>
                </div>
                <div className="ss-sticker-grid">
                  {[0,1,2,3,4].map(i => (
                    <div key={i} className="ss-sticker-slot">
                      <span style={{ fontSize: 32, opacity: 0.3 }}>🎟️</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Level tiers with timeline */}
              <div className="ss-sticker-timeline">
                {[
                  { level: 1, boosts: 2, slots: '+10 Sticker Slots', total: '' },
                  { level: 2, boosts: 7, slots: '+15 Sticker Slots', total: '(30 total)' },
                  { level: 3, boosts: 14, slots: '+30 Sticker Slots', total: '(60 total)' },
                ].map((tier) => (
                  <div key={tier.level} className="ss-sticker-level">
                    <div className="ss-sticker-timeline-dot" />
                    <div className="ss-sticker-level-card">
                      <div className="ss-sticker-level-header">
                        <div className="ss-sticker-level-title">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="#72767d"><circle cx="12" cy="12" r="10" fill="none" stroke="#72767d" strokeWidth="2"/></svg>
                          <span>Level {tier.level}</span>
                        </div>
                        <div className="ss-sticker-level-boosts">
                          {tier.boosts} Boosts
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="#72767d"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
                        </div>
                      </div>
                      <div className="ss-sticker-level-body">
                        <span style={{ fontSize: 36, opacity: 0.4 }}>🎟️</span>
                        <p className="ss-sticker-level-slots">{tier.slots} {tier.total}</p>
                        <button className="ss-btn-green" style={{ fontSize: 13, padding: '8px 20px' }}>Buy Level</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Soundboard ── */}
          {activeSection === 'soundboard' && (
            <div className="ss-section">
              <h2>Soundboard</h2>
              <p className="ss-muted">Upload custom sound reactions that anyone in this server can use. Nitro members will be able to access these sounds in any server on Hyve.</p>

              <div className="ss-soundboard-empty">
                <div className="ss-soundboard-illustration">
                  <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                    <circle cx="60" cy="60" r="50" fill="#2b2d31"/>
                    <text x="60" y="55" textAnchor="middle" fontSize="48">🎵</text>
                    <text x="60" y="80" textAnchor="middle" fontSize="14" fill="#b5bac1">♪ ♫ ♬</text>
                  </svg>
                </div>
                <h3 className="ss-soundboard-title">NO SOUNDS</h3>
                <p className="ss-muted">Get the party started by uploading a sound!</p>
                <button className="ss-btn-primary" style={{ marginTop: 16 }}>Upload Sound</button>
              </div>
            </div>
          )}

          {/* ── Invites ── */}
          {activeSection === 'invites' && (
            <div className="ss-section">
              <h2>Invites</h2>

              {/* Toolbar */}
              <div className="ss-invites-toolbar">
                <span className="ss-invites-label">ACTIVE INVITE LINKS</span>
                <div className="ss-invites-actions">
                  <button className="ss-btn-text-danger">Pause Invites</button>
                  <button className="ss-btn-create-role">Create invite link</button>
                </div>
              </div>

              {/* Invites table */}
              <div className="ss-invites-table">
                <div className="ss-invites-thead">
                  <div className="ss-invites-th ss-icol-inviter">Inviter</div>
                  <div className="ss-invites-th ss-icol-code">Invite Code</div>
                  <div className="ss-invites-th ss-icol-uses">Uses</div>
                  <div className="ss-invites-th ss-icol-expires">Expires</div>
                  <div className="ss-invites-th ss-icol-roles">Roles</div>
                </div>
                {members.filter(m => m.role === 'owner' || m.role === 'admin').length > 0 ? (
                  members.filter(m => m.role === 'owner' || m.role === 'admin').map((m, i) => {
                    const uname = m.username || m.user?.username || 'Unknown';
                    const avatar = m.profile_image || m.profileImage || '/default-avatar.png';
                    const code = Math.random().toString(36).substring(2, 10);
                    const channel = channels?.[i % (channels?.length || 1)]?.name || 'general';
                    return (
                      <div key={`invite-${i}`} className="ss-invites-tr">
                        <div className="ss-invites-td ss-icol-inviter">
                          <img src={avatar} alt="" className="ss-member-avatar" onError={e => { e.target.src = '/default-avatar.png'; }} />
                          <div className="ss-invite-user-info">
                            <span className="ss-member-name">{uname}</span>
                            <span className="ss-invite-channel">
                              <span className="ss-invite-badge" style={{ background: '#5865f2' }}>#</span>
                              <span className="ss-invite-badge" style={{ background: '#3ba55c' }}>●</span>
                              <span className="ss-invite-channel-name">· {channel}</span>
                            </span>
                          </div>
                        </div>
                        <div className="ss-invites-td ss-icol-code">{code}</div>
                        <div className="ss-invites-td ss-icol-uses">{Math.floor(Math.random() * 5)}</div>
                        <div className="ss-invites-td ss-icol-expires">{`${String(Math.floor(Math.random() * 12 + 1)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`}</div>
                        <div className="ss-invites-td ss-icol-roles" />
                      </div>
                    );
                  })
                ) : (
                  <div className="ss-invites-tr">
                    <p className="ss-muted" style={{ padding: '20px 16px' }}>No active invite links.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Access ── */}
          {activeSection === 'access' && (
            <div className="ss-section">
              <h2>Access</h2>

              {/* Join method */}
              <div style={{ marginBottom: 24 }}>
                <h3 className="ss-access-question">How can people join your server?</h3>
                <p className="ss-muted" style={{ margin: '4px 0 16px' }}>Keep your server private, or open it up for more people to join. <span style={{ color: '#00a8fc', cursor: 'pointer' }}>Learn More.</span></p>

                <div className="ss-access-cards">
                  <div className={`ss-access-card ${accessMode === 'invite' ? 'active' : ''}`} onClick={() => setAccessMode('invite')}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#b5bac1"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z"/></svg>
                    <span className="ss-access-card-title">Invite Only</span>
                    <span className="ss-access-card-desc">People can join your server directly with an invite</span>
                  </div>
                  <div className={`ss-access-card ${accessMode === 'apply' ? 'active' : ''}`} onClick={() => setAccessMode('apply')}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#b5bac1"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
                    <span className="ss-access-card-title">Apply to Join</span>
                    <span className="ss-access-card-desc">People must submit an application and be approved to join</span>
                  </div>
                  <div className={`ss-access-card ${accessMode === 'discover' ? 'active' : ''}`} onClick={() => setAccessMode('discover')}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#b5bac1"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
                    <span className="ss-access-card-title">Discoverable</span>
                    <span className="ss-access-card-desc">Anyone can join your server directly through Server Discovery</span>
                  </div>
                </div>
              </div>

              {/* Age-Restricted Server */}
              <div className="ss-toggle-row" style={{ marginBottom: 24 }}>
                <div>
                  <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Age-Restricted Server</span>
                  <p className="ss-muted" style={{ margin: '4px 0 0', maxWidth: 600 }}><span style={{ color: '#00a8fc', cursor: 'pointer' }}>Users</span> will need to confirm they are over the legal age to view the content in this server. <span style={{ color: '#00a8fc', cursor: 'pointer' }}>Learn more.</span></p>
                </div>
                <label className="ss-switch">
                  <input type="checkbox" checked={ageRestricted} onChange={() => setAgeRestricted(!ageRestricted)} />
                  <span className="ss-slider" />
                </label>
              </div>

              {/* Server Rules */}
              <div className="ss-toggle-row" style={{ marginBottom: 16 }}>
                <div>
                  <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Server Rules</span>
                  <p className="ss-muted" style={{ margin: '4px 0 0', maxWidth: 600 }}>Members must agree to rules before they can chat or interact in the server.</p>
                </div>
                <label className="ss-switch">
                  <input type="checkbox" checked={serverRulesEnabled} onChange={() => setServerRulesEnabled(!serverRulesEnabled)} />
                  <span className="ss-slider" />
                </label>
              </div>

              {/* Rules editor */}
              <div className="ss-access-rules-box">
                <span className="ss-access-rules-label">RULES</span>
                {accessRules.map((rule, i) => (
                  <input key={i} type="text" className="ss-access-rule-input" placeholder="Enter a rule" value={rule} onChange={e => { const next = [...accessRules]; next[i] = e.target.value; setAccessRules(next); }} />
                ))}
                <button className="ss-access-add-rule" onClick={() => setAccessRules([...accessRules, ''])}>+ Add a rule</button>
              </div>

              {/* Example rules */}
              <div className="ss-access-examples">
                <span className="ss-access-rules-label">EXAMPLE RULES</span>
                <div className="ss-access-example-chips">
                  <span className="ss-access-chip">Be civil and respectful</span>
                  <span className="ss-access-chip">No spam or self-promotion</span>
                  <span className="ss-access-chip">No age-restricted or obscene content</span>
                </div>
                <div className="ss-access-example-chips">
                  <span className="ss-access-chip">Help keep things safe</span>
                </div>
              </div>
            </div>
          )}

          {/* ── Integrations ── */}
          {activeSection === 'integrations' && (
            <div className="ss-section">
              <h2>Integrations</h2>
              <p className="ss-muted" style={{ maxWidth: 600 }}>Customize your server with integrations. Manage webhooks, followed channels, and apps, as well as Twitch and YouTube settings for creators. <span style={{ color: '#00a8fc', cursor: 'pointer' }}>Learn more about managing integrations.</span></p>

              {/* Webhooks row */}
              <div className="ss-integ-row">
                <div className="ss-integ-row-left">
                  <div className="ss-integ-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#b5bac1"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  </div>
                  <div>
                    <span className="ss-integ-title">Webhooks</span>
                    <span className="ss-integ-sub">0 webhooks</span>
                  </div>
                </div>
                <button className="ss-btn-create-role">Create Webhook</button>
              </div>

              {/* Channels Followed row */}
              <div className="ss-integ-row">
                <div className="ss-integ-row-left">
                  <div className="ss-integ-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="#b5bac1"><path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z"/></svg>
                  </div>
                  <div>
                    <span className="ss-integ-title">Channels Followed</span>
                    <span className="ss-integ-sub">0 channels</span>
                  </div>
                </div>
                <button className="ss-btn-secondary" style={{ fontWeight: 600 }}>Learn More</button>
              </div>

              {/* Bots and Apps */}
              <h3 className="ss-integ-section-title">Bots and Apps</h3>
              {[
                { name: 'YAGPDB.xyz', color: '#e91e63', date: 'Dec 24, 2025', icon: '🤖' },
                { name: 'Invite Tracker', color: '#3ba55c', date: 'Dec 26, 2025', icon: '➕' },
                { name: 'ProBot ✨', color: '#5865f2', date: 'Dec 26, 2025', icon: '🅿️' },
              ].map((bot, i) => (
                <div key={i} className="ss-integ-bot-row">
                  <div className="ss-integ-bot-left">
                    <div className="ss-integ-bot-avatar" style={{ background: bot.color }}>{bot.icon}</div>
                    <div className="ss-integ-bot-info">
                      <span className="ss-integ-bot-name">{bot.name}</span>
                      <span className="ss-integ-bot-meta">
                        <span className="ss-integ-bot-online">●</span> Added on {bot.date} by {members.find(m => m.role === 'owner')?.username || 'owner'}
                      </span>
                      <div className="ss-integ-bot-tags">
                        <span className="ss-integ-bot-tag">✓ Verified Bot</span>
                        <span className="ss-integ-bot-tag">⌘ Commands</span>
                      </div>
                    </div>
                  </div>
                  <div className="ss-integ-bot-actions">
                    <span className="ss-integ-manage">Manage</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#b5bac1"><path d="M10 6l6 6-6 6z"/></svg>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Safety Setup ── */}
          {activeSection === 'safetySetup' && (
            <div className="ss-section">
              <h2>Safety Setup</h2>

              {/* Show Members In Channel List */}
              <div className="ss-toggle-row" style={{ marginBottom: 8 }}>
                <div>
                  <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Show Members In Channel List <span className="ss-beta-badge">BETA</span></span>
                  <p className="ss-muted" style={{ margin: '4px 0 0', maxWidth: 600 }}>Enabling this will show the members page in the channel list, allowing you to quickly see who's recently joined your server, and find any users flagged for unusual activity.</p>
                </div>
                <label className="ss-switch">
                  <input type="checkbox" checked={showMembersInChannel} onChange={() => setShowMembersInChannel(!showMembersInChannel)} />
                  <span className="ss-slider" />
                </label>
              </div>

              {/* Community info banner */}
              <div className="ss-safety-info">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865f2" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><text x="12" y="17" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700">i</text></svg>
                <span>Becoming a community will automatically enable this experience for you.</span>
              </div>

              {/* Verification Level */}
              <div className="ss-safety-block">
                <h3 className="ss-safety-title">Verification Level</h3>
                <p className="ss-muted" style={{ margin: '4px 0 12px', maxWidth: 700 }}>Members of the server must meet the following criteria before they can send messages in text channels or initiate a direct message conversation. If a member has an assigned role and server onboarding is not enabled, this does not apply. <strong style={{ color: '#f2f3f5' }}>We recommend setting a verification level for a Community Server.</strong></p>
                <div className="ss-safety-option-box">
                  <div>
                    <span className="ss-safety-option-title">Low</span>
                    <span className="ss-safety-option-desc">Must have a verified email on their Hyve account.</span>
                  </div>
                  <button className="ss-btn-text-muted">Change</button>
                </div>
              </div>

              {/* Require 2FA */}
              <div className="ss-toggle-row" style={{ marginBottom: 24 }}>
                <div>
                  <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Require 2FA for moderator actions</span>
                  <p className="ss-muted" style={{ margin: '4px 0 0', maxWidth: 600 }}>Moderators must have two-factor authentication enabled to ban, kick, or timeout members and delete messages. Only the server owner can change this setting if they have 2FA enabled.</p>
                </div>
                <label className="ss-switch">
                  <input type="checkbox" checked={require2FA} onChange={() => setRequire2FA(!require2FA)} />
                  <span className="ss-slider" />
                </label>
              </div>

              {/* Sensitive content filters */}
              <div className="ss-safety-block">
                <h3 className="ss-safety-title">Sensitive content filters</h3>
                <p className="ss-muted" style={{ margin: '4px 0 12px', maxWidth: 700 }}>Choose if server members can share image-based media detected by Hyve's sensitive content filters. This setting will apply to channels that are not age-restricted. <span style={{ color: '#00a8fc', cursor: 'pointer' }}>Learn more.</span></p>
                <div className="ss-safety-option-box">
                  <div>
                    <span className="ss-safety-option-title">Filter messages from all members</span>
                    <span className="ss-safety-option-desc">All messages will be filtered for sensitive image-based media.</span>
                  </div>
                  <button className="ss-btn-text-muted">Change</button>
                </div>
              </div>

              {/* Activity Alerts */}
              <div className="ss-toggle-row" style={{ marginBottom: 16 }}>
                <div>
                  <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Activity Alerts</span>
                  <p className="ss-muted" style={{ margin: '4px 0 0', maxWidth: 600 }}>Receive notifications for DM or join activity that exceeds usual numbers for your server. Each notification will contain information about the activity, including time period and approximate number of joins or DMs.</p>
                </div>
                <label className="ss-switch">
                  <input type="checkbox" checked={activityAlerts} onChange={() => setActivityAlerts(!activityAlerts)} />
                  <span className="ss-slider" />
                </label>
              </div>

              {/* Safety Notifications Channel */}
              <div className="ss-safety-block" style={{ borderTop: '1px solid #3f4147', paddingTop: 20 }}>
                <span className="ss-toggle-label" style={{ fontWeight: 600 }}>Safety Notifications Channel</span>
                <select className="ss-select" style={{ marginTop: 8 }} value={safetyChannel} onChange={e => setSafetyChannel(e.target.value)}>
                  <option value="">Select...</option>
                  {(channels || []).map(ch => (
                    <option key={ch.id} value={ch.id}>{ch.name}</option>
                  ))}
                </select>
                <p className="ss-muted" style={{ margin: '6px 0 0' }}>Anyone with access to this text channel will be able to see the notifications.</p>
              </div>
            </div>
          )}

          {/* AutoMod */}
          {activeSection === 'automod' && (
            <div className="ss-section">
              <h2>AutoMod</h2>
              <p className="ss-muted" style={{ marginBottom: 4 }}>Give your mods a break while keeping your server safe! Set up filters to moderate content and automate a custom response when they're found, and AutoMod will make it happen.</p>
              <a href="#" className="ss-link" style={{ fontSize: 13, marginBottom: 24, display: 'inline-block' }}>Learn More</a>

              <h3 className="ss-automod-heading">Content</h3>

              {/* Block Mention Spam */}
              <div className="ss-automod-card">
                <div className="ss-automod-icon" style={{ background: '#5865f2' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M3.02 13.13l1.59-1.59 2.12 2.12 4.24-4.24 1.59 1.59-5.83 5.83zM20 2H4c-1.1 0-2 .9-2 2v16l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2m0 12H5.17L4 15.17V4h16z" fill="#fff"/></svg>
                </div>
                <div className="ss-automod-info">
                  <span className="ss-automod-title">Block Mention Spam</span>
                  <span className="ss-automod-desc">Block messages with an excessive # of role and user mentions</span>
                  <div className="ss-automod-tags">
                    <span className="ss-automod-tag green">● block message</span>
                    <span className="ss-automod-tag yellow">▲ send alert</span>
                    <span className="ss-automod-tag red">⏱ timeout member</span>
                  </div>
                </div>
                <button className="ss-btn-setup">Set Up</button>
              </div>

              {/* Block Suspected Spam Content */}
              <div className="ss-automod-card">
                <div className="ss-automod-icon" style={{ background: '#80848e' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><circle cx="12" cy="12" r="10" fill="none" stroke="#fff" strokeWidth="2"/><line x1="4" y1="4" x2="20" y2="20" stroke="#fff" strokeWidth="2"/></svg>
                </div>
                <div className="ss-automod-info">
                  <span className="ss-automod-title">Block Suspected Spam Content</span>
                  <span className="ss-automod-desc">Monitor messages, Forum posts, and threads for potentially spammy content or activity. (Support for English only)</span>
                  <div className="ss-automod-tags">
                    <span className="ss-automod-tag green">● block message</span>
                    <span className="ss-automod-tag yellow">▲ send alert</span>
                  </div>
                </div>
                <button className="ss-btn-setup">Set Up</button>
              </div>

              {/* Block Commonly Flagged Words */}
              <div className="ss-automod-card">
                <div className="ss-automod-icon" style={{ background: '#80848e' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><rect x="4" y="6" width="16" height="2" rx="1"/><rect x="4" y="11" width="16" height="2" rx="1"/><rect x="4" y="16" width="12" height="2" rx="1"/></svg>
                </div>
                <div className="ss-automod-info">
                  <span className="ss-automod-title">Block Commonly Flagged Words</span>
                  <span className="ss-automod-desc">Flag messages that contain profanity and more. (Support for English only)</span>
                  <div className="ss-automod-tags">
                    <span className="ss-automod-tag green">● block message</span>
                    <span className="ss-automod-tag yellow">▲ send alert</span>
                  </div>
                </div>
                <button className="ss-btn-setup">Set Up</button>
              </div>

              {/* Block Custom Words */}
              <div className="ss-automod-card">
                <div className="ss-automod-icon" style={{ background: '#80848e' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><rect x="4" y="6" width="16" height="2" rx="1"/><rect x="4" y="11" width="16" height="2" rx="1"/><rect x="4" y="16" width="12" height="2" rx="1"/></svg>
                </div>
                <div className="ss-automod-info">
                  <span className="ss-automod-title">Block Custom Words</span>
                  <span className="ss-automod-desc">Create your own filter to block specific language from your server.</span>
                  <div className="ss-automod-tags">
                    <span className="ss-automod-tag green">● block message</span>
                    <span className="ss-automod-tag yellow">▲ send alert</span>
                    <span className="ss-automod-tag red">⏱ timeout member</span>
                  </div>
                </div>
                <button className="ss-btn-setup">Create</button>
              </div>

              {/* Sensitive content filters */}
              <h3 className="ss-automod-heading" style={{ marginTop: 32 }}>Sensitive content filters</h3>
              <p className="ss-muted" style={{ marginBottom: 12 }}>Choose if server members can share image-based media detected by Hyve's sensitive content filters. This setting will apply to channels that are not age-restricted. <a href="#" className="ss-link">Learn more</a></p>

              <div className="ss-automod-filter-card">
                <div className="ss-automod-filter-info">
                  <span className="ss-automod-filter-label">Filter messages from all members</span>
                  <span className="ss-automod-filter-desc">All messages will be filtered for sensitive image-based media.</span>
                </div>
                <a href="#" className="ss-link">Change</a>
              </div>
            </div>
          )}

          {/* Enable Community */}
          {activeSection === 'community' && (
            <div className="ss-section">
              <div className="ss-community-hero">
                <div className="ss-community-illustration">
                  {/* Floating server badges */}
                  <div className="ss-community-badge" style={{ top: '10%', left: '5%' }}>
                    <span style={{ fontSize: 20 }}>✦</span>
                  </div>
                  <div className="ss-community-badge" style={{ top: '5%', left: '25%' }}>
                    <span className="ss-community-badge-icon" style={{ background: '#43b581' }}>🎮</span>
                    <span className="ss-community-badge-name">Pokémon GO Paris</span>
                  </div>
                  <div className="ss-community-badge" style={{ top: '8%', right: '20%' }}>
                    <span className="ss-community-badge-icon" style={{ background: '#3776ab' }}>🐍</span>
                    <span className="ss-community-badge-name">Python</span>
                  </div>
                  <div className="ss-community-badge" style={{ top: '40%', left: '8%' }}>
                    <span className="ss-community-badge-icon" style={{ background: '#5865f2' }}>📖</span>
                    <span className="ss-community-badge-name">Learn Latin</span>
                  </div>
                  <div className="ss-community-badge" style={{ top: '40%', right: '5%' }}>
                    <span className="ss-community-badge-icon" style={{ background: '#fee75c', color: '#000' }}>⚡</span>
                    <span className="ss-community-badge-name">r/leagueoflegends</span>
                  </div>
                  <div className="ss-community-badge" style={{ top: '60%', left: '18%' }}>
                    <span className="ss-community-badge-icon" style={{ background: '#ed4245' }}>👟</span>
                    <span className="ss-community-badge-name">Sneaker Fans</span>
                  </div>
                  <div className="ss-community-badge" style={{ top: '60%', right: '12%' }}>
                    <span className="ss-community-badge-icon" style={{ background: '#57f287' }}>🏰</span>
                    <span className="ss-community-badge-name">Hogwarts School</span>
                  </div>
                  {/* Center house illustration */}
                  <div className="ss-community-house">
                    <span style={{ fontSize: 80 }}>🏠</span>
                  </div>
                  <div className="ss-community-sparkle" style={{ bottom: '15%', left: '5%' }}>
                    <span style={{ fontSize: 14, color: '#5865f2' }}>✦✦</span>
                  </div>
                  <div className="ss-community-sparkle" style={{ bottom: '25%', right: '30%' }}>
                    <span style={{ fontSize: 16, color: '#fee75c' }}>✦</span>
                  </div>
                </div>
              </div>

              <div className="ss-community-cta">
                <h2 className="ss-community-title">Are you building a Community?</h2>
                <p className="ss-community-desc">Convert to a Community Server to access additional administrative tools that help you moderate and grow your server. <a href="#" className="ss-link">Learn more.</a></p>
                <button className="ss-btn-primary ss-community-enable-btn">Enable Community</button>
              </div>

              <div className="ss-community-info">
                <p className="ss-community-info-text">Community Servers are larger spaces where people with shared interests can come together. Enabling Community does not make your server visible on Server Discovery. <a href="#" className="ss-link">Learn more here.</a></p>
              </div>

              <div className="ss-community-features">
                <div className="ss-community-feature-card">
                  <div className="ss-community-feature-icon" style={{ background: '#23a55a' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3m-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3m0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5m8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5"/></svg>
                  </div>
                  <h4 className="ss-community-feature-title">Grow your community</h4>
                  <p className="ss-community-feature-desc">Apply to be in <strong>Server Discovery</strong> so more people can find your server directly on Hyve.</p>
                </div>
                <div className="ss-community-feature-card">
                  <div className="ss-community-feature-icon" style={{ background: '#5865f2' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2M9 17H7v-7h2v7m4 0h-2V7h2v10m4 0h-2v-4h2v4"/></svg>
                  </div>
                  <h4 className="ss-community-feature-title">Keep members engaged</h4>
                  <p className="ss-community-feature-desc">Access tools like <strong>Server Insights</strong> 📊 that can better help you moderate and keep your server engaged.</p>
                </div>
                <div className="ss-community-feature-card">
                  <div className="ss-community-feature-icon" style={{ background: '#ed4245' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2m-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9"/></svg>
                  </div>
                  <h4 className="ss-community-feature-title">Stay informed</h4>
                  <p className="ss-community-feature-desc">Get direct updates about new features built for communities from Hyve.</p>
                </div>
              </div>
            </div>
          )}

          {/* Server Template */}
          {activeSection === 'template' && (() => {
            return (
              <div className="ss-section">
                <h2>Server Template</h2>
                <p className="ss-muted" style={{ marginBottom: 4 }}>A server template is an easy way to share your server setup and help anyone create a server instantly.</p>
                <p className="ss-muted" style={{ marginBottom: 20 }}>When someone uses your server template link, they create a new server pre-filled with the same channels, roles, permissions, and settings as yours.</p>

                <div className="ss-template-info-box">
                  <div className="ss-template-info-col">
                    <span className="ss-template-info-heading">TEMPLATES WILL COPY:</span>
                    <div className="ss-template-info-row">
                      <span className="ss-template-dot green">✔</span>
                      <span>Channels and channel topics</span>
                    </div>
                    <div className="ss-template-info-row">
                      <span className="ss-template-dot green">✔</span>
                      <span>Roles and permissions</span>
                    </div>
                    <div className="ss-template-info-row">
                      <span className="ss-template-dot green">✔</span>
                      <span>Default server settings</span>
                    </div>
                  </div>
                  <div className="ss-template-info-col">
                    <span className="ss-template-info-heading">TEMPLATES WILL NOT COPY:</span>
                    <div className="ss-template-info-row">
                      <span className="ss-template-dot red">✖</span>
                      <span>Messages or any content</span>
                    </div>
                    <div className="ss-template-info-row">
                      <span className="ss-template-dot red">✖</span>
                      <span>Members or bots</span>
                    </div>
                    <div className="ss-template-info-row">
                      <span className="ss-template-dot red">✖</span>
                      <span>Your server icon, Boosts, or other perks</span>
                    </div>
                  </div>
                </div>

                <div className="ss-field-group" style={{ marginTop: 24 }}>
                  <label className="ss-field-label">Template Title <span style={{ color: '#ed4245' }}>*</span></label>
                  <input className="ss-input" placeholder="Who is this server for? E.g. School Club, Artists Community" />
                </div>

                <div className="ss-field-group" style={{ marginTop: 16 }}>
                  <label className="ss-field-label">Template Description</label>
                  <textarea className="ss-textarea" rows={4} placeholder="What can people do in this server?" />
                </div>

                <button className="ss-btn-primary" style={{ marginTop: 20 }}>Generate Template</button>
              </div>
            );
          })()}

          {/* App Directory placeholder */}
          {activeSection === 'appDirectory' && (
            <div className="ss-section">
              <h2>App Directory</h2>
              <p className="ss-muted">This feature is coming soon.</p>
            </div>
          )}

        </div>

        {/* Close area */}
        <div className="ss-close-area">
          <button className="ss-close-btn" onClick={onClose}>
            <span className="ss-close-x">✕</span>
            <span className="ss-close-label">ESC</span>
          </button>
        </div>
      </div>

      {/* Delete Server Modal */}
      {showDeleteModal && (
        <div className="ss-delete-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="ss-delete-modal" onClick={e => e.stopPropagation()}>
            <button className="ss-delete-modal-close" onClick={() => setShowDeleteModal(false)}>✕</button>
            <h2 className="ss-delete-modal-title">Delete '{groupName}'</h2>
            <p className="ss-delete-modal-desc">Are you sure you want to delete <strong>{groupName}</strong>? This action cannot be undone.</p>
            <div className="ss-delete-modal-actions">
              <button className="ss-delete-modal-cancel" onClick={() => setShowDeleteModal(false)}>Cancel</button>
              <button className="ss-delete-modal-confirm" onClick={() => { setShowDeleteModal(false); onDeleteGroup(); }} disabled={busy}>
                {busy ? 'Deleting...' : 'Delete Server'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
