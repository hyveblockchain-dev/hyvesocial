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
  const [showProfilePictureModal, setShowProfilePictureModal] = useState(false)
  const [newProfilePicture, setNewProfilePicture] = useState('')
  const [newImagePreview, setNewImagePreview] = useState('')
  const [newSelectedFile, setNewSelectedFile] = useState(null)

  useEffect(() => {
    if (account && signer) {
      loadUserProfile()
      loadPosts()
    }
  }, [account, signer])

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }
      
      compressAndConvertImage(file, (base64String) => {
        setSelectedFile(file)
        setImagePreview(base64String)
        setProfilePicture(base64String)
      })
    }
  }

  const handleNewFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file')
        return
      }
      
      compressAndConvertImage(file, (base64String) => {
        setNewSelectedFile(file)
        setNewImagePreview(base64String)
        setNewProfilePicture(base64String)
      })
    }
  }

  const compressAndConvertImage = (file, callback) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        // Create canvas to resize image
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        // Resize to max 400x400 (good for profile pics)
        let width = img.width
        let height = img.height
        const maxSize = 400
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }
        
        canvas.width = width
        canvas.height = height
        
        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height)
        
        // Convert to base64 with compression (0.7 quality for JPEG)
        const base64String = canvas.toDataURL('image/jpeg', 0.7)
        
        // Check final size
        const sizeInKB = Math.round((base64String.length * 3) / 4 / 1024)
        console.log(`Compressed image size: ${sizeInKB}KB`)
        
        if (sizeInKB > 200) {
          alert(`Warning: Image is ${sizeInKB}KB. This will cost more gas. Consider using a smaller image.`)
        }
        
        callback(base64String)
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  }

  const updateProfilePicture = async () => {
    if (!newProfilePicture) {
      alert('Please select a new image')
      return
    }

    setIsLoading(true)
    try {
      setUploadProgress('Updating profile picture on blockchain...')
      
      // Calculate appropriate gas limit based on image size
      const estimatedGas = 3000000 + Math.floor(newProfilePicture.length / 10)
      
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const tx = await contract.createProfile(
        userProfile.username,
        userProfile.bio,
        newProfilePicture.trim(),
        { gasLimit: estimatedGas }
      )
      
      setUploadProgress('Waiting for confirmation...')
      await tx.wait()
      
      setShowProfilePictureModal(false)
      setNewProfilePicture('')
      setNewImagePreview('')
      setNewSelectedFile(null)
      setUploadProgress('')
      await loadUserProfile()
      alert('Profile picture updated successfully!')
    } catch (error) {
      console.error('Error updating profile picture:', error)
      setUploadProgress('')
      if (error.message.includes('gas')) {
        alert('Gas error: The image is too large. Please try a smaller image (under 100KB recommended).')
      } else {
        alert('Failed to update profile picture: ' + error.message)
      }
    }
    setIsLoading(false)
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
      
      // Calculate gas limit based on image size
      const estimatedGas = 3000000 + Math.floor(profilePicture.length / 10)
      
      const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
      const tx = await contract.createProfile(
        username.trim(), 
        (bio || '').trim(), 
        profilePicture.trim(),
        { gasLimit: estimatedGas }
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
      if (error.message.includes('gas')) {
        alert('Gas error: The image is too large. Please try a smaller image (under 100KB recommended).')
      } else {
        alert('Failed to create profile: ' + error.message)
      }
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
              Images auto-compressed to 400x400 • Recommended: simple images
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
            <div 
              onClick={() => setShowProfilePictureModal(true)}
              style={{
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
                border: '3px solid #f59e0b',
                cursor: 'pointer',
                position: 'relative',
                transition: 'transform 0.2s, border-color 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'scale(1.05)'
                e.currentTarget.style.borderColor = '#fbbf24'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'scale(1)'
                e.currentTarget.style.borderColor = '#f59e0b'
              }}
            >
              {!userProfile.avatar && userProfile.username.charAt(0).toUpperCase()}
              <div style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                background: '#f59e0b',
                borderRadius: '50%',
                width: '30px',
                height: '30px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                border: '2px solid #1a1a1a'
              }}>
                ✏️
              </div>
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

      {/* Profile Picture Modal */}
      {showProfilePictureModal && (
        <div 
          onClick={() => setShowProfilePictureModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#1a1a1a',
              padding: '2rem',
              borderRadius: '12px',
              border: '1px solid #333',
              maxWidth: '500px',
              width: '90%',
              maxHeight: '90vh',
              overflowY: 'auto'
            }}
          >
            <h2 style={{ color: '#f59e0b', marginBottom: '1.5rem', textAlign: 'center' }}>
              Profile Picture
            </h2>

            {/* Current Picture Large View */}
            <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
              <div style={{
                width: '200px',
                height: '200px',
                borderRadius: '50%',
                background: userProfile?.avatar ? `url(${userProfile.avatar})` : '#f59e0b',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                margin: '0 auto',
                border: '3px solid #f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '4rem',
                color: '#000',
                fontWeight: 'bold'
              }}>
                {!userProfile?.avatar && userProfile?.username.charAt(0).toUpperCase()}
              </div>
            </div>

            <div style={{ borderTop: '1px solid #333', paddingTop: '1.5rem', marginBottom: '1.5rem' }}>
              <h3 style={{ color: '#fff', marginBottom: '1rem', fontSize: '1.125rem' }}>
                Change Profile Picture
              </h3>

              {/* New Image Preview */}
              {newImagePreview && (
                <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                  <div style={{
                    width: '150px',
                    height: '150px',
                    borderRadius: '50%',
                    background: `url(${newImagePreview})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    margin: '0 auto',
                    border: '3px solid #f59e0b'
                  }} />
                  <p style={{ color: '#888', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                    New picture preview
                  </p>
                </div>
              )}

              <label style={{
                display: 'block',
                padding: '0.75rem',
                background: '#333',
                color: '#f59e0b',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: '1rem'
              }}>
                {newSelectedFile ? 'Choose Different Photo' : 'Select New Photo'}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleNewFileSelect}
                  style={{ display: 'none' }}
                />
              </label>

              {uploadProgress && (
                <div style={{
                  padding: '0.75rem',
                  background: '#0a0a0a',
                  border: '1px solid #f59e0b',
                  borderRadius: '8px',
                  color: '#f59e0b',
                  textAlign: 'center',
                  marginBottom: '1rem',
                  fontSize: '0.875rem'
                }}>
                  {uploadProgress}
                </div>
              )}

              <button
                onClick={updateProfilePicture}
                disabled={isLoading || !newProfilePicture}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  background: newProfilePicture ? '#f59e0b' : '#333',
                  color: newProfilePicture ? '#000' : '#666',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  cursor: isLoading || !newProfilePicture ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.5 : 1,
                  marginBottom: '0.5rem'
                }}
              >
                {isLoading ? 'Updating...' : 'Update Profile Picture'}
              </button>

              <p style={{ color: '#666', fontSize: '0.75rem', textAlign: 'center' }}>
                Images auto-compressed to 400x400 • Recommended: simple images
              </p>
            </div>

            <button
              onClick={() => {
                setShowProfilePictureModal(false)
                setNewProfilePicture('')
                setNewImagePreview('')
                setNewSelectedFile(null)
              }}
              style={{
                width: '100%',
                padding: '0.75rem',
                background: '#333',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '1rem',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
