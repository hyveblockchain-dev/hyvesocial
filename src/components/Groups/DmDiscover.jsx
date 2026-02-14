import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';

const CATEGORIES = ['Home', 'Gaming', 'Music', 'Entertainment', 'Science & Tech', 'Education'];

export default function DmDiscover({ onJoinServer }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('Home');
  const [sidebarTab, setSidebarTab] = useState('servers'); // 'servers'

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getGroups();
      setGroups(data?.groups || []);
    } catch (err) {
      console.error('DmDiscover loadGroups error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  const handleJoin = async (groupId) => {
    try {
      const data = await api.joinGroup(groupId);
      if (data?.error) return;
      await loadGroups();
      if (onJoinServer) onJoinServer(groupId);
    } catch (err) {
      console.error('Failed to join group:', err);
    }
  };

  const filteredGroups = useMemo(() => {
    let list = groups.filter((g) => !g.is_member);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (g) =>
          (g.name || '').toLowerCase().includes(q) ||
          (g.description || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [groups, searchQuery]);

  const memberGroups = useMemo(() => groups.filter((g) => g.is_member), [groups]);

  const getCover = (g) => g.cover_image || g.coverImage || '';
  const getAvatar = (g) => g.avatar_image || g.avatarImage || '';
  const getMemberCount = (g) => g.member_count || g.members || 1;

  return (
    <div className="dmd-container">
      {/* ── Left nav sidebar ── */}
      <div className="dmd-sidebar">
        <h2 className="dmd-sidebar-title">Discover</h2>
        <nav className="dmd-sidebar-nav">
          <button className={`dmd-sidebar-item${sidebarTab === 'servers' ? ' active' : ''}`} onClick={() => setSidebarTab('servers')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            <span>Servers</span>
          </button>
        </nav>
      </div>

      {/* ── Main content area ── */}
      <div className="dmd-main">
        {/* Top category bar */}
        <div className="dmd-topbar">
          <div className="dmd-topbar-left">
            <svg className="dmd-topbar-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
            </svg>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`dmd-cat-tab${activeCategory === cat ? ' active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="dmd-topbar-right">
            <div className="dmd-topbar-search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
              <input
                type="text"
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="dmd-scroll">
          {/* Hero banner */}
          <div className="dmd-hero">
            <div className="dmd-hero-text">
              <h1>FIND YOUR COMMUNITY<br />ON HYVE</h1>
              <p>From gaming, to music, to learning, there's a place for you.</p>
            </div>
          </div>

          {/* Featured Servers */}
          <div className="dmd-section">
            <h3 className="dmd-section-title">Featured Servers</h3>

            {loading ? (
              <div className="dmd-loading">Loading servers...</div>
            ) : filteredGroups.length === 0 ? (
              <div className="dmd-loading">No servers found.</div>
            ) : (
              <div className="dmd-grid">
                {filteredGroups.map((group) => (
                  <div
                    key={group.id}
                    className="dmd-card"
                    onClick={() => navigate(`/groups/${group.id}`)}
                  >
                    <div className="dmd-card-cover">
                      {getCover(group) ? (
                        <img src={getCover(group)} alt="" loading="lazy" />
                      ) : (
                        <div className="dmd-card-cover-fallback" />
                      )}
                      {/* Server icon overlapping bottom of cover */}
                      <div className="dmd-card-avatar">
                        {getAvatar(group) ? (
                          <img src={getAvatar(group)} alt="" />
                        ) : (
                          <div className="dmd-card-avatar-letter">
                            {(group.name || '?')[0].toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="dmd-card-body">
                      <div className="dmd-card-name">
                        <span className="dmd-card-online-dot" />
                        <span>{group.name}</span>
                      </div>
                      {group.description && (
                        <p className="dmd-card-desc">{group.description}</p>
                      )}
                      <div className="dmd-card-meta">
                        <span className="dmd-card-meta-online">
                          <span className="dmd-meta-dot online" />
                          {getMemberCount(group)} Members
                        </span>
                        <span className="dmd-card-meta-members">
                          <span className="dmd-meta-dot members" />
                          {String(group.privacy || 'public').charAt(0).toUpperCase() + String(group.privacy || 'public').slice(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
