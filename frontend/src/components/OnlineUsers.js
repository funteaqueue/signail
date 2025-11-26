import React, { useState, useEffect } from 'react';
import wsManager from '../utils/websocket';
import { useLocation } from 'react-router-dom';

const OnlineUsers = ({ users, elapsedTime, currentUserId, userTimes = {}, isAdmin = false, question }) => {
  const location = useLocation();
  const isQuestionPage = location.pathname.includes('/question/');

  const [updatedUsers, setUpdatedUsers] = useState(new Set());
  const [penalizedUsers, setPenalizedUsers] = useState(new Set());
  const [greenFrameUsers, setGreenFrameUsers] = useState(new Set());

  useEffect(() => {
    const storedGreenFramedUsers = JSON.parse(localStorage.getItem('greenFramedUsers') || '[]');
    if (!isQuestionPage) {
      setGreenFrameUsers(new Set(storedGreenFramedUsers));
    }
  }, [isQuestionPage]);

  useEffect(() => {
    const unsubscribe = wsManager.subscribe((data) => {
      if (data.type === 'admin_clicked_red_number') {
        setPenalizedUsers(prev => new Set([...prev, data.data.userId]));
      } else if (data.type === 'admin_clicked_green_number') {
        setGreenFrameUsers(prev => {
          const newSet = new Set([data.data.userId]);
          localStorage.setItem('greenFramedUsers', JSON.stringify([data.data.userId]));
          return newSet;
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const sortedUsers = [...users].sort((a, b) => {
    const timeA = userTimes[a.id] ?? (a.id === currentUserId ? elapsedTime : null);
    const timeB = userTimes[b.id] ?? (b.id === currentUserId ? elapsedTime : null);

    if (timeA === null && timeB === null) return 0;
    if (timeA === null) return 1;
    if (timeB === null) return -1;

    return timeA - timeB;
  });

  const topThreeTimes = sortedUsers
    .filter(user => (userTimes[user.id] !== undefined || (user.id === currentUserId && elapsedTime !== null)) && !penalizedUsers.has(user.id))
    .slice(0, 3)
    .map(user => user.id);

  const correctValue = question?.price?.correct ?? 0;
  const incorrectValue = question?.price?.incorrect ?? 0;

  const handleScoreClick = (userId, currentScore, value) => {
    if (!isAdmin) return;

    const newScore = currentScore + value;
    wsManager.ws.send(JSON.stringify({
      type: 'update_score',
      data: {
        userId,
        score: newScore
      }
    }));

    if (value > 0) {
      setUpdatedUsers(prev => new Set([...prev, userId]));
      wsManager.ws.send(JSON.stringify({
        type: 'admin_clicked_green_number',
        data: { userId }
      }));
    } else {
      setPenalizedUsers(prev => new Set([...prev, userId]));
      wsManager.ws.send(JSON.stringify({
        type: 'admin_clicked_red_number',
        data: { userId }
      }));
    }
  };

  return (
    <div style={{
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      gap: '2rem',
      flexWrap: 'wrap',
      minHeight: '250px',
      alignItems: 'flex-start',
      padding: '1rem'
    }}>
      {users.map(user => {
        const userTime = userTimes[user.id] ?? (user.id === currentUserId ? elapsedTime : null);
        const isTopThree = topThreeTimes.includes(user.id);
        const position = topThreeTimes.indexOf(user.id);
        const numericScore = Number(user.score ?? 0);
        const previousScore = Number.isFinite(numericScore) ? numericScore : 0;
        const isUpdated = updatedUsers.has(user.id);
        const isPenalized = penalizedUsers.has(user.id);
        const hasGreenFrame = greenFrameUsers.has(user.id);

        const getFrameStyle = () => {
          if (hasGreenFrame) {
            return {
              border: '3px solid #4ade80',
              boxShadow: '0 0 20px rgba(74, 222, 128, 0.6)'
            };
          }

          if (isPenalized) {
            return {
              border: '3px solid #ef4444',
              boxShadow: '0 0 20px rgba(239, 68, 68, 0.6)'
            };
          }

          if (!isTopThree) {
            if (userTime === null) {
              return {
                border: '3px solid rgba(255, 255, 255, 0.1)',
                boxShadow: 'none'
              };
            }
            return {
              border: '3px solid var(--text-muted)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
            };
          }

          switch (position) {
            case 0: // Gold
              return {
                border: '3px solid #fbbf24',
                boxShadow: '0 0 25px rgba(251, 191, 36, 0.6)'
              };
            case 1: // Silver
              return {
                border: '3px solid #e2e8f0',
                boxShadow: '0 0 20px rgba(226, 232, 240, 0.5)'
              };
            case 2: // Bronze
              return {
                border: '3px solid #d97706',
                boxShadow: '0 0 20px rgba(217, 119, 6, 0.5)'
              };
            default:
              return {
                border: '3px solid rgba(255, 255, 255, 0.1)',
                boxShadow: 'none'
              };
          }
        };

        return (
          <div
            key={user.id || user.name}
            className="fade-in"
            style={{
              width: '140px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
            }}
          >
            {userTime !== null && (
              <div style={{
                position: 'absolute',
                top: -20,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--primary)',
                color: '#fff',
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '1rem',
                fontWeight: 'bold',
                zIndex: 10,
                boxShadow: '0 4px 12px var(--primary-glow)'
              }}>
                {typeof userTime === 'number' ? userTime.toFixed(3) : userTime}s
              </div>
            )}

            <div style={{
              width: '110px',
              height: '110px',
              borderRadius: '24px',
              overflow: 'hidden',
              marginBottom: '1rem',
              background: 'var(--bg-dark)',
              transition: 'all 0.3s ease',
              ...getFrameStyle()
            }}>
              {user.imageUrl.toLowerCase().endsWith('.mp4') ? (
                <video
                  src={user.imageUrl}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  autoPlay loop muted playsInline
                />
              ) : (
                <img
                  src={user.imageUrl}
                  alt={user.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (location.pathname.startsWith('/admin')) {
                      wsManager.ws.send(JSON.stringify({
                        type: 'admin_clicked_green_number',
                        data: { userId: user.id }
                      }));
                    }
                  }}
                />
              )}
            </div>

            <span style={{
              fontWeight: '600',
              fontSize: '1.25rem',
              color: 'var(--text-primary)',
              marginBottom: '0.5rem',
              textAlign: 'center',
              wordBreak: 'break-word',
              textShadow: '0 2px 4px rgba(0,0,0,0.3)'
            }}>
              {user.name}
            </span>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span
                contentEditable={location.pathname.startsWith('/admin')}
                suppressContentEditableWarning={true}
                onBlur={(e) => {
                  const newScore = e.target.textContent.trim();
                  const parsedScore = Number(newScore);
                  if (newScore !== '' && Number.isFinite(parsedScore)) {
                    wsManager.ws.send(JSON.stringify({
                      type: 'update_score',
                      data: { userId: user.id, score: parsedScore }
                    }));
                    e.target.textContent = parsedScore;
                  } else {
                    e.target.textContent = previousScore;
                  }
                }}
                style={{
                  fontWeight: '700',
                  fontSize: '1.5rem',
                  color: 'var(--accent)',
                  textAlign: 'center',
                  textShadow: '0 0 10px var(--accent-glow)'
                }}
              >
                {previousScore}
              </span>

              {isAdmin && position === 0 && !isUpdated && !isPenalized && (
                <div className="glass-panel" style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  padding: '4px 8px',
                  marginTop: '4px',
                  borderRadius: '8px'
                }}>
                  <span
                    onClick={() => handleScoreClick(user.id, previousScore, incorrectValue)}
                    style={{
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      color: '#ef4444',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => e.target.style.opacity = '0.8'}
                    onMouseLeave={e => e.target.style.opacity = '1'}
                  >
                    {incorrectValue}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }}>/</span>
                  <span
                    onClick={() => handleScoreClick(user.id, previousScore, correctValue)}
                    style={{
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      color: '#4ade80',
                      cursor: 'pointer',
                      transition: 'opacity 0.2s'
                    }}
                    onMouseEnter={e => e.target.style.opacity = '0.8'}
                    onMouseLeave={e => e.target.style.opacity = '1'}
                  >
                    {correctValue}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default OnlineUsers;
