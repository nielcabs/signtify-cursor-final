import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Content management (lessons, quizzes, exams, dictionary): teachers only.
 * Admins handle users only — see AdminRoute + /admin/users.
 */
const TeacherRoute = ({ children }) => {
  const { currentUser, isTeacher, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <p>Loading…</p>
      </div>
    );
  }

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (!isTeacher) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default TeacherRoute;
