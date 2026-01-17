import { useState, useEffect } from 'react'
import { ethers } from 'ethers'

const CONTRACT_ADDRESS = '0x5F817E8f2512d3D6E7cEF427A5d0b023e30190b0'
const CONTRACT_ABI = require('../contract-abi.json')

export default function Home({ account, provider, signer }) {
  const [posts, setPosts] = useState([])
  const [profiles, setProfiles] = useState({})
  const [userProfile, setUserProfile] = useState(null)
  const [showCreateProfile, setShowCreateProfile] = useState(false)
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [postContent, setPostContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (account && signer) {
      loadUserProfile()
      loadPosts()
    }
  }, [account, signer])

  const loadUserProfile = async () => {
    if (!signer) return
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const profile = await contract.getProfile(account)
      
      if (profile.exists) {
        setUserProfile({
          username: profile.username,
          bio: profile.bio,
          avatar: profile.profilePicture || '',
          postCount: 0
        })
        setShowCreateProfile(false)
      } else {
        setShowCreateProfile(true)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
      setShowCreateProfile(true)
    }
  }

  const loadPosts = async () => {
    if (!provider) return
    
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)
      const postCount = await contract.postCount
      const loadedPosts = []
      const loadedProfiles = {}

      for (let i = postCount.toNumber(); i > 0 && loadedPosts.length < 20; i--) {
        try {
          const post = await contract.getPost(i)
          if (post.content) {
            loadedPosts.push({
              id: i,
              content: post.content,
              author: post.author,
              timestamp: post.timestamp.toNumber(),
              likes: post.likes.toNumber()
            })

            if (!loadedProfiles[post.author]) {
              try {
                const authorProfile = await contract.getProfile(post.author)
                loadedProfiles[post.author] = {
                  username: authorProfile.username || 'Anonymous',
                  avatar: ''
                }
              } catch (error) {
                loadedProfiles[post.author] = {
                  username: 'Anonymous',
                  avatar: ''
                }
              }
            }
          }
        } catch (error) {
          console.error(`Error loading post ${i}:`, error)
        }
      }

      setPosts(loadedPosts)
      setProfiles(loadedProfiles)
    } catch (error) {
      console.error('Error loading posts:', error)
    }
  }

  const createProfile = async () => {
    if (!username.trim()) {
      alert('Please enter a username')
      return
    }

    setIsLoading(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const tx = await contract.createProfile(username.trim(), (bio || '').trim(), '')
      await tx.wait()
      
      setShowCreateProfile(false)
      await loadUserProfile()
      alert('Profile created successfully!')
    } catch (error) {
      console.error('Error creating profile:', error)
      alert('Failed to create profile')
    }
    setIsLoading(false)
  }

  const createPost = async () => {
    if (!postContent.trim()) {
      alert('Please enter some content')
      return
    }

    setIsLoading(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const tx = await contract.createPost(postContent.trim(), '')
      await tx.wait()
      
      setPostContent('')
      await loadPosts()
      alert('Post created successfully!')
    } catch (error) {
      console.error('Error creating post:', error)
      alert('Failed to create post')
    }
    setIsLoading(false)
  }

  const likePost = async (postId) => {
    setIsLoading(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const tx = await contract.likePost(postId)
      await tx.wait()
      
      await loadPosts()
    } catch (error) {
      console.error('Error liking post:', error)
      alert('Failed to like post')
    }
    setIsLoading(false)
  }

  if (!account) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <h2 style={{ color: '#fff', fontSize: '2rem', marginBottom: '1rem' }}>
          Welcome to Hyve Social
        </h2>
        <p style={{ color: '#888', fontSize: '1.25rem' }}>
          Connect your wallet to get started
        </p>
      </div>
    )
  }

  if (showCreateProfile) {
    return (
      <div style={{ 
        padding: '4rem 2rem', 
        maxWidth: '600px', 
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 100px)'
      }}>
        <div style={{
          background: '#1a1a1a',
          padding: '2rem',
          borderRadius: '12px',
          border: '1px solid #333',
          width: '100%'
        }}>
          <h2 style={{ color: '#f59e0b', marginBottom: '2rem', textAlign: 'center' }}>
            Create Your Profile
          </h2>
          
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1rem',
              background: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem'
            }}
          />
          
          <textarea
            placeholder="Bio (optional)"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
            style={{
              width: '100%',
              padding: '0.75rem',
              marginBottom: '1.5rem',
              background: '#0a0a0a',
              border: '1px solid #333',
              borderRadius: '8px',
              color: '#fff',
              fontSize: '1rem',
              resize: 'vertical'
            }}
          />
          
          <button
            onClick={createProfile}
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '1rem',
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              opacity: isLoading ? 0.5 : 1
            }}
          >
            {isLoading ? 'Creating...' : 'Create Profile'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      {userProfile && (
        <div style={{
          background: '#1a1a1a',
          padding: '1.5rem',
          borderRadius: '12px',
          border: '1px solid #333',
          marginBottom: '2rem'
        }}>
          <h2 style={{ color: '#f59e0b', marginBottom: '0.5rem' }}>
            {userProfile.username}
          </h2>
          {userProfile.bio && (
            <p style={{ color: '#888' }}>{userProfile.bio}</p>
          )}
        </div>
      )}

      <div style={{
        background: '#1a1a1a',
        padding: '1.5rem',
        borderRadius: '12px',
        border: '1px solid #333',
        marginBottom: '2rem'
      }}>
        <textarea
          placeholder="What's on your mind?"
          value={postContent}
          onChange={(e) => setPostContent(e.target.value)}
          rows={3}
          style={{
            width: '100%',
            padding: '0.75rem',
            marginBottom: '1rem',
            background: '#0a0a0a',
            border: '1px solid #333',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '1rem',
            resize: 'vertical'
          }}
        />
        
        <button
          onClick={createPost}
          disabled={isLoading}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#f59e0b',
            color: '#000',
            border: 'none',
            borderRadius: '8px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            opacity: isLoading ? 0.5 : 1
          }}
        >
          {isLoading ? 'Posting...' : 'Post'}
        </button>
      </div>

      <div>
        {posts.length === 0 ? (
          <div style={{
            background: '#1a1a1a',
            padding: '2rem',
            borderRadius: '12px',
            border: '1px solid #333',
            textAlign: 'center'
          }}>
            <p style={{ color: '#888' }}>No posts yet. Be the first to post!</p>
          </div>
        ) : (
          posts.map((post) => (
            <div
              key={post.id}
              style={{
                background: '#1a1a1a',
                padding: '1.5rem',
                borderRadius: '12px',
                border: '1px solid #333',
                marginBottom: '1rem'
              }}
            >
              <div style={{ marginBottom: '1rem' }}>
                <span style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                  {profiles[post.author]?.username || 'Anonymous'}
                </span>
                <span style={{ color: '#666', marginLeft: '0.5rem', fontSize: '0.875rem' }}>
                  {new Date(post.timestamp * 1000).toLocaleString()}
                </span>
              </div>
              
              <p style={{ color: '#fff', marginBottom: '1rem', whiteSpace: 'pre-wrap' }}>
                {post.content}
              </p>
              
              <button
                onClick={() => likePost(post.id)}
                disabled={isLoading}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#333',
                  color: '#f59e0b',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                ❤️ {post.likes}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
