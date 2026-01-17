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
  const [profilePicture, setProfilePicture] = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [imagePreview, setImagePreview] = useState('')
  const [postContent, setPostContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')

  useEffect(() => {
    if (account && signer) {
      loadUserProfile()
      loadPosts()
    }
  }, [account, signer])

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      // Recommend smaller images for on-chain storage
      if (file.size > 500 * 1024) { // 500KB limit for reasonable gas costs
        alert('For best results, please use an image smaller than 500KB. Larger images will cost more gas to store on-chain.')
        // Still allow it, but warn user
      }
      
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }
      
      setSelectedFile(file)
      
      // Convert to base64 and show preview
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result
        setImagePreview(base64String)
        setProfilePicture(base64String) // Store base64 directly
      }
      reader.readAsDataURL(file)
    }
  }

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
          address: account
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
      
      const postCountHex = await provider.getStorageAt(CONTRACT_ADDRESS, 3)
      const postCount = parseInt(postCountHex, 16)
      
      const loadedPosts = []
      const loadedProfiles = {}

      for (let i = postCount; i > 0 && loadedPosts.length < 50; i--) {
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
                  avatar: authorProfile.profilePicture || ''
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
      setUploadProgress('Creating profile on blockchain...')
      
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const tx = await contract.createProfile(
        username.trim(), 
        (bio || '').trim(), 
        profilePicture.trim()
      )
      
      setUploadProgress('Waiting for confirmation...')
      await tx.wait()
      
      setShowCreateProfile(false)
      setUploadProgress('')
      await loadUserProfile()
      alert('Profile created successfully!')
    } catch (error) {
      console.error('Error creating profile:', error)
      setUploadProgress('')
      alert('Failed to create profile: ' + error.message)
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
          
          {/* Image Upload Section */}
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <div style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              background: imagePreview ? `url(${imagePreview})` : '#333',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              margin: '0 auto 1rem',
              border: '3px solid #f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#666',
              fontSize: '3rem'
            }}>
              {!imagePreview && '📷'}
            </div>
            
            <label style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              background: '#333',
              color: '#f59e0b',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.9375rem'
            }}>
              {selectedFile ? 'Change Photo' : 'Upload Photo'}
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </label>
            <p style={{ color: '#666', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              Recommended: under 500KB for lower gas costs
            </p>
          </div>
          
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
          
          {uploadProgress && (
            <div style={{
              padding: '0.75rem',
              background: '#0a0a0a',
              border: '1px solid #f59e0b',
              borderRadius: '8px',
              color: '#f59e0b',
              textAlign: 'center',
              marginBottom: '1rem',
              fontSize: '0.9375rem'
            }}>
              {uploadProgress}
            </div>
          )}
          
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
          
          <p style={{ 
            color: '#666', 
            fontSize: '0.75rem', 
            marginTop: '1rem',
            textAlign: 'center'
          }}>
            Your image will be stored directly on the blockchain
          </p>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: 'calc(100vh - 80px)' }}>
      {/* LEFT SIDEBAR */}
      <div style={{
        width: '280px',
        background: '#1a1a1a',
        borderRight: '1px solid #333',
        padding: '1.5rem',
        overflowY: 'auto',
        position: 'sticky',
        top: 0,
        height: 'calc(100vh - 80px)'
      }}>
        {/* User Profile Section */}
        {userProfile && (
          <div style={{ marginBottom: '2rem' }}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '50%',
              background: userProfile.avatar ? `url(${userProfile.avatar})` : '#f59e0b',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              margin: '0 auto 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2.5rem',
              color: '#000',
              fontWeight: 'bold',
              border: '3px solid #f59e0b'
            }}>
              {!userProfile.avatar && userProfile.username.charAt(0).toUpperCase()}
            </div>
            <h3 style={{ 
              color: '#f59e0b', 
              textAlign: 'center',
              fontSize: '1.25rem',
              marginBottom: '0.5rem',
              fontWeight: 'bold'
            }}>
              {userProfile.username}
            </h3>
            {userProfile.bio && (
              <p style={{
                color: '#888',
                textAlign: 'center',
                fontSize: '0.875rem',
                marginBottom: '0.5rem'
              }}>
                {userProfile.bio}
              </p>
            )}
            <p style={{ 
              color: '#666', 
              textAlign: 'center',
              fontSize: '0.75rem'
            }}>
              {account.slice(0, 6)}...{account.slice(-4)}
            </p>
          </div>
        )}

        {/* Stats */}
        <div style={{
          background: '#0a0a0a',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem'
        }}>
          <div style={{ marginBottom: '0.75rem' }}>
            <span style={{ color: '#888', fontSize: '0.875rem' }}>Total Posts</span>
            <div style={{ color: '#f59e0b', fontSize: '1.5rem', fontWeight: 'bold' }}>
              {posts.filter(p => p.author.toLowerCase() === account.toLowerCase()).length}
            </div>
          </div>
          <div>
            <span style={{ color: '#888', fontSize: '0.875rem' }}>Community Posts</span>
            <div style={{ color: '#fff', fontSize: '1.5rem', fontWeight: 'bold' }}>
              {posts.length}
            </div>
          </div>
        </div>

        {/* Info */}
        <div style={{
          background: '#0a0a0a',
          padding: '1rem',
          borderRadius: '8px',
          fontSize: '0.75rem',
          color: '#666'
        }}>
          <p style={{ marginBottom: '0.5rem' }}>
            🐝 <strong style={{ color: '#f59e0b' }}>Hyve Social</strong>
          </p>
          <p>
            Decentralized social media on your own blockchain
          </p>
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '2rem 3rem',
        maxWidth: '1000px',
        margin: '0 auto',
        width: '100%'
      }}>
        {/* Create Post Box */}
        <div style={{
          background: '#1a1a1a',
          padding: '2rem',
          borderRadius: '12px',
          border: '1px solid #333',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: userProfile?.avatar ? `url(${userProfile.avatar})` : '#f59e0b',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              color: '#000',
              fontWeight: 'bold',
              flexShrink: 0
            }}>
              {!userProfile?.avatar && userProfile?.username.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <textarea
                placeholder="What's on your mind?"
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  padding: '1rem',
                  marginBottom: '1rem',
                  background: '#0a0a0a',
                  border: '1px solid #333',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '1.125rem',
                  resize: 'vertical'
                }}
              />
              
              <button
                onClick={createPost}
                disabled={isLoading}
                style={{
                  padding: '0.75rem 2rem',
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
          </div>
        </div>

        {/* Posts Feed */}
        <div>
          {posts.length === 0 ? (
            <div style={{
              background: '#1a1a1a',
              padding: '4rem 2rem',
              borderRadius: '12px',
              border: '1px solid #333',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🐝</div>
              <p style={{ color: '#888', fontSize: '1.25rem' }}>
                No posts yet. Be the first to post!
              </p>
            </div>
          ) : (
            posts.map((post) => (
              <div
                key={post.id}
                style={{
                  background: '#1a1a1a',
                  padding: '2rem',
                  borderRadius: '12px',
                  border: '1px solid #333',
                  marginBottom: '1.5rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '50%',
                    background: profiles[post.author]?.avatar ? `url(${profiles[post.author].avatar})` : '#f59e0b',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#000',
                    fontWeight: 'bold',
                    fontSize: '1.5rem',
                    flexShrink: 0
                  }}>
                    {!profiles[post.author]?.avatar && profiles[post.author]?.username.charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '1.125rem', marginBottom: '0.25rem' }}>
                      {profiles[post.author]?.username || 'Anonymous'}
                    </div>
                    <div style={{ color: '#666', fontSize: '0.875rem' }}>
                      {new Date(post.timestamp * 1000).toLocaleString()}
                    </div>
                  </div>
                </div>
                
                <p style={{ 
                  color: '#fff', 
                  marginBottom: '1.5rem', 
                  whiteSpace: 'pre-wrap', 
                  fontSize: '1.125rem', 
                  lineHeight: '1.7'
                }}>
                  {post.content}
                </p>
                
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  <button
                    onClick={() => likePost(post.id)}
                    disabled={isLoading}
                    style={{
                      padding: '0.625rem 1.25rem',
                      background: '#333',
                      color: '#f59e0b',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      fontSize: '0.9375rem',
                      fontWeight: 'bold',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem'
                    }}
                  >
                    <span style={{ fontSize: '1.25rem' }}>❤️</span>
                    <span>{post.likes}</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
