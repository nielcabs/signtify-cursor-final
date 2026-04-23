import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllLessons, saveLesson, deleteLesson } from '../../auth/adminUtils';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui/Toast';
import '../../styles/pages/AdminManagement.css';

function LessonManagement() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [lessonToDelete, setLessonToDelete] = useState(null);

  const [formData, setFormData] = useState({
    id: '',
    title: '',
    description: '',
    category: 'alphabet',
    order: 1,
    icon: '✋',
    signs: []
  });

  const [currentSign, setCurrentSign] = useState({
    name: '',
    description: '',
    imageUrl: '',
    videoUrl: '',
    handIcon: '✋',
    tips: ''
  });

  const categoryOptions = [
    { value: 'alphabet', label: 'Alphabet' },
    { value: 'greetings', label: 'Greetings' },
    { value: 'numbers', label: 'Numbers' },
    { value: 'common', label: 'Common Words' },
    { value: 'phrases', label: 'Phrases' },
    { value: 'emotions', label: 'Emotions' },
    { value: 'family', label: 'Family' },
    { value: 'food', label: 'Food & Drinks' },
    { value: 'colors', label: 'Colors' },
    { value: 'animals', label: 'Animals' }
  ];

  const iconOptions = ['✋', '👋', '🤙', '🤘', '👌', '✌️', '🤞', '🫰', '🤟', '🫶', '👍', '👎', '🤝', '🙏', '📚', '🎓', '💬', '🔤', '🔢', '❤️'];

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      setLoading(true);
      const lessonsData = await getAllLessons();
      
      // Sort lessons by order field
      lessonsData.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        return orderA - orderB;
      });
      
      setLessons(lessonsData);
    } catch (error) {
      console.error('Error loading lessons:', error);
      toast.error('Failed to load lessons');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingLesson(null);
    setFormData({
      id: '',
      title: '',
      description: '',
      category: 'alphabet',
      order: lessons.length + 1,
      icon: '✋',
      signs: []
    });
    setCurrentSign({
      name: '',
      description: '',
      imageUrl: '',
      videoUrl: '',
      handIcon: '✋',
      tips: ''
    });
    setShowForm(true);
  };

  const handleEdit = (lesson) => {
    setEditingLesson(lesson);
    setFormData({
      id: lesson.id,
      title: lesson.title || '',
      description: lesson.description || '',
      category: lesson.category || 'alphabet',
      order: lesson.order || 1,
      icon: lesson.icon || '✋',
      signs: lesson.signs || []
    });
    setShowForm(true);
  };

  const handleAddSign = () => {
    if (!currentSign.name) {
      toast.warning('Please provide a sign name');
      return;
    }

    setFormData({
      ...formData,
      signs: [...formData.signs, { ...currentSign }]
    });

    setCurrentSign({
      name: '',
      description: '',
      imageUrl: '',
      videoUrl: '',
      handIcon: '✋',
      tips: ''
    });
  };

  const handleRemoveSign = (index) => {
    setFormData({
      ...formData,
      signs: formData.signs.filter((_, i) => i !== index)
    });
  };

  const handleEditSign = (index) => {
    const signToEdit = formData.signs[index];
    setCurrentSign({
      name: signToEdit.name || '',
      description: signToEdit.description || '',
      imageUrl: signToEdit.imageUrl || '',
      videoUrl: signToEdit.videoUrl || '',
      handIcon: signToEdit.handIcon || '✋',
      tips: signToEdit.tips || ''
    });
    setFormData({
      ...formData,
      signs: formData.signs.filter((_, i) => i !== index)
    });
  };

  const handleSaveLesson = async () => {
    if (!formData.title || !formData.description) {
      toast.warning('Please provide a title and description');
      return;
    }

    if (formData.signs.length === 0) {
      toast.warning('Please add at least one sign to the lesson');
      return;
    }

    const lessonId = editingLesson ? editingLesson.id : formData.id || `lesson_${Date.now()}`;

    try {
      await saveLesson(
        lessonId,
        {
          title: formData.title,
          description: formData.description,
          category: formData.category,
          order: formData.order,
          icon: formData.icon,
          signs: formData.signs
        },
        currentUser?.uid,
        currentUser?.email
      );
      
      await loadLessons();
      setShowForm(false);
      toast.success('Lesson saved');
    } catch (error) {
      console.error('Error saving lesson:', error);
      toast.error(error?.message || 'Failed to save lesson');
    }
  };

  const handleDeleteLesson = async () => {
    if (!lessonToDelete) return;

    try {
      await deleteLesson(
        lessonToDelete.id,
        currentUser?.uid,
        currentUser?.email,
        lessonToDelete.title
      );
      await loadLessons();
      toast.success('Lesson deleted');
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast.error(error?.message || 'Failed to delete lesson');
    } finally {
      setShowDeleteConfirm(false);
      setLessonToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-management">
        <div className="loading-container">
          <p>Loading lessons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-management">
      <div className="management-header">
        <Link to="/admin" className="back-button">← Back to Dashboard</Link>
        <h1>Lesson Management</h1>
        <p>Create, edit, and delete sign language lessons</p>
      </div>

      <div className="management-controls card">
        <button className="btn-primary" onClick={handleCreateNew}>
          + Create New Lesson
        </button>
        <div className="management-stats">
          <span>Total Lessons: <strong>{lessons.length}</strong></span>
        </div>
      </div>

      <div className="management-grid">
        {lessons.map((lesson) => (
          <div key={lesson.id} className="management-item card">
            <div className="item-header">
              <div>
                <span className="exam-order-badge">#{lesson.order || '?'}</span>
                <span className="lesson-icon">{lesson.icon || '✋'}</span>
                <h3>{lesson.title || 'Untitled Lesson'}</h3>
              </div>
              <span className="badge lesson">
                {lesson.signs?.length || 0} signs
              </span>
            </div>
            <div className="item-details">
              <p><strong>Category:</strong> {categoryOptions.find(c => c.value === lesson.category)?.label || lesson.category}</p>
              <p className="lesson-description">{lesson.description || 'No description'}</p>
            </div>
            <div className="item-actions">
              <button className="btn-secondary" onClick={() => handleEdit(lesson)}>
                Edit
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  setLessonToDelete(lesson);
                  setShowDeleteConfirm(true);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {lessons.length === 0 && (
        <div className="no-results card">
          <p>No lessons found. Create your first lesson!</p>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content modal-fullscreen card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-sticky">
              <h2>{editingLesson ? 'Edit Lesson' : 'Create New Lesson'}</h2>
              <button className="close-button" onClick={() => setShowForm(false)}>✕</button>
            </div>

            <div className="two-panel-layout">
              {/* Left Panel: Lesson Settings */}
              <div className="left-panel">
                <div className="panel-section">
                  <h3 className="section-title">📚 Lesson Settings</h3>
                  
                  <div className="form-group">
                    <label>Lesson Title:</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Learn the Alphabet"
                    />
                  </div>

                  <div className="form-group">
                    <label>Description:</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Describe what users will learn in this lesson..."
                      rows={3}
                    />
                  </div>

                  <div className="form-group">
                    <label>Category:</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    >
                      {categoryOptions.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Lesson Icon:</label>
                    <div className="icon-selector">
                      {iconOptions.map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          className={`icon-button ${formData.icon === icon ? 'selected' : ''}`}
                          onClick={() => setFormData({ ...formData, icon })}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Order (sequence):</label>
                    <input
                      type="number"
                      min="1"
                      value={formData.order}
                      onChange={(e) => setFormData({ ...formData, order: parseInt(e.target.value) })}
                    />
                    <small style={{ color: '#666', marginTop: '4px', display: 'block' }}>
                      💡 Lower numbers appear first
                    </small>
                  </div>
                </div>

                {/* Sign Form */}
                <div className="panel-section">
                  <h3 className="section-title">➕ Add Sign</h3>
                  
                  <div className="form-group">
                    <label>Sign Name:</label>
                    <input
                      type="text"
                      value={currentSign.name}
                      onChange={(e) => setCurrentSign({ ...currentSign, name: e.target.value })}
                      placeholder="e.g., A, Hello, Thank You"
                    />
                  </div>

                  <div className="form-group">
                    <label>Description (How to sign):</label>
                    <textarea
                      value={currentSign.description}
                      onChange={(e) => setCurrentSign({ ...currentSign, description: e.target.value })}
                      placeholder="Describe how to perform this sign..."
                      rows={3}
                    />
                  </div>

                  <div className="form-group">
                    <label>Image URL (optional):</label>
                    <input
                      type="text"
                      value={currentSign.imageUrl}
                      onChange={(e) => setCurrentSign({ ...currentSign, imageUrl: e.target.value })}
                      placeholder="https://example.com/sign-image.jpg"
                    />
                  </div>

                  {currentSign.imageUrl && (
                    <div className="image-preview">
                      <img src={currentSign.imageUrl} alt="Sign preview" onError={(e) => e.target.style.display = 'none'} />
                    </div>
                  )}

                  <div className="form-group">
                    <label>Video URL (optional):</label>
                    <input
                      type="text"
                      value={currentSign.videoUrl}
                      onChange={(e) => setCurrentSign({ ...currentSign, videoUrl: e.target.value })}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>

                  <div className="form-group">
                    <label>Hand Icon:</label>
                    <div className="icon-selector">
                      {iconOptions.slice(0, 10).map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          className={`icon-button ${currentSign.handIcon === icon ? 'selected' : ''}`}
                          onClick={() => setCurrentSign({ ...currentSign, handIcon: icon })}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Tips (optional):</label>
                    <input
                      type="text"
                      value={currentSign.tips}
                      onChange={(e) => setCurrentSign({ ...currentSign, tips: e.target.value })}
                      placeholder="Any helpful tips for learners..."
                    />
                  </div>

                  <button className="btn-primary" onClick={handleAddSign} style={{ width: '100%' }}>
                    ✓ Add Sign to Lesson
                  </button>
                </div>
              </div>

              {/* Right Panel: Signs List */}
              <div className="right-panel">
                <div className="panel-section" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <div className="questions-header-sticky">
                    <h3 className="section-title">🤟 Signs ({formData.signs.length})</h3>
                    {formData.signs.length === 0 && (
                      <span className="hint-text">Add signs using the form on the left</span>
                    )}
                  </div>
                  
                  <div className="questions-list-scrollable">
                    {formData.signs.length === 0 ? (
                      <div className="empty-state">
                        <p style={{ textAlign: 'center', color: '#999', padding: '2rem' }}>
                          No signs added yet. Fill out the form on the left to add your first sign.
                        </p>
                      </div>
                    ) : (
                      formData.signs.map((sign, index) => (
                        <div key={index} className="question-item">
                          <div className="question-content">
                            <div className="question-header-row">
                              <strong>{index + 1}.</strong> 
                              <span className="hand-icon-display">{sign.handIcon || '✋'}</span>
                              {sign.imageUrl && <span className="image-indicator">🖼️</span>}
                              {sign.videoUrl && <span className="image-indicator">🎥</span>}
                            </div>
                            <p><strong>{sign.name}</strong></p>
                            {sign.description && (
                              <small className="sign-description-preview">{sign.description}</small>
                            )}
                            {sign.imageUrl && (
                              <div className="question-thumbnail">
                                <img src={sign.imageUrl} alt={sign.name} />
                              </div>
                            )}
                            {sign.tips && (
                              <small><strong>Tip:</strong> {sign.tips}</small>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                            <button
                              className="btn-small btn-secondary"
                              onClick={() => handleEditSign(index)}
                              title="Edit this sign"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              className="btn-small btn-danger"
                              onClick={() => handleRemoveSign(index)}
                              title="Remove this sign"
                            >
                              🗑️ Remove
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-actions-sticky">
              <div className="actions-content">
                <div className="actions-info">
                  <span className="info-badge">
                    {formData.signs.length} sign{formData.signs.length !== 1 ? 's' : ''}
                  </span>
                  {formData.signs.length === 0 && (
                    <span className="warning-text">⚠️ At least 1 sign required</span>
                  )}
                </div>
                <div className="actions-buttons">
                  <button className="btn-secondary" onClick={() => setShowForm(false)}>
                    Cancel
                  </button>
                  <button className="btn-primary" onClick={handleSaveLesson}>
                    {editingLesson ? 'Update Lesson' : 'Create Lesson'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && lessonToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h2>⚠️ Confirm Delete</h2>
            <p>Are you sure you want to delete this lesson:</p>
            <p><strong>{lessonToDelete.title}</strong>?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={handleDeleteLesson}>
                Delete Lesson
              </button>
              <button className="btn-secondary" onClick={() => {
                setShowDeleteConfirm(false);
                setLessonToDelete(null);
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

export default LessonManagement;

