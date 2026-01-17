import { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import CONTRACT_ABI from '../contract-abi.json'

const CONTRACT_ADDRESS = '0x5F817E8f2512d3D6E7cEF427A5d0b023e30190b0'

export default function Home({ account, provider, signer }) {
  const [posts, setPosts] = useState([])
  const [profiles, setProfiles] = useState({})
  const [userProfile, setUserProfile] = useState(null)
  const [showCreatePost, setShowCreatePost] = useState(false)
  const [postContent, setPostContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  // Profile creation state
  const [showCreateProfile, setShowCreateProfile] = useState(false)
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')

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
      
      // Read postCount from storage slot 3 since the function call reverts
      const postCountHex = await provider.getStorageAt(CONTRACT_ADDRESS, 3)
      const postCount = parseInt(postCountHex, 16)
      
      const loadedPosts = []
      const loadedProfiles = {}

      console.log('Total post count:', postCount)

      for (let i = postCount; i > 0 && loadedPosts.length < 20; i--) {
        try {
          const post = await contract.getPost(i)
          console.log('Loaded post:', i, post)
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
                const profile = await contract.getProfile(post.author)
                loadedProfiles[post.author] = {
                  username: profile.username || 'Anonymous',
                  avatar: profile.avatar
                }
              } catch (e) {
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
      const tx = await contract.createProfile(username.trim(), bio.trim() || '', '')
      await tx.wait()
      
      setShowCreateProfile(false)
      loadUserProfile()
    } catch (error) {
      console.error('Error creating profile:', error)
      alert('Error creating profile: ' + (error.reason || error.message))
    } finally {
      setIsLoading(false)
    }
  }

  const createPost = async () => {
    if (!postContent.trim()) {
      alert('Please enter post content')
      return
    }

    setIsLoading(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const tx = await contract.createPost(postContent.trim(), '')
      await tx.wait()
      
      setPostContent('')
      setShowCreatePost(false)
      loadPosts()
    } catch (error) {
      console.error('Error creating post:', error)
      alert('Error creating post: ' + (error.reason || error.message))
    } finally {
      setIsLoading(false)
    }
  }

  const likePost = async (postId) => {
    setIsLoading(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const tx = await contract.likePost(postId)
      await tx.wait()
      loadPosts()
    } catch (error) {
      console.error('Error liking post:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!account) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        minHeight: '80vh',
        color: '#fff',
        fontSize: '1.5rem'
      }}>
        👆 Please connect your wallet to continue
      </div>
    )
  }

  if (showCreateProfile) {
    return (
      <div style={{ 
        maxWidth: '500px', 
        margin: '4rem auto', 
        padding: '2rem',
        background: '#1a1a1a',
        borderRadius: '12px',
        border: '1px solid #333'
      }}>
        <h2 style={{ color: '#f59e0b', marginBottom: '1.5rem' }}>
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
          rows={3}
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
            padding: '0.75rem',
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
    )
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '2rem 1rem' }}>
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
          <p style={{ color: '#888', marginBottom: '0.5rem' }}>{userProfile.bio}</p>
          <p style={{ color: '#666', fontSize: '0.9rem' }}>
            {userProfile.postCount} posts
          </p>
        </div>
      )}

      <button
        onClick={() => setShowCreatePost(!showCreatePost)}
        style={{
          width: '100%',
          padding: '1rem',
          background: '#f59e0b',
          color: '#000',
          border: 'none',
          borderRadius: '12px',
          fontSize: '1rem',
          fontWeight: 'bold',
          cursor: 'pointer',
          marginBottom: '2rem'
        }}
      >
        {showCreatePost ? '✕ Cancel' : '✏️ Create Post'}
      </button>

      {showCreatePost && (
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
            rows={4}
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
            disabled={isLoading || !postContent.trim()}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: '#f59e0b',
              color: '#000',
              border: 'none',
              borderRadius: '8px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: (isLoading || !postContent.trim()) ? 'not-allowed' : 'pointer',
              opacity: (isLoading || !postContent.trim()) ? 0.5 : 1
            }}
          >
            {isLoading ? 'Posting...' : 'Post'}
          </button>
        </div>
      )}

      <div style={{ color: '#fff' }}>
        <h3 style={{ marginBottom: '1.5rem', color: '#f59e0b' }}>Feed</h3>
        
        {posts.length === 0 ? (
          <p style={{ color: '#888', textAlign: 'center', padding: '3rem 0' }}>
            No posts yet. Be the first to post!
          </p>
        ) : (
          posts.map(post => (
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
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                marginBottom: '1rem'
              }}>
                <div>
                  <div style={{ color: '#f59e0b', fontWeight: 'bold' }}>
                    {profiles[post.author]?.username || 'Loading...'}
                  </div>
                  <div style={{ color: '#666', fontSize: '0.85rem' }}>
                    {new Date(post.timestamp * 1000).toLocaleDateString()}
                  </div>
                </div>
              </div>
              
              <p style={{ color: '#fff', marginBottom: '1rem', lineHeight: 1.5 }}>
                {post.content}
              </p>
              
              <button
                onClick={() => likePost(post.id)}
                disabled={isLoading}
                style={{
                  background: 'transparent',
                  border: '1px solid #333',
                  color: '#f59e0b',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  fontSize: '0.9rem'
                }}
              >
                ❤️ {post.likes} {post.likes === 1 ? 'Like' : 'Likes'}
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
