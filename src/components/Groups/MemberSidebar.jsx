import { useCallback, useEffect, useState } from 'react';
import api from '../../services/api';
import socketService from '../../services/socket';
import './GroupDetail.css';

export default function MemberSidebar({ groupId, user, isAdmin, isOwner, onMemberClick }) {
  const [members, setMembers] = useState([]);
  const [onlineUsernames, setOnlineUsernames] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMembers = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await api.getMembersWithRoles(groupId);
      setMembers(data?.members || []);
    } catch {
      // fallback to regular members
      try {
        const data = await api.getGroupMembers(groupId);
        setMembers((data?.members || []).map((m) => ({ ...m, custom_roles: [] })));
      } catch { setMembers([]); }
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  const loadOnline = useCallback(async () => {
    if (!groupId) return;
    try {
      const data = await api.getGroupOnlineMembers(groupId);
      setOnlineUsernames(data?.online || []);
    } catch {
      setOnlineUsernames([]);
    }
  }, [groupId]);

  useEffect(() => {
    loadMembers();
    loadOnline();
    const interval = setInterval(loadOnline, 30000);
    return () => clearInterval(interval);
  }, [loadMembers, loadOnline]);

  // Listen for presence updates
  useEffect(() => {
    if (!socketService.socket || !groupId) return;
    socketService.socket.emit('join_group', groupId);

    const handlePresence = () => { loadOnline(); };
    socketService.socket.on('group_presence_update', handlePresence);

    return () => {
      socketService.socket.emit('leave_group', groupId);
      socketService.socket.off('group_presence_update', handlePresence);
    };
  }, [groupId, loadOnline]);

  // Split members into categories by role
  const ownerMembers = members.filter((m) => m.role === 'owner');
  const adminMembers = members.filter((m) => m.role === 'admin');
  const regularMembers = members.filter((m) => m.role !== 'owner' && m.role !== 'admin');

  const isOnline = (username) => onlineUsernames.some((u) => u.toLowerCase() === (username || '').toLowerCase());

  const renderMember = (m) => {
    const online = isOnline(m.username);
    const roles = typeof m.custom_roles === 'string' ? JSON.parse(m.custom_roles) : (m.custom_roles || []);
    const topRole = roles.length > 0 ? roles[0] : null;

    return (
      <div
        key={m.user_address || m.username}
        className={`member-item${online ? ' member-online' : ''}`}
        onClick={() => onMemberClick?.(m)}
      >
        <div className="member-avatar-wrap">
          <img
            src={m.profile_image || '/default-avatar.png'}
            alt=""
            className="member-avatar"
            onError={(e) => { e.target.src = '/default-avatar.png'; }}
          />
          <span className={`member-status-dot${online ? ' online' : ' offline'}`} />
        </div>
        <div className="member-info">
          <span
            className="member-name"
            style={topRole?.color ? { color: topRole.color } : undefined}
          >
            {m.username || 'Unknown'}
          </span>
          {roles.length > 0 && (
            <div className="member-roles-badges">
              {roles.map((r) => (
                <span key={r.id} className="role-badge" style={{ backgroundColor: r.color + '33', color: r.color, borderColor: r.color }}>
                  {r.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="member-sidebar">
        <div className="member-sidebar-loading">Loading members...</div>
      </div>
    );
  }

  return (
    <div className="member-sidebar">
      {ownerMembers.length > 0 && (
        <div className="member-category">
          <div className="member-category-header">
            OWNER — {ownerMembers.length}
          </div>
          {ownerMembers.map(renderMember)}
        </div>
      )}
      {adminMembers.length > 0 && (
        <div className="member-category">
          <div className="member-category-header">
            ADMINS — {adminMembers.length}
          </div>
          {adminMembers.map(renderMember)}
        </div>
      )}
      {regularMembers.length > 0 && (
        <div className="member-category">
          <div className="member-category-header">
            MEMBERS — {regularMembers.length}
          </div>
          {regularMembers.map(renderMember)}
        </div>
      )}
    </div>
  );
}
