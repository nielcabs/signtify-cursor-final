import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAllUsers,
  updateUserAdminStatus,
  updateUserDetails,
  deleteUser,
  resetUserProgress,
  setUserRole,
  archiveUser,
  restoreUser,
  USER_ROLES,
  ROLE_LABELS,
} from '../../auth/adminUtils';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui/Toast';
import ActionMenu from '../../components/ui/ActionMenu';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { createNotification, NOTIFICATION_TYPES } from '../../notifications/notifications';
import '../../styles/pages/AdminManagement.css';

const TABS = [
  { id: 'active', label: 'Active Users' },
  { id: 'archived', label: 'Archived' },
];

const CONFIRM_DEFAULTS = { open: false, loading: false };

function UserManagement() {
  const { currentUser } = useAuth();
  const toast = useToast();

  const [tab, setTab] = useState('active');
  const [users, setUsers] = useState([]);
  const [archived, setArchived] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [selectedUser, setSelectedUser] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({ displayName: '', email: '', password: '' });
  const [saving, setSaving] = useState(false);

  // Unified confirm dialog state: { open, action, user, title, message, variant, confirmLabel, loading }
  const [confirmState, setConfirmState] = useState(CONFIRM_DEFAULTS);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      setLoading(true);
      const [active, archivedList] = await Promise.all([
        getAllUsers({ includeArchived: false }),
        getAllUsers({ onlyArchived: true }),
      ]);
      setUsers(active);
      setArchived(archivedList);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const visibleList = tab === 'active' ? users : archived;

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return visibleList;
    return visibleList.filter((u) =>
      (u.email || '').toLowerCase().includes(term) ||
      (u.displayName || '').toLowerCase().includes(term),
    );
  }, [visibleList, searchTerm]);

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString();
  };

  const closeConfirm = () => setConfirmState(CONFIRM_DEFAULTS);

  const openConfirm = (opts) => setConfirmState({ open: true, loading: false, ...opts });

  const safeCall = async (fn, { successMessage, errorFallback = 'Something went wrong' }) => {
    setConfirmState((s) => ({ ...s, loading: true }));
    try {
      await fn();
      if (successMessage) toast.success(successMessage);
      await loadAll();
    } catch (error) {
      console.error(error);
      toast.error(error?.message || errorFallback);
    } finally {
      closeConfirm();
    }
  };

  const isSelf = (user) => currentUser && user?.id === currentUser.uid;

  // ---- Action handlers ----

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setEditFormData({
      displayName: user.displayName || '',
      email: user.email || '',
      password: '',
    });
    setShowEditModal(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    try {
      setSaving(true);
      const updates = { displayName: editFormData.displayName };
      const pwd = editFormData.password;
      if (pwd && pwd.trim() !== '') {
        if (pwd.length < 12 || pwd.length > 16) {
          toast.error('Password must be between 12 and 16 characters');
          return;
        }
        if (!/[a-zA-Z]/.test(pwd)) {
          toast.error('Password must contain at least one letter');
          return;
        }
        if (!/[0-9]/.test(pwd)) {
          toast.error('Password must contain at least one number');
          return;
        }
        if (!/^[a-zA-Z0-9]+$/.test(pwd)) {
          toast.error('Password must be alphanumeric only (no special characters)');
          return;
        }
        updates.password = pwd;
      }

      await updateUserDetails(selectedUser.id, updates);
      await createNotification({
        userId: selectedUser.id,
        type: NOTIFICATION_TYPES.ACCOUNT,
        title: 'Your profile was updated',
        message: 'An administrator updated your account details.',
        createdBy: currentUser?.uid || null,
      });
      toast.success('User details updated');
      setShowEditModal(false);
      setSelectedUser(null);
      await loadAll();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(error?.message || 'Failed to update user details');
    } finally {
      setSaving(false);
    }
  };

  const confirmToggleAdmin = (user) => {
    if (isSelf(user)) {
      toast.warning('You cannot change your own admin status');
      return;
    }
    const currentlyAdmin = user.role === USER_ROLES.ADMIN;
    openConfirm({
      user,
      title: currentlyAdmin ? 'Revoke admin access?' : 'Grant admin access?',
      message: `${user.displayName || user.email} will ${currentlyAdmin ? 'lose' : 'gain'} full administrator privileges.`,
      variant: currentlyAdmin ? 'warning' : 'primary',
      confirmLabel: currentlyAdmin ? 'Revoke admin' : 'Make admin',
      onConfirm: () => safeCall(
        async () => {
          await updateUserAdminStatus(user.id, !currentlyAdmin, currentUser?.uid, currentUser?.email);
          await createNotification({
            userId: user.id,
            type: NOTIFICATION_TYPES.ACCOUNT,
            title: currentlyAdmin ? 'Admin access revoked' : 'You are now an administrator',
            message: currentlyAdmin
              ? 'Your administrator privileges have been removed.'
              : 'You have been granted administrator privileges.',
            createdBy: currentUser?.uid || null,
          });
        },
        { successMessage: 'Admin status updated', errorFallback: 'Failed to update admin status' },
      ),
    });
  };

  const confirmSetRole = (user, newRole) => {
    if (isSelf(user)) {
      toast.warning('You cannot change your own role');
      return;
    }
    if (user.role === newRole) {
      toast.info(`${user.displayName || user.email} is already a ${ROLE_LABELS[newRole]}.`);
      return;
    }
    openConfirm({
      user,
      title: `Change role to ${ROLE_LABELS[newRole]}?`,
      message: `${user.displayName || user.email} will be set to ${ROLE_LABELS[newRole]}.`,
      variant: newRole === USER_ROLES.ADMIN ? 'warning' : 'primary',
      confirmLabel: `Make ${ROLE_LABELS[newRole]}`,
      onConfirm: () => safeCall(
        async () => {
          await setUserRole(user.id, newRole, currentUser?.uid, currentUser?.email);
          await createNotification({
            userId: user.id,
            type: NOTIFICATION_TYPES.ACCOUNT,
            title: `Your role changed to ${ROLE_LABELS[newRole]}`,
            message: `An administrator set your account role to ${ROLE_LABELS[newRole]}.`,
            createdBy: currentUser?.uid || null,
          });
        },
        { successMessage: `Role set to ${ROLE_LABELS[newRole]}`, errorFallback: 'Failed to set role' },
      ),
    });
  };

  const confirmReset = (user) => {
    if (isSelf(user)) {
      toast.warning('You cannot reset your own progress');
      return;
    }
    openConfirm({
      user,
      title: 'Reset learning progress?',
      message: `All progress for "${user.displayName || user.email}" will be cleared (points, completed lessons, quiz/exam history, achievements, streaks).\n\nThis cannot be undone.`,
      variant: 'warning',
      confirmLabel: 'Reset progress',
      onConfirm: () => safeCall(
        async () => {
          await resetUserProgress(user.id);
          await createNotification({
            userId: user.id,
            type: NOTIFICATION_TYPES.ACCOUNT,
            title: 'Your progress was reset',
            message: 'An administrator reset your learning progress.',
            createdBy: currentUser?.uid || null,
          });
        },
        { successMessage: 'User progress reset', errorFallback: 'Failed to reset progress' },
      ),
    });
  };

  const confirmArchive = (user) => {
    if (isSelf(user)) {
      toast.warning('You cannot archive your own account');
      return;
    }
    openConfirm({
      user,
      title: 'Archive this account?',
      message: `"${user.displayName || user.email}" will no longer be able to log in. Their data is preserved and the account can be restored later.`,
      variant: 'warning',
      confirmLabel: 'Archive',
      onConfirm: () => safeCall(
        () => archiveUser(user.id, currentUser?.uid, currentUser?.email),
        { successMessage: 'Account archived', errorFallback: 'Failed to archive account' },
      ),
    });
  };

  const confirmRestore = (user) => {
    openConfirm({
      user,
      title: 'Restore this account?',
      message: `"${user.displayName || user.email}" will regain access and reappear in the active users list.`,
      variant: 'success',
      confirmLabel: 'Restore',
      onConfirm: () => safeCall(
        () => restoreUser(user.id, currentUser?.uid, currentUser?.email),
        { successMessage: 'Account restored', errorFallback: 'Failed to restore account' },
      ),
    });
  };

  const confirmDelete = (user) => {
    if (isSelf(user)) {
      toast.warning('You cannot delete your own account');
      return;
    }
    openConfirm({
      user,
      title: 'Permanently delete account?',
      message: `This will remove "${user.displayName || user.email}" from Firebase Auth and Firestore. This action CANNOT be undone.\n\nTip: consider archiving first if you might want to restore the user later.`,
      variant: 'danger',
      confirmLabel: 'Delete permanently',
      onConfirm: () => safeCall(
        () => deleteUser(user.id),
        { successMessage: 'User deleted', errorFallback: 'Failed to delete user' },
      ),
    });
  };

  // ---- Build dropdown items per row ----

  const buildMenuItems = (user) => {
    if (tab === 'archived') {
      return [
        { label: 'Restore account', icon: '♻️', variant: 'success', onClick: () => confirmRestore(user) },
        { divider: true },
        {
          label: 'Delete permanently',
          icon: '🗑️',
          variant: 'danger',
          disabled: isSelf(user),
          onClick: () => confirmDelete(user),
        },
      ];
    }

    const self = isSelf(user);
    const selfTitle = self ? 'Not available on your own account' : undefined;

    const roleItems = [
      {
        label: user.role === USER_ROLES.STUDENT ? 'Student (current)' : 'Set as Student',
        icon: user.role === USER_ROLES.STUDENT ? '✓' : '🎓',
        disabled: self || user.role === USER_ROLES.STUDENT,
        title: selfTitle,
        onClick: () => confirmSetRole(user, USER_ROLES.STUDENT),
      },
      {
        label: user.role === USER_ROLES.TEACHER ? 'Teacher (current)' : 'Set as Teacher',
        icon: user.role === USER_ROLES.TEACHER ? '✓' : '👩‍🏫',
        disabled: self || user.role === USER_ROLES.TEACHER,
        title: selfTitle,
        onClick: () => confirmSetRole(user, USER_ROLES.TEACHER),
      },
      {
        label: user.role === USER_ROLES.ADMIN ? 'Revoke admin' : 'Set as Admin',
        icon: user.role === USER_ROLES.ADMIN ? '🔓' : '🛡️',
        variant: user.role === USER_ROLES.ADMIN ? 'warning' : undefined,
        disabled: self,
        title: selfTitle,
        onClick: () => confirmToggleAdmin(user),
      },
    ];

    return [
      { label: 'Edit details', icon: '✏️', onClick: () => handleEditUser(user) },
      { divider: true },
      ...roleItems,
      { divider: true },
      {
        label: 'Reset progress',
        icon: '🔄',
        variant: 'warning',
        disabled: self,
        title: selfTitle,
        onClick: () => confirmReset(user),
      },
      {
        label: 'Archive account',
        icon: '📦',
        variant: 'warning',
        disabled: self,
        title: selfTitle,
        onClick: () => confirmArchive(user),
      },
      { divider: true },
      {
        label: 'Delete permanently',
        icon: '🗑️',
        variant: 'danger',
        disabled: self,
        title: selfTitle,
        onClick: () => confirmDelete(user),
      },
    ];
  };

  if (loading) {
    return (
      <div className="admin-management">
        <div className="loading-container"><p>Loading users…</p></div>
      </div>
    );
  }

  return (
    <div className="admin-management">
      <div className="management-header">
        <Link to="/admin" className="back-button">← Back to Dashboard</Link>
        <h1>👥 User Management</h1>
        <p>Manage user accounts, roles, and access.</p>
      </div>

      <div className="um-tabs" role="tablist" aria-label="User list filter">
        {TABS.map((t) => {
          const count = t.id === 'active' ? users.length : archived.length;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`um-tab ${tab === t.id ? 'um-tab-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label} <span className="um-tab-count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="management-controls card">
        <div className="search-box">
          <input
            type="text"
            placeholder={tab === 'active' ? 'Search active users…' : 'Search archived users…'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="management-stats">
          <span>Total: <strong>{visibleList.length}</strong></span>
          {tab === 'active' && (
            <>
              <span>Admins: <strong>{users.filter((u) => u.role === USER_ROLES.ADMIN).length}</strong></span>
              <span>Teachers: <strong>{users.filter((u) => u.role === USER_ROLES.TEACHER).length}</strong></span>
            </>
          )}
        </div>
      </div>

      <div className="management-table card">
        <table>
          <thead>
            <tr>
              <th>Display Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Created</th>
              <th>{tab === 'archived' ? 'Archived On' : 'Last Login'}</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => (
              <tr key={user.id} className={isSelf(user) ? 'current-user' : ''}>
                <td>{user.displayName || 'N/A'}{isSelf(user) && <span className="um-you-tag">you</span>}</td>
                <td>{user.email}</td>
                <td><span className={`um-role-badge um-role-${user.role}`}>{ROLE_LABELS[user.role]}</span></td>
                <td>{formatDate(user.createdAt)}</td>
                <td>{formatDate(tab === 'archived' ? user.archivedAt : user.lastLogin)}</td>
                <td style={{ textAlign: 'right' }}>
                  <ActionMenu
                    label="Options"
                    items={buildMenuItems(user)}
                    align="right"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="no-results">
            <p>
              {tab === 'archived'
                ? 'No archived users.'
                : searchTerm
                  ? 'No users match your search.'
                  : 'No users found.'}
            </p>
          </div>
        )}
      </div>

      {showEditModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h2>✏️ Edit User Details</h2>
            <form onSubmit={handleSaveEdit}>
              <div className="form-group">
                <label>Display Name</label>
                <input
                  type="text"
                  value={editFormData.displayName}
                  onChange={(e) => setEditFormData({ ...editFormData, displayName: e.target.value })}
                  placeholder="Enter display name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={editFormData.email}
                  disabled
                  className="disabled-input"
                  title="Email cannot be changed"
                />
                <small className="form-hint">Email cannot be modified</small>
              </div>
              <div className="form-group">
                <label>New Password <span className="optional-label">(Optional)</span></label>
                <input
                  type="password"
                  value={editFormData.password}
                  onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                  placeholder="Leave empty to keep current password"
                  minLength="12"
                  maxLength="16"
                  pattern="[a-zA-Z0-9]{12,16}"
                />
                <small className="form-hint">12–16 alphanumeric characters. Leave empty to keep current.</small>
              </div>
              <div className="modal-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => { setShowEditModal(false); setSelectedUser(null); }}
                  disabled={saving}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmState.open}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant || 'primary'}
        confirmLabel={confirmState.confirmLabel || 'Confirm'}
        loading={confirmState.loading}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}

export default UserManagement;
