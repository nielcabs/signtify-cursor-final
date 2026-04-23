import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';
import { canCompleteLesson, getUserProfile } from '../auth/firestoreUtils';
import { useToast } from './ui/Toast';
import NotificationBell from './ui/NotificationBell';
import './Navbar.css';

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, isAdmin, isTeacher, logout } = useAuth();
  const toast = useToast();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState(null);
  const [alphabetFinished, setAlphabetFinished] = useState(false);
  const [greetingsFinished, setGreetingsFinished] = useState(false);
  const [dailyConversationFinished, setDailyConversationFinished] = useState(false);
  const [hasCompletedFirstLesson, setHasCompletedFirstLesson] = useState(false);
  const userMenuRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  const handleLockedClick = (message, redirectPath = '/lessons/alphabet') => {
    closeMobileMenu();
    toast.warning(message);
    navigate(redirectPath);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out:', error);
    }
  };

  const toggleDropdown = (dropdownName) => {
    setActiveDropdown(activeDropdown === dropdownName ? null : dropdownName);
  };

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  };

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [userMenuOpen]);

  // Close user menu when pressing ESC key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setUserMenuOpen(false);
      }
    };

    if (userMenuOpen) {
      document.addEventListener('keydown', handleEscKey);
    }

    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [userMenuOpen]);

  // Don't show nav menu on login/register pages
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  useEffect(() => {
    const check = async () => {
      if (!currentUser) {
        setAlphabetFinished(false);
        setGreetingsFinished(false);
        setDailyConversationFinished(false);
        setHasCompletedFirstLesson(false);
        return;
      }
      const [alphabetDone, greetingsDone, dailyConvDone, profile] = await Promise.all([
        canCompleteLesson(currentUser.uid, 'alphabet', 26),
        canCompleteLesson(currentUser.uid, 'greetings', 12),
        canCompleteLesson(currentUser.uid, 'numbers', 10),
        getUserProfile(currentUser.uid)
      ]);
      setAlphabetFinished(alphabetDone);
      setGreetingsFinished(greetingsDone);
      setDailyConversationFinished(dailyConvDone);
      const completed = profile?.progress?.lessonsCompleted || [];
      setHasCompletedFirstLesson(completed.length > 0);
    };
    check();
    // Refresh when page becomes visible (user might have completed a lesson in another tab/window)
    const handleVisibilityChange = () => {
      if (!document.hidden && currentUser) {
        check();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Also refresh periodically (every 5 seconds) when page is visible
    const interval = setInterval(() => {
      if (!document.hidden && currentUser) {
        check();
      }
    }, 5000);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(interval);
    };
  }, [currentUser, location.pathname]);

  return (
    <>
    <nav className="navbar">
      <div className="nav-container">
        <Link to="/" className="nav-logo">
          {/* <span className="logo-icon">✋</span> */}
          Signtify
        </Link>
        
        <button 
          className="mobile-menu-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          ☰
        </button>

        {currentUser && !isAuthPage && (
          <ul className={`nav-menu ${mobileMenuOpen ? 'active' : ''}`}>
          <li className={`nav-item dropdown ${activeDropdown === 'lessons' ? 'active' : ''}`}>
            <button 
              className="nav-link dropdown-toggle" 
              onClick={() => toggleDropdown('lessons')}
            >
              Lessons
              <span className="dropdown-arrow">▼</span>
            </button>
            <ul className="dropdown-menu">
              <li>
                <Link 
                  to="/lessons/alphabet" 
                  className={isActive('/lessons/alphabet') ? 'active' : ''}
                  onClick={closeMobileMenu}
                >
                  Alphabet
                </Link>
              </li>
              <li>
                {alphabetFinished ? (
                  <Link 
                    to="/lessons/greetings" 
                    className={isActive('/lessons/greetings') ? 'active' : ''}
                    onClick={closeMobileMenu}
                  >
                    Greetings
                  </Link>
                ) : (
                  <span
                    className="nav-link nav-dropdown-locked"
                    title="Finish Alphabet (view A–Z) to unlock Greetings"
                    onClick={() => handleLockedClick('Complete the Alphabet lesson first (view all letters A–Z) to unlock Greetings.')}
                  >
                    Greetings 🔒
                  </span>
                )}
              </li>
              <li>
                {greetingsFinished ? (
                  <Link
                    to="/lessons/numbers"
                    className={isActive('/lessons/numbers') ? 'active' : ''}
                    onClick={closeMobileMenu}
                  >
                    Numbers
                  </Link>
                ) : (
                  <span
                    className="nav-link nav-dropdown-locked"
                    title="Finish Greetings to unlock Numbers"
                    onClick={() => handleLockedClick('Complete the Greetings lesson first to unlock Numbers (1–10).', '/lessons/greetings')}
                  >
                    Numbers 🔒
                  </span>
                )}
              </li>
              <li>
                {dailyConversationFinished ? (
                  <Link
                    to="/lessons/daily-conversation"
                    className={isActive('/lessons/daily-conversation') ? 'active' : ''}
                    onClick={closeMobileMenu}
                  >
                    Daily Conversation
                  </Link>
                ) : (
                  <span
                    className="nav-link nav-dropdown-locked"
                    title="Finish Numbers to unlock Daily Conversation"
                    onClick={() => handleLockedClick('Complete the Numbers lesson first to unlock Daily Conversation Signs.', '/lessons/numbers')}
                  >
                    Daily Conversation 🔒
                  </span>
                )}
              </li>
            </ul>
          </li>
          
          <li className="nav-item">
            {hasCompletedFirstLesson ? (
              <Link 
                to="/quizzes" 
                className={`nav-link ${isActive('/quizzes') ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                Mini Quizzes
              </Link>
            ) : (
              <span
                className="nav-link nav-link-locked"
                title="Complete your first lesson to unlock Mini Quizzes"
                onClick={() => handleLockedClick('Complete your first lesson (Alphabet) to unlock Mini Quizzes.')}
              >
                Mini Quizzes 🔒
              </span>
            )}
          </li>
          
          <li className="nav-item">
            {hasCompletedFirstLesson ? (
              <Link 
                to="/proficiency-exams" 
                className={`nav-link ${isActive('/proficiency-exams') ? 'active' : ''}`}
                onClick={closeMobileMenu}
              >
                Proficiency Exam
              </Link>
            ) : (
              <span
                className="nav-link nav-link-locked"
                title="Complete your first lesson to unlock Proficiency Exam"
                onClick={() => handleLockedClick('Complete your first lesson (Alphabet) to unlock Proficiency Exam.')}
              >
                Proficiency Exam 🔒
              </span>
            )}
          </li>
          
          <li className="nav-item">
            <Link 
              to="/dictionary" 
              className={`nav-link ${isActive('/dictionary') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Dictionary
            </Link>
          </li>
          
          {/* Temporarily removed Practice Gestures */}
          {/* <li className="nav-item">
            <Link 
              to="/practice" 
              className={`nav-link ${isActive('/practice') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Practice Gestures
            </Link>
          </li> */}
          
          <li className="nav-item">
            <Link 
              to="/live-translate" 
              className={`nav-link ${isActive('/live-translate') ? 'active' : ''}`}
              onClick={closeMobileMenu}
            >
              Live Translate
            </Link>
          </li>

          <li className="nav-item nav-item-bell">
            <NotificationBell />
          </li>

          <li className="nav-item user-menu-item" ref={userMenuRef}>
            <button 
              className="user-menu-button"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
            >
              <span className="user-avatar">
                {currentUser?.displayName?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase()}
              </span>
              <span className="user-name">{currentUser?.displayName || 'User'}</span>
            </button>
            {userMenuOpen && (
              <div className="user-dropdown">
                <div className="user-info">
                  <p className="user-display-name">{currentUser?.displayName || 'User'}</p>
                  <p className="user-email">{currentUser?.email}</p>
                </div>
                {isAdmin && (
                  <Link to="/admin" className="profile-link" onClick={closeMobileMenu}>
                    <button className="profile-button admin-button">
                      🛠️ Admin Dashboard
                    </button>
                  </Link>
                )}
                {(isTeacher || isAdmin) && (
                  <Link to="/teacher" className="profile-link" onClick={closeMobileMenu}>
                    <button className="profile-button admin-button">
                      👩‍🏫 Teacher Dashboard
                    </button>
                  </Link>
                )}
                <Link to="/profile" className="profile-link" onClick={closeMobileMenu}>
                  <button className="profile-button">
                    View Profile
                  </button>
                </Link>
                <button onClick={handleLogout} className="logout-button">
                  Logout
                </button>
              </div>
            )}
          </li>
        </ul>
        )}
      </div>
    </nav>
    </>
  );
}

export default Navbar;
