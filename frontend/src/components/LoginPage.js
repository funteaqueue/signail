import React, { useState } from 'react';

const LoginPage = ({ onLogin }) => {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');

  const validateImageUrl = (url) => {
    const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webp'];
    return validExtensions.some(ext => url.toLowerCase().endsWith(ext));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!imageUrl.trim()) {
      setError('Please enter an image URL');
      return;
    }

    if (!validateImageUrl(imageUrl)) {
      setError('Please enter a valid image URL (jpg, jpeg, png, gif, mp4, or webp)');
      return;
    }

    const userData = {
      id: `${name.trim()}-${Date.now()}`,
      name: name.trim(),
      imageUrl: imageUrl.trim(),
      lastLogin: new Date().toISOString(),
      score: 0
    };

    localStorage.setItem('user', JSON.stringify(userData));
    onLogin(userData);
  };

  const showPreview = imageUrl && validateImageUrl(imageUrl);

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      padding: '1rem'
    }}>
      <div className="glass-panel fade-in" style={{
        padding: '2.5rem',
        width: '100%',
        maxWidth: '420px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 className="text-gradient" style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>Signail</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Enter the game arena</p>
        </div>

        {error && (
          <div style={{
            color: '#ef4444',
            padding: '0.75rem',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: '8px',
            fontSize: '0.875rem',
            textAlign: 'center'
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
              Player Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              autoFocus
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Avatar URL
              </label>
              <a 
                href="https://giphy.com" 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ color: 'var(--accent)', textDecoration: 'none', fontSize: '0.875rem' }}
              >
                Find GIF
              </a>
            </div>
            
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="Paste image or GIF URL"
            />
          </div>

          {showPreview && (
            <div style={{
              width: '100px',
              height: '100px',
              margin: '0 auto',
              borderRadius: '50%',
              border: '2px solid var(--primary)',
              padding: '2px',
              background: 'var(--bg-dark)',
              overflow: 'hidden',
              position: 'relative'
            }}>
              {imageUrl.toLowerCase().endsWith('.mp4') ? (
                <video
                  src={imageUrl}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  autoPlay loop muted playsInline
                />
              ) : (
                <img
                  src={imageUrl}
                  alt="preview"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
                  onError={e => { e.target.style.display = 'none'; }}
                />
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            Join Game
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
 