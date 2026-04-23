import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getActivityLogs } from '../../auth/auditLogger';
import { useToast } from '../../components/ui/Toast';
import '../../styles/pages/AdminManagement.css';

function ActivityLog() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'admin', 'user'
  const [limit, setLimit] = useState(100);

  useEffect(() => {
    loadLogs();
  }, [limit]);

  const loadLogs = async () => {
    try {
      setLoading(true);
      const logsData = await getActivityLogs(limit);
      setLogs(logsData);
    } catch (error) {
      console.error('Error loading activity logs:', error);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    
    // Handle Firestore Timestamp
    let date;
    if (timestamp.toDate) {
      date = timestamp.toDate();
    } else if (timestamp.seconds) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatActionMessage = (log) => {
    if (log.type === 'admin_action') {
      if (log.action === 'grant_admin') {
        return `${log.userName || log.userEmail} granted admin access to user "${log.resourceTitle}"`;
      } else if (log.action === 'revoke_admin') {
        return `${log.userName || log.userEmail} revoked admin access from user "${log.resourceTitle}"`;
      }
      const actionMap = {
        'create': 'created',
        'update': 'edited',
        'delete': 'deleted'
      };
      const action = actionMap[log.action] || log.action;
      return `${log.userName || log.userEmail} ${action} ${log.resourceType} "${log.resourceTitle}"`;
    } else if (log.type === 'user_activity') {
      if (log.action === 'quiz_taken') {
        const details = log.details || {};
        const score = details.percentage !== undefined ? `${details.percentage}%` : '';
        return `${log.userName || log.userEmail} has taken quiz "${log.resourceTitle}"${score ? ` (Score: ${score})` : ''}`;
      } else if (log.action === 'exam_taken') {
        const details = log.details || {};
        const score = details.percentage !== undefined ? `${details.percentage}%` : '';
        const passed = details.passed ? ' (Passed)' : ' (Failed)';
        return `${log.userName || log.userEmail} has taken exam "${log.resourceTitle}"${score ? ` (Score: ${score}${passed})` : ''}`;
      } else if (log.action === 'lesson_completed') {
        return `${log.userName || log.userEmail} has completed lesson "${log.resourceTitle}"`;
      }
      return `${log.userName || log.userEmail} ${log.action} ${log.resourceType} "${log.resourceTitle}"`;
    }
    return 'Unknown activity';
  };

  const getActionIcon = (log) => {
    if (log.type === 'admin_action') {
      switch (log.action) {
        case 'create':
          return '➕';
        case 'update':
          return '✏️';
        case 'delete':
          return '🗑️';
        case 'grant_admin':
          return '👑';
        case 'revoke_admin':
          return '🔓';
        default:
          return '⚙️';
      }
    } else if (log.type === 'user_activity') {
      switch (log.action) {
        case 'quiz_taken':
          return '📝';
        case 'exam_taken':
          return '🎓';
        case 'lesson_completed':
          return '✅';
        default:
          return '📋';
      }
    }
    return '📋';
  };

  const getActionColor = (log) => {
    if (log.type === 'admin_action') {
      return '#FF4B4B';
    } else if (log.type === 'user_activity') {
      return '#4CAF50';
    }
    return '#666';
  };

  const filteredLogs = logs.filter(log => {
    if (filter === 'all') return true;
    if (filter === 'admin') return log.type === 'admin_action';
    if (filter === 'user') return log.type === 'user_activity';
    return true;
  });

  if (loading) {
    return (
      <div className="admin-management">
        <div className="loading-container">
          <p>Loading activity logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-management">
      <div className="management-header">
        <Link to="/admin" className="back-button">← Back to Dashboard</Link>
        <h1>📋 Activity Log</h1>
        <p>Track all admin and user activities</p>
      </div>

      <div className="management-controls card">
        <div className="filter-controls">
          <label>Filter:</label>
          <select value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">All Activities</option>
            <option value="admin">Admin Actions</option>
            <option value="user">User Activities</option>
          </select>
        </div>
        <div className="limit-controls">
          <label>Show:</label>
          <select value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            <option value={50}>50 entries</option>
            <option value={100}>100 entries</option>
            <option value={200}>200 entries</option>
            <option value={500}>500 entries</option>
          </select>
        </div>
        <button className="btn-secondary" onClick={loadLogs}>
          🔄 Refresh
        </button>
      </div>

      <div className="activity-log-container">
        {filteredLogs.length === 0 ? (
          <div className="no-results card">
            <p>No activity logs found.</p>
          </div>
        ) : (
          <div className="activity-log-list">
            {filteredLogs.map((log) => (
              <div key={log.id} className="activity-log-item card">
                <div className="activity-log-header">
                  <div className="activity-icon" style={{ color: getActionColor(log) }}>
                    {getActionIcon(log)}
                  </div>
                  <div className="activity-content">
                    <div className="activity-message">
                      {formatActionMessage(log)}
                    </div>
                    <div className="activity-meta">
                      <span className="activity-type">
                        {log.type === 'admin_action' ? '👤 Admin Action' : '👥 User Activity'}
                      </span>
                      <span className="activity-time">
                        {formatTimestamp(log.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
                {log.details && Object.keys(log.details).length > 0 && (
                  <div className="activity-details">
                    <details>
                      <summary>View Details</summary>
                      <pre>{JSON.stringify(log.details, null, 2)}</pre>
                    </details>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default ActivityLog;


