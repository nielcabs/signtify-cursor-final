import { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getUserProfile, updateUserProfile, ACHIEVEMENTS } from '../auth/firestoreUtils';
import { useToast } from '../components/ui/Toast';
import '../styles/pages/Profile.css';

function Profile() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    nickname: '',
    bio: ''
  });

  useEffect(() => {
    loadProfile();
  }, [currentUser]);

  const loadProfile = async () => {
    if (currentUser) {
      try {
        const userProfile = await getUserProfile(currentUser.uid);
        if (userProfile) {
          setProfile(userProfile);
          setFormData({
            displayName: userProfile.displayName || '',
            nickname: userProfile.nickname || '',
            bio: userProfile.bio || ''
          });
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateUserProfile(currentUser.uid, formData);
      await loadProfile();
      setEditing(false);
      toast.success('Profile saved');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(error?.message || 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setFormData({
      displayName: profile.displayName || '',
      nickname: profile.nickname || '',
      bio: profile.bio || ''
    });
    setEditing(false);
  };

  const getLevel = (points) => {
    return Math.floor(points / 500) + 1;
  };

  const getProgressToNextLevel = (points) => {
    const currentLevelPoints = (getLevel(points) - 1) * 500;
    const nextLevelPoints = getLevel(points) * 500;
    const progressPoints = points - currentLevelPoints;
    return (progressPoints / 500) * 100;
  };

  if (loading) {
    return (
      <div className="profile-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="profile-page">
        <div className="error-container card">
          <h2>Profile Not Found</h2>
          <p>Unable to load your profile data. Please try again later.</p>
        </div>
      </div>
    );
  }

  const totalPoints = profile.progress?.totalPoints || 0;
  const level = getLevel(totalPoints);
  const progressToNext = getProgressToNextLevel(totalPoints);
  
  // Count only unique exams that have been passed (80% or higher)
  // This ensures retakes don't increment the count
  const examsPassed = profile.progress?.examsPassed || [];
  const uniquePassedExams = new Set();
  examsPassed.forEach(exam => {
    // Only count exams that passed (80% or higher) and have a valid examId
    if (exam && exam.passed === true && exam.percentage >= 80 && exam.examId) {
      // Normalize examId to handle any case sensitivity or whitespace issues
      const normalizedExamId = String(exam.examId).trim().toLowerCase();
      uniquePassedExams.add(normalizedExamId);
    }
  });
  const examsPassedCount = uniquePassedExams.size;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>My Profile</h1>
      </div>

      {/* Profile Info Section */}
      <div className="profile-section card">
        <div className="profile-card-header">
          <h2>Profile Information</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="secondary">
              Edit Profile
            </button>
          )}
        </div>

        <div className="profile-info">
          <div className="avatar-section">
            <div className="profile-avatar">
              {formData.displayName?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase()}
            </div>
            <div className="level-badge">
              Level {level}
            </div>
          </div>

          <div className="profile-details">
            {editing ? (
              <div className="edit-form">
                <div className="form-group">
                  <label htmlFor="displayName">Display Name</label>
                  <input
                    type="text"
                    id="displayName"
                    name="displayName"
                    value={formData.displayName}
                    onChange={handleInputChange}
                    placeholder="Enter your display name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="nickname">Nickname</label>
                  <input
                    type="text"
                    id="nickname"
                    name="nickname"
                    value={formData.nickname}
                    onChange={handleInputChange}
                    placeholder="Enter a nickname"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="bio">Bio</label>
                  <textarea
                    id="bio"
                    name="bio"
                    value={formData.bio}
                    onChange={handleInputChange}
                    placeholder="Tell us about yourself..."
                    rows="4"
                  />
                </div>

                <div className="form-actions">
                  <button onClick={handleSaveProfile} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button onClick={handleCancelEdit} className="secondary" disabled={saving}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="view-details">
                <div className="detail-item">
                  <span className="detail-label">Display Name:</span>
                  <span className="detail-value">{profile.displayName || 'Not set'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Nickname:</span>
                  <span className="detail-value">{profile.nickname || 'Not set'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Email:</span>
                  <span className="detail-value">{profile.email}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">Bio:</span>
                  <span className="detail-value">{profile.bio || 'No bio yet'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Level & Points Section */}
      <div className="stats-grid">
        <div className="stat-card card">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <h3>{totalPoints}</h3>
            <p>Total Points</p>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <h3>Level {level}</h3>
            <p>Current Level</p>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <h3>{profile.achievements?.length || 0}</h3>
            <p>Achievements</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="level-progress card">
        <div className="progress-header">
          <span>Progress to Level {level + 1}</span>
          <span>{Math.round(progressToNext)}%</span>
        </div>
        <div className="progress-bar-container">
          <div className="progress-bar-fill" style={{ width: `${progressToNext}%` }}></div>
        </div>
        <p className="progress-text">
          {500 - (totalPoints % 500)} points until next level
        </p>
      </div>

      {/* Learning Progress Section */}
      <div className="profile-section card">
        <h2>Learning Progress</h2>
        
        <div className="progress-stats">
          <div className="progress-stat-item">
            <div className="stat-header">
              <span className="stat-emoji">📚</span>
              <h3>Lessons Completed</h3>
            </div>
            <p className="stat-number">{profile.progress?.lessonsCompleted?.length || 0}</p>
          </div>

          <div className="progress-stat-item">
            <div className="stat-header">
              <span className="stat-emoji">📝</span>
              <h3>Quizzes Taken</h3>
            </div>
            <p className="stat-number">{profile.stats?.totalQuizzes || 0}</p>
            <p className="stat-detail">Avg Score: {profile.stats?.averageQuizScore || 0}%</p>
          </div>

          <div className="progress-stat-item">
            <div className="stat-header">
              <span className="stat-emoji">🎓</span>
              <h3>Exams Passed</h3>
            </div>
            <p className="stat-number">{examsPassedCount}</p>
            <p className="stat-detail">Avg Score: {profile.stats?.averageExamScore || 0}%</p>
          </div>

          <div className="progress-stat-item">
            <div className="stat-header">
              <span className="stat-emoji">⭐</span>
              <h3>Perfect Scores</h3>
            </div>
            <p className="stat-number">{profile.stats?.perfectScores || 0}</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="profile-section card">
        <h2>Recent Activity</h2>
        
        {profile.progress?.quizzesCompleted?.length > 0 || profile.progress?.examsPassed?.length > 0 ? (
          <div className="activity-list">
            {[
              ...(profile.progress?.quizzesCompleted || []).map(q => ({ ...q, type: 'quiz' })),
              ...(profile.progress?.examsPassed || []).map(e => ({ ...e, type: 'exam' }))
            ]
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 10)
              .map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    {activity.type === 'quiz' ? '📝' : '🎓'}
                  </div>
                  <div className="activity-content">
                    <h4>
                      {activity.type === 'quiz' ? 'Quiz' : 'Exam'}: {activity.quizId || activity.examId}
                    </h4>
                    <p>Score: {activity.percentage}% ({activity.score}/{activity.totalQuestions})</p>
                    <span className="activity-date">
                      {new Date(activity.completedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className={`activity-badge ${activity.percentage >= 80 ? 'pass' : 'fail'}`}>
                    {activity.percentage >= 80 ? '✓' : '✗'}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <p className="no-activity">No recent activity. Start learning to track your progress!</p>
        )}
      </div>

      {/* Achievements Section */}
      <div className="profile-section card">
        <h2>Achievements</h2>
        
        <div className="achievements-grid">
          {Object.values(ACHIEVEMENTS).map(achievement => {
            const unlocked = profile.achievements?.find(a => a.id === achievement.id);
            return (
              <div key={achievement.id} className={`achievement-card ${unlocked ? 'unlocked' : 'locked'}`}>
                <div className="achievement-icon">{achievement.icon}</div>
                <h3>{achievement.title}</h3>
                <p>{achievement.description}</p>
                <div className="achievement-points">
                  {achievement.points} points
                </div>
                {unlocked && (
                  <div className="unlocked-date">
                    Unlocked: {new Date(unlocked.unlockedAt).toLocaleDateString()}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default Profile;
