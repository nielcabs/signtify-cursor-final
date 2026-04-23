import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

/**
 * Allows access to teachers. Admins are treated as a super-set of teachers.
 */
const TeacherRoute = ({ children }) => {
  const { currentUser, isAdmin, isTeacher, loading } = useAuth();

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

  if (!isTeacher && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default TeacherRoute;
