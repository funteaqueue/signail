import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { indexedDBService } from '../services/indexedDB';
import wsManager from '../utils/websocket';
import OnlineUsers from '../components/OnlineUsers';
import Settings from '../components/Settings';
import config from '../config';

// Sanitize HTML content to allow only safe tags and attributes
const sanitizeHtml = (html) => {
  const allowedTags = ['img', 'video', 'audio', 'source', 'p', 'br', 'strong', 'em', 'u', 'i', 'b'];
  const allowedAttributes = {
    img: ['src', 'alt', 'width', 'height', 'style'],
    video: ['src', 'controls', 'autoplay', 'loop', 'muted', 'width', 'height', 'style'],
    audio: ['src', 'controls', 'autoplay', 'loop', 'muted', 'style'],
    source: ['src', 'type'],
    '*': ['style', 'class']
  };

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const sanitizeNode = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const tagName = node.tagName.toLowerCase();

      if (!allowedTags.includes(tagName)) {
        return node.textContent;
      }

      const allowedAttrs = allowedAttributes[tagName] || allowedAttributes['*'] || [];
      const sanitizedAttrs = {};

      for (const attr of allowedAttrs) {
        if (node.hasAttribute(attr)) {
          sanitizedAttrs[attr] = node.getAttribute(attr);
        }
      }

      const sanitizedNode = document.createElement(tagName);
      for (const [attr, value] of Object.entries(sanitizedAttrs)) {
        sanitizedNode.setAttribute(attr, value);
      }

      for (const child of node.childNodes) {
        const sanitizedChild = sanitizeNode(child);
        if (typeof sanitizedChild === 'string') {
          sanitizedNode.appendChild(document.createTextNode(sanitizedChild));
        } else {
          sanitizedNode.appendChild(sanitizedChild);
        }
      }

      return sanitizedNode;
    }

    return '';
  };

  const sanitized = sanitizeNode(doc.body);
  return sanitized.innerHTML;
};

const QuestionPage = ({ isAdmin = false, isReadOnly = false, onlineUsers = [] }) => {
  const { questionId } = useParams();
  const navigate = useNavigate();
  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isQuestionRevealed, setIsQuestionRevealed] = useState(false);
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false);
  const [isResponseRevealed, setIsResponseRevealed] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [currentRuleIndex, setCurrentRuleIndex] = useState(0);
  const [showAfterRound, setShowAfterRound] = useState(false);
  const [currentAfterRoundIndex, setCurrentAfterRoundIndex] = useState(0);
  const [currentRoundIndex, setCurrentRoundIndex] = useState(() => {
    const savedRoundIndex = localStorage.getItem('currentRoundIndex');
    return savedRoundIndex ? parseInt(savedRoundIndex) : 0;
  });
  const [themeName, setThemeName] = useState('');
  const [timer, setTimer] = useState(15);
  const [startTime, setStartTime] = useState(null);
  const [elapsedTime, setElapsedTime] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null);
  const [hasRecordedTime, setHasRecordedTime] = useState(false);
  const [userTimes, setUserTimes] = useState({});
  const [clickedIndices, setClickedIndices] = useState(new Set());

  useEffect(() => {
    const loadQuestion = async () => {
      try {
        setLoading(true);
        setThemeName('');
        const pack = await indexedDBService.getPack('current');
        if (!pack) {
          throw new Error('Pack not found');
        }
        let foundQuestion = null;
        let foundRoundIndex = 0;
        let foundThemeName = '';

        // Search through rounds to find the question and its round index
        for (let roundIndex = 0; roundIndex < pack.rounds.length; roundIndex++) {
          const round = pack.rounds[roundIndex];
          for (const theme of round.themes) {
            const q = theme.questions.find(q => q.id === parseInt(questionId));
            if (q) {
              foundQuestion = q;
              foundRoundIndex = roundIndex;
              foundThemeName = theme.name || '';
              break;
            }
          }
          if (foundQuestion) break;
        }

        if (!foundQuestion) {
          throw new Error('Question not found');
        }

        setQuestion(foundQuestion);
        setCurrentRoundIndex(foundRoundIndex);
        setThemeName(foundThemeName);
        localStorage.setItem('currentRoundIndex', foundRoundIndex.toString());

        // Fetch existing times for this question
        try {
          const response = await fetch(`${config.apiUrl}/api/questions/${questionId}/times`);
          const result = await response.json();
          if (result.status === 'success') {
            setUserTimes(result.data);
          }
        } catch (error) {
          console.error('Error fetching question times:', error);
        }
      } catch (error) {
        console.error('Error loading question:', error);
        navigate(isAdmin ? '/admin' : '/');
      } finally {
        setLoading(false);
      }
    };
    loadQuestion();
  }, [questionId, navigate, isAdmin]);

  useEffect(() => {
    const unsubscribe = wsManager.subscribe((data) => {
      if (data.type === 'question_reveal' && data.data.questionId === parseInt(questionId)) {
        setIsQuestionRevealed(true);
      } else if (data.type === 'answer_reveal' && data.data.questionId === parseInt(questionId)) {
        setIsAnswerRevealed(true);
        setShowAfterRound(true);
        setCurrentAfterRoundIndex(0);
      } else if (data.type === 'response_reveal' && data.data.questionId === parseInt(questionId)) {
        setIsResponseRevealed(true);
        setShowAfterRound(true);
      } else if (data.type === 'return_to_game') {
        navigate(isAdmin ? '/admin' : '/');
      } else if (data.type === 'elapsed_time') {
        setUserTimes(prev => ({
          ...prev,
          [data.data.userId]: data.data.elapsedTime
        }));
      } else if (data.type === 'clear_question_times') {
        setUserTimes({});
        setElapsedTime(null);
        setHasRecordedTime(false);
        setClickedIndices(new Set());
      }
    });
    return () => {
      unsubscribe();
    };
  }, [questionId, navigate, isAdmin]);

  useEffect(() => {
    if (!question) return;

    if (showAfterRound) {
      const afterRoundRules = question.after_round || [];
      if (currentAfterRoundIndex >= afterRoundRules.length) {
        return;
      }

      const currentRule = afterRoundRules[currentAfterRoundIndex];
      const duration = currentRule.duration || 15;
      const timer = setTimeout(() => {
        setCurrentAfterRoundIndex(prev => prev + 1);
      }, duration * 1000);

      return () => clearTimeout(timer);
    } else {
      const rules = question.rules || [];
      if (currentRuleIndex >= rules.length) {
        return;
      }

      const currentRule = rules[currentRuleIndex];
      const duration = currentRule.duration || 15;
      const timer = setTimeout(() => {
        setCurrentRuleIndex(prev => prev + 1);
      }, duration * 1000);

      return () => clearTimeout(timer);
    }
  }, [question, currentRuleIndex, currentAfterRoundIndex, showAfterRound]);

  useEffect(() => {
    // Start timer immediately for user page, or when question is revealed for admin page
    if (isReadOnly || isQuestionRevealed) {
      const interval = setInterval(() => {
        setTimer((prevTimer) => {
          if (prevTimer <= 0) {
            return 0;
          }
          return prevTimer - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isQuestionRevealed, isReadOnly]);

  // Helper to calculate total duration from question rules
  const getInitialTimerValue = (question) => {
    if (!question) return 15;
    if (question.type === 'find-a-cat') {
      return question.duration || 60;
    }
    if (!question.rules || question.rules.length === 0) return 15;
    return question.rules.reduce((sum, rule) => sum + (rule.duration || 15), 0);
  };

  // Reset timer when question page is opened or question is revealed
  useEffect(() => {
    setTimer(getInitialTimerValue(question));
  }, [questionId, isQuestionRevealed, question]);

  // Get current user from localStorage
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      try {
        const userData = JSON.parse(storedUser);
        setCurrentUserId(userData.id);
      } catch (error) {
        console.error('Error parsing stored user data:', error);
      }
    }
  }, []);

  // Add keyboard event listener for space and right arrow
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (question?.type === 'find-a-cat') {
        return; // Disable spacebar/ArrowRight answer submission for find-a-cat
      }
      if ((event.code === 'Space' || event.code === 'ArrowRight') &&
        ((isAdmin && isQuestionRevealed && !isAnswerRevealed) || (!isAdmin && !isAnswerRevealed)) &&
        !hasRecordedTime &&
        !userTimes[currentUserId]) {
        const endTime = Date.now();
        const timeTaken = (endTime - startTime) / 1000; // Convert to seconds
        setElapsedTime(timeTaken);
        setHasRecordedTime(true);
        // Send elapsed time to other users
        wsManager.sendElapsedTime(parseInt(questionId), timeTaken, currentUserId);
        console.log('=== SCORE LOG ===');
        console.log(`Score: ${question?.price?.correct || 0} points`);
        console.log(`Time taken: ${timeTaken.toFixed(3)} seconds`);
        console.log('================');
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isQuestionRevealed, isAnswerRevealed, startTime, question, isAdmin, hasRecordedTime, questionId, currentUserId, userTimes]);

  // Start timer when question is revealed or when non-admin user sees the question
  useEffect(() => {
    if ((isAdmin && isQuestionRevealed && !isAnswerRevealed) || (!isAdmin && !isAnswerRevealed)) {
      console.log('Starting timer at:', new Date().toISOString());
      setStartTime(Date.now());
      setElapsedTime(null);
      setHasRecordedTime(false);
      setUserTimes({}); // Reset all user times when starting new question
      setClickedIndices(new Set()); // Reset clicked indices for new question!
    }
  }, [isQuestionRevealed, isAnswerRevealed, isAdmin]);

  // Sync clickedIndices when page is loaded/refreshed and user has already recorded time
  useEffect(() => {
    if (currentUserId && userTimes[currentUserId] !== undefined && question && question.type === 'find-a-cat' && question.map) {
      setHasRecordedTime(true);
      setClickedIndices(new Set(question.map.map((_, i) => i)));
    }
  }, [userTimes, currentUserId, question]);

  const handleShowQuestion = () => {
    if (isAdmin && question) {
      wsManager.sendQuestionReveal(question.id);
      setIsQuestionRevealed(true);
      if (question.type !== 'find-a-cat') {
        setIsAnswerRevealed(true);
        setShowAfterRound(true);
        setCurrentAfterRoundIndex(0);
      } else {
        setIsAnswerRevealed(false);
        setShowAfterRound(false);
      }
    }
  };

  const handleShowAnswer = () => {
    if (isAdmin && question) {
      wsManager.sendAnswerReveal(question.id);
      setIsAnswerRevealed(true);
      setShowAfterRound(true);
      setCurrentAfterRoundIndex(0);
    }
  };

  const handleShowAfterRound = () => {
    if (isAdmin && question) {
      wsManager.sendResponseReveal(question.id);
      setIsResponseRevealed(true);
      setShowAfterRound(true);
      setCurrentAfterRoundIndex(0);
    }
  };

  const handleReturnToGame = () => {
    if (isAdmin) {
      wsManager.sendReturnToGame();
      navigate('/admin');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{
          width: 48,
          height: 48,
          border: '4px solid var(--glass-border)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '1rem'
        }} />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <div style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '1.25rem' }}>Loading...</div>
      </div>
    );
  }
  if (!question) return null;

  const pageStyle = {
    padding: 0,
    margin: 0,
    width: '100vw',
    minHeight: '100vh',
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };
  const boardGridStyle = {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '1.5rem',
    padding: '2rem',
    borderRadius: '16px',
    margin: '0 auto',
    width: '100%',
    maxWidth: '1200px',
  };
  const cardStyle = {
    color: 'var(--text-primary)',
    fontWeight: '600',
    fontSize: '1.3rem',
    textAlign: 'center',
    borderRadius: '16px',
    margin: '0',
    padding: '2rem',
    border: '1px solid var(--glass-border)',
    userSelect: 'text',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '200px',
    background: 'var(--glass-bg)',
    backdropFilter: 'blur(10px)',
    boxShadow: 'var(--glass-shadow)',
  };
  const themeHeaderStyle = {
    color: 'var(--text-primary)',
    fontWeight: '700',
    fontSize: '1.5rem',
    textAlign: 'center',
    borderRadius: '12px',
    margin: '0',
    padding: '1rem',
    background: 'rgba(15, 23, 42, 0.6)',
    border: '1px solid var(--glass-border)',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    userSelect: 'none',
    textShadow: '0 0 20px var(--primary-glow)'
  };

  const buttonStyle = {
    padding: '0.75rem 1.5rem',
    background: 'linear-gradient(135deg, var(--primary), var(--secondary))',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: '600',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px var(--primary-glow)'
  };

  const renderRule = (rule) => {
    if (rule.type === 'embedded') {
      return (
        <div
          className="question-content"
          style={{ color: '#e0e0e0', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}
          dangerouslySetInnerHTML={{ __html: rule.content }}
        />
      );
    } else if (rule.type === 'app') {
      return (
        <div style={{ color: '#e0e0e0', fontSize: '1.1rem' }}>
          Loading app content from: {rule.path}
        </div>
      );
    }
    return null;
  };



  const handleAreaClick = (index) => {
    if (isAnswerRevealed || hasRecordedTime || (currentUserId && userTimes[currentUserId])) {
      return;
    }
    if (clickedIndices.has(index)) {
      return;
    }

    const newClicked = new Set(clickedIndices);
    newClicked.add(index);
    setClickedIndices(newClicked);

    if (isAdmin) {
      // Admin doesn't submit time
      return;
    }

    const totalAreas = question.map ? question.map.length : 0;
    const remaining = totalAreas - newClicked.size;

    if (remaining === 0) {
      const endTime = Date.now();
      const timeTaken = (endTime - startTime) / 1000;
      setElapsedTime(timeTaken);
      setHasRecordedTime(true);
      wsManager.sendElapsedTime(parseInt(questionId), timeTaken, currentUserId);
      console.log('=== SCORE LOG (Find a Cat) ===');
      console.log(`Score: ${question?.price?.correct || 0} points`);
      console.log(`Time taken: ${timeTaken.toFixed(3)} seconds`);
      console.log('================');
    }
  };

  const renderFindACatContent = () => {
    const totalAreas = question.map ? question.map.length : 0;
    const remainingCount = totalAreas - clickedIndices.size;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '1.5rem' }}>
        {/* Helper message */}
        <div className="glass-panel" style={{
          padding: '1rem 2rem',
          fontSize: '1.4rem',
          fontWeight: '700',
          color: 'var(--text-primary)',
          textAlign: 'center',
          border: '1px solid var(--glass-border)',
          width: '100%',
          maxWidth: '800px',
          boxShadow: 'var(--glass-shadow)',
          textShadow: '0 2px 4px rgba(0,0,0,0.3)'
        }}>
          {remainingCount > 0 
            ? `Знайдіть і клікніть на всіх ${question.name || ''}. Залишилось всього ${remainingCount}`
            : `Ви знайшли всіх ${question.name || ''}!`}
        </div>

        {/* Image Container with map areas */}
        <div style={{
          position: 'relative',
          display: 'inline-block',
          width: '100%',
          maxWidth: '800px',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
          border: '1px solid var(--glass-border)'
        }}>
          <img 
            src={question.image} 
            alt={question.name} 
            style={{ 
              width: '100%', 
              height: 'auto', 
              display: 'block', 
              userSelect: 'none',
              pointerEvents: 'none'
            }} 
          />
          {/* Overlay Map Areas */}
          {question.map && question.map.map((area, idx) => {
            const isClicked = clickedIndices.has(idx);
            const showArea = isAnswerRevealed || isClicked; // Show area if answer is revealed or if the user clicked it

            // Determine custom styles and colors from map area
            let backgroundColor = 'transparent';
            let border = 'none';
            let boxShadow = 'none';

            if (showArea) {
              const style = area.style || {};
              const customBg = style.background || style.backgroundColor || area.background || area.color;
              
              let bg = 'rgba(239, 68, 68, 0.1)';
              let borderStyle = '2px solid #ef4444';
              let shadowStyle = '0 0 12px rgba(239, 68, 68, 0.6)';

              if (customBg) {
                // Try to determine a solid base color to use for border/shadow if not overridden
                let solidColor = customBg;
                if (typeof customBg === 'string') {
                  const rgbaMatch = customBg.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/);
                  if (rgbaMatch) {
                    solidColor = `rgb(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]})`;
                  } else if (customBg.startsWith('#') && customBg.length === 9) {
                    solidColor = customBg.substring(0, 7);
                  }
                }

                bg = `color-mix(in srgb, ${solidColor} 10%, transparent)`;
                borderStyle = `2px solid ${solidColor}`;
                shadowStyle = `0 0 12px ${solidColor}`;
              }

              if (style.border) {
                borderStyle = style.border;
              } else if (style.borderColor) {
                borderStyle = `2px solid ${style.borderColor}`;
              } else if (area.borderColor) {
                borderStyle = `2px solid ${area.borderColor}`;
              }

              if (style.boxShadow) {
                shadowStyle = style.boxShadow;
              }

              backgroundColor = bg;
              border = borderStyle;
              boxShadow = shadowStyle;
            }

            const areaStyle = {
              position: 'absolute',
              left: area.left,
              top: area.top,
              width: area.width,
              height: area.height,
              cursor: 'default',
              backgroundColor,
              border,
              boxShadow,
              borderRadius: '8px',
              transition: 'background-color 0.2s, border 0.2s, box-shadow 0.2s',
              // Disable clicks if already clicked, answer revealed, or current user has recorded time (unless admin, who can click for demo, but only if not revealed yet)
              pointerEvents: isClicked || isAnswerRevealed || (!isAdmin && hasRecordedTime) ? 'none' : 'auto'
            };

            return (
              <div 
                key={idx} 
                style={areaStyle} 
                onClick={() => handleAreaClick(idx)}
                title={isAdmin && isAnswerRevealed ? `Area ${idx + 1}` : ''}
              />
            );
          })}
        </div>

        {/* If answer is revealed and there are after-round rules, display them below */}
        {showAfterRound && question.after_round && question.after_round.length > 0 && (
          <div style={{ ...cardStyle, width: '100%', maxWidth: '800px', minHeight: 'auto', padding: '1.5rem', marginTop: '1rem' }}>
            {question.after_round.map((rule, index) => (
              <div key={index} style={{ width: '100%' }}>
                {rule.type === 'embedded' ? (
                  <div
                    className="question-content"
                    style={{ color: '#e0e0e0', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}
                    dangerouslySetInnerHTML={{ __html: rule.content }}
                  />
                ) : (
                  renderRule(rule)
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderContent = () => {
    if (question.type === 'find-a-cat') {
      return renderFindACatContent();
    }

    if (showAfterRound) {
      const afterRoundRules = question.after_round || [];
      if (afterRoundRules.length > 0) {
        const lastRuleIndex = Math.min(currentAfterRoundIndex, afterRoundRules.length - 1);
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isAdmin && isQuestionRevealed && (
              <div style={cardStyle}>
                <div style={{ color: '#ffd600', fontSize: '1.5rem', marginBottom: '16px' }}>Question:</div>
                {question.rules.map((rule, index) => (
                  <div
                    key={index}
                    className="question-content"
                    style={{ color: '#e0e0e0', fontSize: '1.1rem', whiteSpace: 'pre-wrap', marginBottom: '8px' }}
                    dangerouslySetInnerHTML={{ __html: rule.content }}
                  />
                ))}
              </div>
            )}
            <div style={cardStyle}>
              {afterRoundRules[lastRuleIndex].type === 'embedded' ? (
                <div
                  className="question-content"
                  style={{ color: '#e0e0e0', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}
                  dangerouslySetInnerHTML={{ __html: afterRoundRules[lastRuleIndex].content }}
                />
              ) : (
                renderRule(afterRoundRules[lastRuleIndex])
              )}
            </div>
          </div>
        );
      }
    }

    const rules = question.rules || [];
    if (rules.length > 0) {
      const lastRuleIndex = Math.min(currentRuleIndex, rules.length - 1);
      return (
        <div style={cardStyle}>
          {rules[lastRuleIndex].type === 'embedded' ? (
            <div
              className="question-content"
              style={{ color: '#e0e0e0', fontSize: '1.1rem', whiteSpace: 'pre-wrap' }}
              dangerouslySetInnerHTML={{ __html: rules[lastRuleIndex].content }}
            />
          ) : (
            renderRule(rules[lastRuleIndex])
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div style={pageStyle}>
      {/* Header: Settings button and SignAil */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '2rem 0',
        position: 'relative',
        width: '100%',
        maxWidth: 1200,
      }}>
        <button
          onClick={() => setSettingsOpen(true)}
          className="glass-panel"
          style={{
            padding: '0.75rem 1.25rem',
            color: 'var(--text-secondary)',
            border: '1px solid var(--glass-border)',
            cursor: 'pointer',
            fontSize: '1rem',
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            transition: 'var(--transition-fast)'
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <span>⚙️</span> Settings
        </button>
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <h1 className="text-gradient" style={{
            fontSize: '3.5rem',
            fontWeight: '800',
            letterSpacing: '-0.02em',
            margin: 0,
            lineHeight: 1
          }}>
            SignAil
          </h1>
        </div>
      </div>
      {/* Timer centered above the question block */}
      <div style={{
        width: '100%',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <div className="glass-panel" style={{
          fontSize: '2.5rem',
          color: 'var(--text-primary)',
          fontWeight: '800',
          padding: '0.75rem 1.5rem',
          borderRadius: '24px',
          background: 'var(--glass-bg)',
          border: '2px solid var(--primary)',
          boxShadow: '0 0 30px var(--primary-glow), var(--glass-shadow)',
          fontVariantNumeric: 'tabular-nums'
        }}>
          {timer}
        </div>
      </div>
      {/* Main board: rules grid */}
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto 20px auto'
      }}>
        <div style={boardGridStyle}>
          {themeName && (
            <div style={themeHeaderStyle}>{themeName}</div>
          )}
          {renderContent()}
        </div>
      </div>
      {/* Action buttons (Show Question/Show Answer/Show Response/Back to Game) */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {isAdmin && !isQuestionRevealed && (
          <button
            onClick={handleShowQuestion}
            className="btn-primary"
            style={buttonStyle}
          >
            Show Question
          </button>
        )}
        {isAdmin && isQuestionRevealed && !isAnswerRevealed && (
          <button
            onClick={handleShowAnswer}
            className="btn-primary"
            style={buttonStyle}
          >
            Show Answer
          </button>
        )}
        {isAdmin && isAnswerRevealed && !isResponseRevealed && question.after_round && question.after_round.length > 0 && (
          <button
            onClick={handleShowAfterRound}
            className="btn-primary"
            style={buttonStyle}
          >
            Show Response
          </button>
        )}
        {isAdmin && (
          <button
            onClick={handleReturnToGame}
            className="btn-primary"
            style={{
              ...buttonStyle,
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              boxShadow: '0 4px 12px rgba(239, 68, 68, 0.4)'
            }}
          >
            Back to Game
          </button>
        )}
      </div>
      {/* Online users below the board */}
      <div style={{ width: '100%', maxWidth: 1200, margin: 0, padding: 0, lineHeight: 1 }}>
        <OnlineUsers
          users={onlineUsers}
          elapsedTime={elapsedTime}
          currentUserId={currentUserId}
          userTimes={userTimes}
          isAdmin={isAdmin}
          question={question}
        />
      </div>
      {settingsOpen && <Settings onClose={() => setSettingsOpen(false)} isAdmin={isAdmin} />}
    </div>
  );
};

export default QuestionPage; 
