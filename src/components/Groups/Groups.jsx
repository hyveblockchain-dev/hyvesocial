import { useEffect, useMemo, useState } from 'react';
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

const LOCAL_GROUPS_KEY = 'hyve_local_groups';

export default function Groups() {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [privacy, setPrivacy] = useState('Public');
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_GROUPS_KEY);
      if (stored) {
        setGroups(JSON.parse(stored));
      }
    } catch (error) {
      setGroups([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(LOCAL_GROUPS_KEY, JSON.stringify(groups));
  }, [groups]);

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

  function handleCreateGroup(event) {
    event.preventDefault();

    if (!name.trim()) return;

    const nextGroup = {
      id: `group-${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      privacy,
      members: 1,
      coverImage: coverPool[Math.floor(Math.random() * coverPool.length)]
    };

    setGroups((prev) => [nextGroup, ...prev]);
    resetForm();
    setShowCreate(false);
  }

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
        {groups.length === 0 ? (
          <div className="groups-empty">
            <p>No groups yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="groups-grid">
            {groups.map((group) => (
              <div key={group.id} className="group-card">
                <div className="group-cover">
                  <img src={group.coverImage} alt={group.name} loading="lazy" />
                </div>
                <div className="group-content">
                  <h3>{group.name}</h3>
                  {group.description && <p>{group.description}</p>}
                  <div className="group-meta">
                    <span>{group.members} member</span>
                    <span>{group.privacy}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="groups-section">
        <h2>Suggested groups</h2>
        <div className="groups-grid">
          {SUGGESTED_GROUPS.map((group) => (
            <div key={group.id} className="group-card">
              <div className="group-cover">
                <img src={group.coverImage} alt={group.name} loading="lazy" />
              </div>
              <div className="group-content">
                <h3>{group.name}</h3>
                <p>Join a focused community of builders and creators.</p>
                <div className="group-meta">
                  <span>{group.members} members</span>
                  <span>{group.privacy}</span>
                </div>
                <button type="button" className="groups-secondary">
                  Join group
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
