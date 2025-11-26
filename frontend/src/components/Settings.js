import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { indexedDBService } from '../services/indexedDB';
import wsManager from '../utils/websocket';

const Settings = ({ onClose, isAdmin = false }) => {
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isClearingPack, setIsClearingPack] = useState(false);
  const [message, setMessage] = useState('');

  const handleClearCache = async () => {
    try {
      setIsClearingCache(true);
      setMessage('');
      wsManager.sendClearCache();
      setMessage('Cache cleared successfully!');
    } catch (error) {
      setMessage('Error clearing cache: ' + error.message);
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleClearPack = async () => {
    try {
      setIsClearingPack(true);
      setMessage('');
      await indexedDBService.deletePack('current');
      setMessage('Pack cleared successfully!');
    } catch (error) {
      setMessage('Error clearing pack: ' + error.message);
    } finally {
      setIsClearingPack(false);
    }
  };

  const modalContent = (
    <div className="fade-in" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(5px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999 // Ensure it's on top of everything
    }} onClick={onClose}>
      <div
        className="glass-panel"
        style={{
          padding: '2rem',
          borderRadius: '16px',
          minWidth: '320px',
          maxWidth: '500px',
          width: '90%',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-gradient" style={{
          marginTop: 0,
          marginBottom: '1.5rem',
          fontSize: '2rem',
          textAlign: 'center'
        }}>Settings</h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {isAdmin && (
            <button
              onClick={handleClearCache}
              disabled={isClearingCache}
              className="btn-primary"
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 0 15px rgba(239, 68, 68, 0.4)',
                width: '100%'
              }}
            >
              {isClearingCache ? 'Clearing...' : 'Clear Cache'}
            </button>
          )}

          <button
            onClick={handleClearPack}
            disabled={isClearingPack}
            className="btn-primary"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              boxShadow: '0 0 15px rgba(245, 158, 11, 0.4)',
              width: '100%'
            }}
          >
            {isClearingPack ? 'Clearing...' : 'Clear Pack'}
          </button>

          {message && (
            <div style={{
              padding: '0.75rem',
              borderRadius: '8px',
              background: message.includes('Error') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              border: `1px solid ${message.includes('Error') ? '#ef4444' : '#22c55e'}`,
              color: message.includes('Error') ? '#ef4444' : '#22c55e',
              textAlign: 'center',
              fontSize: '0.9rem'
            }}>
              {message}
            </div>
          )}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: '2rem',
            width: '100%',
            padding: '0.75rem',
            background: 'rgba(255, 255, 255, 0.1)',
            color: 'var(--text-primary)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '1rem',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => {
            e.target.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={e => {
            e.target.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
        >
          Close
        </button>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modalContent, document.body);
};

export default Settings;
