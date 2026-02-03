import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import './Groups.css';

const SUGGESTED_GROUPS = [
  {
    id: 'design-hub',
    name: 'Design Hub',
    members: 1280,
    privacy: 'Public',
    coverImage: 'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'builders-lab',
    name: 'Builders Lab',
    members: 742,
    privacy: 'Private',
    coverImage: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80'
  },
  {
    id: 'creator-roundtable',
    name: 'Creator Roundtable',
    members: 530,
    privacy: 'Public',
    coverImage: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80'
  }
];

export default function Groups() {
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('Public');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const coverPool = useMemo(
    () => [
      'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80',
      'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80'
    ],
    []
  );

  useEffect(() => {
    loadGroups();
  }, []);

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

  const memberGroups = groups.filter((group) => group.is_member);
  const discoverGroups = groups.filter((group) => !group.is_member);

  return (
    <div className="groups-page">
      <div className="groups-header">
        <div>
          <h1>Groups</h1>
          <p>Build communities around shared interests.</p>
        </div>
        <button className="groups-primary" onClick={() => setShowCreate(true)}>
          Create Group
        </button>
      </div>

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

      <section className="groups-section">
        <h2>Your groups</h2>
        {loading ? (
          <div className="groups-empty">Loading groups...</div>
        ) : memberGroups.length === 0 ? (
          <div className="groups-empty">
            <p>No groups yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="groups-grid">
            {memberGroups.map((group) => (
              <div
                key={group.id}
                className="group-card clickable"
                onClick={() => navigate(`/groups/${group.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="group-cover">
                  <img src={group.cover_image || group.coverImage} alt={group.name} loading="lazy" />
                </div>
                <div className="group-content">
                  <h3>{group.name}</h3>
                  {group.description && <p>{group.description}</p>}
                  <div className="group-meta">
                    <span>{group.member_count || 1} members</span>
                    <span>{group.privacy}</span>
                  </div>
                  <button
                    type="button"
                    className="groups-secondary"
                    onClick={e => { e.stopPropagation(); handleLeaveGroup(group.id); }}
                  >
                    Leave group
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="groups-section">
        <h2>Suggested groups</h2>
        {discoverGroups.length === 0 ? (
          <div className="groups-empty">
            <p>No public groups available right now.</p>
          </div>
        ) : (
          <div className="groups-grid">
            {discoverGroups.map((group) => (
              <div
                key={group.id}
                className="group-card clickable"
                onClick={() => navigate(`/groups/${group.id}`)}
                style={{ cursor: 'pointer' }}
              >
                <div className="group-cover">
                  <img src={group.cover_image || group.coverImage} alt={group.name} loading="lazy" />
                </div>
                <div className="group-content">
                  <h3>{group.name}</h3>
                  <p>{group.description || 'Join a focused community of builders and creators.'}</p>
                  <div className="group-meta">
                    <span>{group.member_count || 0} members</span>
                    <span>{group.privacy}</span>
                  </div>
                  <button
                    type="button"
                    className="groups-secondary"
                    onClick={e => { e.stopPropagation(); handleJoinGroup(group.id); }}
                  >
                    Join group
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
