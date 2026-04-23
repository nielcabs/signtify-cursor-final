import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../auth/firebase';
import { getAllUsers, USER_ROLES } from '../../auth/adminUtils';
import '../../styles/pages/AdminDashboard.css';
import '../../styles/pages/AdminManagement.css';

/**
 * Lightweight Teacher home — surfaces a roster of students with quick progress
 * stats. Teachers can jump into Lesson / Quiz / Exam management if those are
 * exposed to them by an admin later; for now the focus is visibility into
 * student progress.
 */
function TeacherDashboard() {
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [users, lessonSnap, quizSnap, examSnap] = await Promise.all([
          getAllUsers(),
          getDocs(collection(db, 'lessons')),
          getDocs(collection(db, 'quizzes')),
          getDocs(collection(db, 'exams')),
        ]);
        setStudents(users.filter((u) => u.role === USER_ROLES.STUDENT));
        setLessons(lessonSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setQuizzes(quizSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setExams(examSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error('TeacherDashboard load failed:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return students;
    return students.filter((s) =>
      (s.displayName || '').toLowerCase().includes(term) ||
      (s.email || '').toLowerCase().includes(term),
    );
  }, [students, search]);

  const totalPoints = (s) => s.progress?.totalPoints || 0;
  const lessonsCompleted = (s) => (s.progress?.lessonsCompleted || []).length;
  const examsPassed = (s) => (s.progress?.examsPassed || []).filter((e) => e.passed).length;

  if (loading) {
    return (
      <div className="admin-management">
        <div className="loading-container"><p>Loading teacher dashboard…</p></div>
      </div>
    );
  }

  return (
    <div className="admin-management">
      <div className="management-header">
        <h1>👩‍🏫 Teacher Dashboard</h1>
        <p>Monitor student progress and manage learning content.</p>
      </div>

      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="stat-card card"><div className="stat-icon">🎓</div><div className="stat-info"><h3>{students.length}</h3><p>Students</p></div></div>
        <div className="stat-card card"><div className="stat-icon">📖</div><div className="stat-info"><h3>{lessons.length}</h3><p>Lessons</p></div></div>
        <div className="stat-card card"><div className="stat-icon">📝</div><div className="stat-info"><h3>{quizzes.length}</h3><p>Quizzes</p></div></div>
        <div className="stat-card card"><div className="stat-icon">🏆</div><div className="stat-info"><h3>{exams.length}</h3><p>Exams</p></div></div>
      </div>

      <div className="management-controls card">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search students by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="management-stats">
          <span>Showing: <strong>{filtered.length}</strong> / {students.length}</span>
        </div>
      </div>

      <div className="management-table card">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Email</th>
              <th>Lessons</th>
              <th>Exams Passed</th>
              <th>Points</th>
              <th>Last Login</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id}>
                <td>{s.displayName || '—'}</td>
                <td>{s.email}</td>
                <td>{lessonsCompleted(s)}</td>
                <td>{examsPassed(s)}</td>
                <td>{totalPoints(s)}</td>
                <td>{s.lastLogin ? (s.lastLogin.toDate ? s.lastLogin.toDate() : new Date(s.lastLogin)).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="no-results"><p>No students found.</p></div>
        )}
      </div>

      <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <Link to="/admin/lessons" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>📖 Manage Lessons</Link>
        <Link to="/admin/quizzes" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>📝 Manage Quizzes</Link>
        <Link to="/admin/exams" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>🏆 Manage Exams</Link>
      </div>
    </div>
  );
}

export default TeacherDashboard;
