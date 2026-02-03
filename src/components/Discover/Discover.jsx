// src/components/Discover/Discover.jsx
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import api from '../../services/api';
import './Discover.css';

const TOPICS = ['Blockchain', 'Web3', 'NFTs', 'DeFi', 'Gaming', 'Art', 'Music', 'Startups'];

export default function Discover() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [trendingPosts, setTrendingPosts] = useState([]);
  const [suggestedUsers, setSuggestedUsers] = useState([]);
  const [pendingRequests, setPendingRequests] = useState({});

  useEffect(() => {
    loadDiscover();
  }, []);

  async function loadDiscover() {
    try {
      setLoading(true);
      const [postsData, usersData] = await Promise.all([
        api.getPosts({ limit: 6, offset: 0 }),
        api.getUsers()
      ]);

      setTrendingPosts(postsData.posts || []);

      const users = usersData.users || usersData || [];
      const filtered = users
        .filter((u) => u.wallet_address !== user?.walletAddress)
        .slice(0, 8);
      setSuggestedUsers(filtered);
    } catch (error) {
      console.error('Load discover error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSendRequest(address) {
    try {
      setPendingRequests((prev) => ({ ...prev, [address]: true }));
      await api.sendFriendRequest(address);
    } catch (error) {
      console.error('Send friend request error:', error);
      setPendingRequests((prev) => ({ ...prev, [address]: false }));
      alert('Failed to send friend request');
    }
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString();
  }

  const filteredTopics = useMemo(() => {
    if (!searchQuery) return TOPICS;
    return TOPICS.filter((topic) => topic.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [searchQuery]);

  return (
    <div className="discover-page">
      <div className="discover-header">
        <div>
          <h1>Discover</h1>
          <p>Explore trending posts, people, and topics</p>
        </div>
        <div className="discover-search">
          <input
            type="text"
            placeholder="Search topics or people..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="discover-loading">Loading discover feed...</div>
      ) : (
        <div className="discover-layout">
          <div className="discover-main">
            <section className="discover-section">
              <div className="section-header">
                <h2>Trending Posts</h2>
                <span>{trendingPosts.length} posts</span>
              </div>
              <div className="trending-grid">
                {trendingPosts.map((post) => (
                  <div key={post.id} className="trending-card">
                    <div className="trending-meta">
                      <div className="trending-avatar">
                        {post.profile_image ? (
                          <img src={post.profile_image} alt={post.username} />
                        ) : (
                          <div className="avatar-placeholder">
                            {post.username?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="trending-author">{post.username || 'Anonymous'}</div>
                        <div className="trending-time">{formatDate(post.created_at)}</div>
                      </div>
                    </div>
                    <p className="trending-content">{post.content}</p>
                    {post.image_url && (
                      <div className="trending-media">
                        <img src={post.image_url} alt="Post" />
                      </div>
                    )}
                    <div className="trending-stats">
                      <span>👍 {post.reaction_count || 0}</span>
                      <span>💬 {post.comment_count || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="discover-section">
              <div className="section-header">
                <h2>Topics for you</h2>
                <span>{filteredTopics.length} topics</span>
              </div>
              <div className="topics-grid">
                {filteredTopics.map((topic) => (
                  <div key={topic} className="topic-pill">
                    #{topic}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="discover-sidebar">
            <section className="discover-section">
              <div className="section-header">
                <h2>People you may know</h2>
                <span>{suggestedUsers.length} suggestions</span>
              </div>
              <div className="suggested-list">
                {suggestedUsers.map((suggested) => (
                  <div key={suggested.wallet_address} className="suggested-card">
                    <div className="suggested-info">
                      <div className="suggested-avatar">
                        {suggested.profile_image ? (
                          <img src={suggested.profile_image} alt={suggested.username} />
                        ) : (
                          <div className="avatar-placeholder">
                            {suggested.username?.charAt(0).toUpperCase() || '?'}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="suggested-name">{suggested.username}</div>
                        {suggested.bio && <div className="suggested-bio">{suggested.bio}</div>}
                      </div>
                    </div>
                    <button
                      className="btn-primary"
                      onClick={() => handleSendRequest(suggested.wallet_address)}
                      disabled={pendingRequests[suggested.wallet_address]}
                    >
                      {pendingRequests[suggested.wallet_address] ? 'Requested' : 'Add Friend'}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}
