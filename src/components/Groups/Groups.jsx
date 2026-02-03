import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './Groups.css';

export default function Groups() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('Public');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState('your');
  const [search, setSearch] = useState('');

  const coverPool = useMemo(
    () => [
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80'
    ],
    []
  );

  function resetForm() {
    setName('');
    setDescription('');
    setPrivacy('Public');
  }

  async function loadGroups() {
    try {
      setLoading(true);
      setError('');

      const data = await api.getGroups();
      if (data?.error) {
        setError(data.error);
        setGroups([]);
        return;
      }

      setGroups(data?.groups || []);
    } catch (err) {
      console.error('Failed to load groups:', err);
      setError('Failed to load groups.');
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  useEffect(() => {
    if (loading) return;
    const hasYourGroups = groups.some((g) => !!g.is_member);
    setActiveView(hasYourGroups ? 'your' : 'discover');
  }, [loading, groups]);

  async function handleCreateGroup(event) {
    event.preventDefault();
    if (!name.trim()) return;

    try {
      setError('');
      const payload = {
        name: name.trim(),
        description: description.trim(),
        privacy: privacy.toLowerCase(),
        coverImage: coverPool[Math.floor(Math.random() * coverPool.length)]
      };
      const data = await api.createGroup(payload);
      if (data?.error) {
        setError(data.error);
        return;
      }
      resetForm();
      setShowCreate(false);
      await loadGroups();
    } catch (err) {
      console.error('Failed to create group:', err);
      setError('Failed to create group.');
    }
  }

  async function handleJoinGroup(groupId) {
    try {
      const data = await api.joinGroup(groupId);
      if (data?.error) {
        setError(data.error);
        return;
      }
      if (data?.requested) {
        setError('Join request sent. Waiting for admin approval.');
        return;
      }
      await loadGroups();
    } catch (err) {
      console.error('Failed to join group:', err);
      setError('Failed to join group.');
    }
  }

  async function handleLeaveGroup(groupId) {
    try {
      const data = await api.leaveGroup(groupId);
      if (data?.error) {
        setError(data.error);
        return;
      }
      await loadGroups();
    } catch (err) {
      console.error('Failed to leave group:', err);
      setError('Failed to leave group.');
    }
  }

  const memberGroups = useMemo(() => groups.filter((g) => g.is_member), [groups]);
  const discoverGroups = useMemo(() => groups.filter((g) => !g.is_member), [groups]);

  const filteredMemberGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return memberGroups;
    return memberGroups.filter((g) => String(g.name || '').toLowerCase().includes(q));
  }, [memberGroups, search]);

  const filteredDiscoverGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return discoverGroups;
    return discoverGroups.filter((g) => String(g.name || '').toLowerCase().includes(q));
  }, [discoverGroups, search]);

  const railGroups = activeView === 'your' ? filteredMemberGroups : filteredDiscoverGroups;
  const mainGroups = railGroups;

  function coverFor(group) {
    return group.cover_image || group.coverImage;
  }

  function memberCountFor(group) {
    return group.member_count || group.members || 1;
  }

  function privacyLabelFor(group) {
    return String(group.privacy || 'public').toLowerCase();
  }

  return (
    <div className="groups-page">
      {error && <div className="groups-error">{error}</div>}

      {showCreate && (
        <div className="groups-create">
          <form onSubmit={handleCreateGroup}>
            <div className="groups-create-header">
              <h2>Create a group</h2>
              <button
                type="button"
                className="groups-close"
                onClick={() => {
                  resetForm();
                  setShowCreate(false);
                }}
              >
                Close
              </button>
            </div>

            <label>
              Group name
              <input
                type="text"
                placeholder="Enter a group name"
                value={name}
                maxLength={50}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label>
              Description
              <textarea
                rows={3}
                placeholder="Describe what this group is about"
                value={description}
                maxLength={160}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <label>
              Privacy
              <select value={privacy} onChange={(event) => setPrivacy(event.target.value)}>
                <option value="Public">Public</option>
                <option value="Private">Private</option>
              </select>
            </label>

            <button type="submit" className="groups-primary">
              Create
            </button>
          </form>
        </div>
      )}

      <header className="groups-header">
        <div className="groups-header-top">
          <div>
            <h1 className="groups-title">Groups</h1>
            <p className="groups-subtitle">Communities and people.</p>
          </div>
          <button className="groups-primary" onClick={() => setShowCreate(true)}>
            + Create Group
          </button>
        </div>

        <div className="groups-header-controls">
          <div className="groups-tabs">
            <button
              type="button"
              className={activeView === 'your' ? 'groups-tab active' : 'groups-tab'}
              onClick={() => setActiveView('your')}
            >
              Your groups
            </button>
            <button
              type="button"
              className={activeView === 'discover' ? 'groups-tab active' : 'groups-tab'}
              onClick={() => setActiveView('discover')}
            >
              Discover
            </button>
          </div>

          <div className="groups-search">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search groups..."
              aria-label="Search groups"
            />
          </div>
        </div>
      </header>

      <main className="groups-main">

          {loading ? (
            <div className="groups-empty">Loading groups...</div>
          ) : mainGroups.length === 0 ? (
            <div className="groups-empty">
              {activeView === 'your' ? <p>Create a group to get started.</p> : <p>No public groups available right now.</p>}
            </div>
          ) : (
            <div className="groups-grid">
              {mainGroups.map((group) => (
                <div
                  key={group.id}
                  className="group-card clickable"
                  onClick={() => navigate(`/groups/${group.id}`)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="group-cover">
                    {coverFor(group) ? (
                      <img src={coverFor(group)} alt={group.name} loading="lazy" />
                    ) : (
                      <div className="groups-cover-fallback" aria-hidden="true" />
                    )}
                  </div>
                  <div className="group-content">
                    <h3>{group.name}</h3>
                    {group.description && <p>{group.description}</p>}
                    <div className="group-meta">
                      <span>{memberCountFor(group)} members</span>
                      <span>{privacyLabelFor(group)}</span>
                    </div>
                    {group.is_member ? (
                      <button
                        type="button"
                        className="groups-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLeaveGroup(group.id);
                        }}
                      >
                        Leave group
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="groups-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinGroup(group.id);
                        }}
                      >
                        {privacyLabelFor(group) === 'private' ? 'Request to join' : 'Join group'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
    </div>
  );

}
