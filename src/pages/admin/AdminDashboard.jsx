import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllUsers, getAllLessons, getAllQuizzes, getAllExams, getAllDictionaryEntries } from '../../auth/adminUtils';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { broadcastNotification, NOTIFICATION_TYPES } from '../../notifications/notifications';
import '../../styles/pages/AdminDashboard.css';

function AdminDashboard() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalLessons: 0,
    totalQuizzes: 0,
    totalExams: 0,
    totalDictionaryEntries: 0
  });
  const [loading, setLoading] = useState(true);
  const [activeUserIds, setActiveUserIds] = useState([]);
  const [showAnnounce, setShowAnnounce] = useState(false);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceMessage, setAnnounceMessage] = useState('');
  const [announceLink, setAnnounceLink] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      const [users, lessons, quizzes, exams, dictionary] = await Promise.all([
        getAllUsers(),
        getAllLessons(),
        getAllQuizzes(),
        getAllExams(),
        getAllDictionaryEntries()
      ]);

      setStats({
        totalUsers: users.length,
        totalLessons: lessons.length,
        totalQuizzes: quizzes.length,
        totalExams: exams.length,
        totalDictionaryEntries: dictionary.length
      });
      setActiveUserIds(users.map((u) => u.id));
    } catch (error) {
      console.error('Error loading stats:', error);
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const handleSendAnnouncement = async () => {
    if (!announceTitle.trim() || !announceMessage.trim()) {
      toast.warning('Please provide both a title and a message');
      return;
    }
    try {
      setSending(true);
      const sent = await broadcastNotification(activeUserIds, {
        type: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
        title: announceTitle.trim(),
        message: announceMessage.trim(),
        link: announceLink.trim() || null,
        createdBy: currentUser?.uid || null,
      });
      toast.success(`Announcement sent to ${sent} user${sent === 1 ? '' : 's'}`);
      setShowAnnounce(false);
      setAnnounceTitle('');
      setAnnounceMessage('');
      setAnnounceLink('');
    } catch (err) {
      console.error(err);
      toast.error('Failed to send announcement');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-dashboard">
        <div className="loading-container">
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Admin Dashboard</h1>
        <p>Manage your Signtify application</p>
      </div>

      <div className="admin-quick-actions">
        <button className="admin-quick-btn" onClick={() => setShowAnnounce(true)}>
          📣 Send Announcement
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card card">
          <div className="stat-icon">👥</div>
          <div className="stat-info">
            <h3>{stats.totalUsers}</h3>
            <p>Total Users</p>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">📖</div>
          <div className="stat-info">
            <h3>{stats.totalLessons}</h3>
            <p>Lessons</p>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">📝</div>
          <div className="stat-info">
            <h3>{stats.totalQuizzes}</h3>
            <p>Quizzes</p>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">🎓</div>
          <div className="stat-info">
            <h3>{stats.totalExams}</h3>
            <p>Exams</p>
          </div>
        </div>

        <div className="stat-card card">
          <div className="stat-icon">📚</div>
          <div className="stat-info">
            <h3>{stats.totalDictionaryEntries}</h3>
            <p>Dictionary Entries</p>
          </div>
        </div>
      </div>

      <div className="admin-sections">
        <h2>Management Sections</h2>
        <div className="sections-grid">
          <Link to="/admin/users" className="section-card card">
            <div className="section-icon">👥</div>
            <h3>User Management</h3>
            <p>View, edit, and manage user accounts</p>
          </Link>

          <Link to="/admin/lessons" className="section-card card">
            <div className="section-icon">📖</div>
            <h3>Lesson Management</h3>
            <p>Create, edit, and delete ASL lessons</p>
          </Link>

          <Link to="/admin/quizzes" className="section-card card">
            <div className="section-icon">📝</div>
            <h3>Quiz Management</h3>
            <p>Create, edit, and delete quizzes</p>
          </Link>

          <Link to="/admin/exams" className="section-card card">
            <div className="section-icon">🎓</div>
            <h3>Exam Management</h3>
            <p>Create, edit, and delete exams</p>
          </Link>

          <Link to="/admin/dictionary" className="section-card card">
            <div className="section-icon">📚</div>
            <h3>Dictionary Management</h3>
            <p>Manage sign language dictionary content</p>
          </Link>

          <Link to="/admin/activity-log" className="section-card card">
            <div className="section-icon">📋</div>
            <h3>Activity Log</h3>
            <p>View all admin and user activities</p>
          </Link>
        </div>
      </div>

      {showAnnounce && (
        <div className="modal-overlay" onClick={() => !sending && setShowAnnounce(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h2>📣 Send Announcement</h2>
            <p style={{ color: 'var(--color-text-muted, #6b7280)', marginBottom: '1rem' }}>
              This will appear in every active user's notification center.
            </p>
            <div className="form-group">
              <label>Title</label>
              <input
                type="text"
                value={announceTitle}
                onChange={(e) => setAnnounceTitle(e.target.value)}
                placeholder="e.g., New lessons available!"
                maxLength={80}
              />
            </div>
            <div className="form-group">
              <label>Message</label>
              <textarea
                rows={4}
                value={announceMessage}
                onChange={(e) => setAnnounceMessage(e.target.value)}
                placeholder="Share the news with your learners…"
                maxLength={400}
              />
            </div>
            <div className="form-group">
              <label>Link <span style={{ fontWeight: 'normal', color: '#999' }}>(optional)</span></label>
              <input
                type="text"
                value={announceLink}
                onChange={(e) => setAnnounceLink(e.target.value)}
                placeholder="/lessons/alphabet"
              />
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setShowAnnounce(false)}
                disabled={sending}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSendAnnouncement}
                disabled={sending}
              >
                {sending ? 'Sending…' : `Send to ${activeUserIds.length} user${activeUserIds.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminDashboard;
