import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import './GroupDetail.css';

export default function GroupDetail() {
  const { groupId } = useParams();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchGroup() {
      setLoading(true);
      setError('');
      try {
        // You may want to create a getGroupById API endpoint for real data
        const data = await api.getGroups();
        const found = (data.groups || []).find(g => g.id === groupId);
        setGroup(found || null);
        if (!found) setError('Group not found.');
      } catch (err) {
        setError('Failed to load group.');
      } finally {
        setLoading(false);
      }
    }
    fetchGroup();
  }, [groupId]);

  if (loading) return <div className="group-detail-page">Loading...</div>;
  if (error) return <div className="group-detail-page error">{error}</div>;
  if (!group) return <div className="group-detail-page">Group not found.</div>;

  return (
    <div className="group-detail-page">
      <div className="group-detail-header">
        <img className="group-detail-cover" src={group.cover_image || group.coverImage} alt={group.name} />
        <div className="group-detail-info">
          <h1>{group.name}</h1>
          <p>{group.description}</p>
          <div className="group-detail-meta">
            <span>{group.member_count || 1} members</span>
            <span>{group.privacy}</span>
          </div>
        </div>
      </div>
      {/* Add posts, members, etc. here */}
      <div className="group-detail-content">
        <p>Group content coming soon...</p>
      </div>
    </div>
  );
}
