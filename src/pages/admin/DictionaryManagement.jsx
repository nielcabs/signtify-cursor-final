import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllDictionaryEntries, saveDictionaryEntry, deleteDictionaryEntry } from '../../auth/adminUtils';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui/Toast';
import '../../styles/pages/AdminManagement.css';

function DictionaryManagement() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  const [formData, setFormData] = useState({
    word: '',
    category: 'Common',
    description: '',
    videoUrl: '',
    imageUrl: ''
  });

  const categories = ['All', 'Alphabet', 'Greetings', 'Common', 'Emotions', 'Actions', 'Places', 'Time'];

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = async () => {
    try {
      setLoading(true);
      const entriesData = await getAllDictionaryEntries();
      setEntries(entriesData);
    } catch (error) {
      console.error('Error loading dictionary entries:', error);
      toast.error('Failed to load dictionary entries');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingEntry(null);
    setFormData({
      word: '',
      category: 'Common',
      description: '',
      videoUrl: '',
      imageUrl: ''
    });
    setShowForm(true);
  };

  const handleEdit = (entry) => {
    setEditingEntry(entry);
    setFormData({
      word: entry.word || '',
      category: entry.category || 'Common',
      description: entry.description || '',
      videoUrl: entry.videoUrl || '',
      imageUrl: entry.imageUrl || ''
    });
    setShowForm(true);
  };

  const handleSaveEntry = async () => {
    if (!formData.word || !formData.description) {
      toast.warning('Please provide word and description');
      return;
    }

    const entryId = editingEntry ? editingEntry.id : `entry_${Date.now()}`;

    try {
      await saveDictionaryEntry(
        entryId,
        formData,
        currentUser?.uid,
        currentUser?.email
      );
      await loadEntries();
      setShowForm(false);
      toast.success('Dictionary entry saved');
    } catch (error) {
      console.error('Error saving entry:', error);
      toast.error(error?.message || 'Failed to save dictionary entry');
    }
  };

  const handleDeleteEntry = async () => {
    if (!entryToDelete) return;

    try {
      await deleteDictionaryEntry(
        entryToDelete.id,
        currentUser?.uid,
        currentUser?.email,
        entryToDelete.word
      );
      await loadEntries();
      toast.success('Dictionary entry deleted');
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error(error?.message || 'Failed to delete dictionary entry');
    } finally {
      setShowDeleteConfirm(false);
      setEntryToDelete(null);
    }
  };

  const filteredEntries = entries.filter(entry => {
    const matchesSearch = entry.word?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'All' || entry.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="admin-management">
        <div className="loading-container">
          <p>Loading dictionary entries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-management">
      <div className="management-header">
        <Link to="/admin" className="back-button">← Back to Dashboard</Link>
        <h1>📚 Dictionary Management</h1>
        <p>Manage sign language dictionary content</p>
      </div>

      <div className="management-controls card">
        <button className="btn-primary" onClick={handleCreateNew}>
          + Add New Entry
        </button>
        <div className="search-box">
          <input
            type="text"
            placeholder="Search entries..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="category-filters">
          {categories.map(category => (
            <button
              key={category}
              className={`filter-button ${filterCategory === category ? 'active' : ''}`}
              onClick={() => setFilterCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="management-stats card">
        <span>Total Entries: <strong>{entries.length}</strong></span>
        <span>Filtered: <strong>{filteredEntries.length}</strong></span>
      </div>

      <div className="management-grid">
        {filteredEntries.map((entry) => (
          <div key={entry.id} className="management-item card">
            <div className="item-header">
              <h3>{entry.word}</h3>
              <span className="badge">{entry.category}</span>
            </div>
            <div className="item-details">
              <p>{entry.description}</p>
              {entry.videoUrl && <small>📹 Video available</small>}
              {entry.imageUrl && <small>🖼️ Image available</small>}
            </div>
            <div className="item-actions">
              <button className="btn-secondary" onClick={() => handleEdit(entry)}>
                Edit
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  setEntryToDelete(entry);
                  setShowDeleteConfirm(true);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredEntries.length === 0 && (
        <div className="no-results card">
          <p>No dictionary entries found matching your criteria.</p>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content modal-large card" onClick={(e) => e.stopPropagation()}>
            <h2>{editingEntry ? 'Edit Dictionary Entry' : 'Add New Dictionary Entry'}</h2>
            
            <div className="form-group">
              <label>Word/Sign:</label>
              <input
                type="text"
                value={formData.word}
                onChange={(e) => setFormData({ ...formData, word: e.target.value })}
                placeholder="Enter word or sign"
              />
            </div>

            <div className="form-group">
              <label>Category:</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                {categories.filter(c => c !== 'All').map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Description:</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Enter description"
                rows="4"
              />
            </div>

            <div className="form-group">
              <label>Video URL (optional):</label>
              <input
                type="text"
                value={formData.videoUrl}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                placeholder="Enter video URL"
              />
            </div>

            <div className="form-group">
              <label>Image URL (optional):</label>
              <input
                type="text"
                value={formData.imageUrl}
                onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                placeholder="Enter image URL"
              />
            </div>

            <div className="modal-actions">
              <button className="btn-primary" onClick={handleSaveEntry}>
                {editingEntry ? 'Update Entry' : 'Add Entry'}
              </button>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && entryToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h2>⚠️ Confirm Delete</h2>
            <p>Are you sure you want to delete this entry:</p>
            <p><strong>{entryToDelete.word}</strong>?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={handleDeleteEntry}>
                Delete Entry
              </button>
              <button className="btn-secondary" onClick={() => {
                setShowDeleteConfirm(false);
                setEntryToDelete(null);
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DictionaryManagement;
