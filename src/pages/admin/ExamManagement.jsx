import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllExams, saveExam, deleteExam } from '../../auth/adminUtils';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui/Toast';
import '../../styles/pages/AdminManagement.css';

function ExamManagement() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExam, setEditingExam] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [examToDelete, setExamToDelete] = useState(null);
  const [showAddQuestionForm, setShowAddQuestionForm] = useState(true);

  const [formData, setFormData] = useState({
    id: '',
    title: '',
    category: 'alphabet',
    passingScore: 80,
    timeLimit: 30,
    order: 1,
    questions: []
  });

  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    answer: '',
    options: ['', '', '', ''],
    imageUrl: '',
    handIcon: ''
  });

  useEffect(() => {
    loadExams();
  }, []);

  const loadExams = async () => {
    try {
      setLoading(true);
      const examsData = await getAllExams();
      
      // Sort exams by order field for consistent display
      examsData.sort((a, b) => {
        const orderA = a.order !== undefined ? a.order : 999;
        const orderB = b.order !== undefined ? b.order : 999;
        return orderA - orderB;
      });
      
      setExams(examsData);
    } catch (error) {
      console.error('Error loading exams:', error);
      toast.error('Failed to load exams');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingExam(null);
    setFormData({
      id: '',
      title: '',
      category: 'alphabet',
      passingScore: 80,
      timeLimit: 30,
      order: exams.length + 1,
      questions: []
    });
    setCurrentQuestion({
      question: '',
      answer: '',
      options: ['', '', '', ''],
      imageUrl: '',
      handIcon: ''
    });
    setShowAddQuestionForm(true);
    setShowForm(true);
  };

  const handleEdit = (exam) => {
    setEditingExam(exam);
    setFormData({
      id: exam.id,
      title: exam.title || '',
      category: exam.category || 'alphabet',
      passingScore: exam.passingScore || 80,
      timeLimit: exam.timeLimit || 30,
      order: exam.order || 1,
      questions: exam.questions || []
    });
    setShowAddQuestionForm(exam.questions && exam.questions.length > 0 ? false : true);
    setShowForm(true);
  };

  const handleAddQuestion = () => {
    if (!currentQuestion.question || !currentQuestion.answer) {
      toast.warning('Please fill in question and answer');
      return;
    }

    const validOptions = currentQuestion.options.filter(opt => opt.trim() !== '');
    if (validOptions.length < 2) {
      toast.warning('Please provide at least 2 options');
      return;
    }

    if (!validOptions.includes(currentQuestion.answer)) {
      toast.warning('The answer must be one of the options');
      return;
    }

    setFormData({
      ...formData,
      questions: [...formData.questions, { ...currentQuestion, options: validOptions }]
    });

    setCurrentQuestion({
      question: '',
      answer: '',
      options: ['', '', '', ''],
      imageUrl: '',
      handIcon: ''
    });
  };

  const handleRemoveQuestion = (index) => {
    setFormData({
      ...formData,
      questions: formData.questions.filter((_, i) => i !== index)
    });
  };

  const handleEditQuestion = (index) => {
    const questionToEdit = formData.questions[index];
    setCurrentQuestion({
      question: questionToEdit.question,
      answer: questionToEdit.answer,
      options: questionToEdit.options.length === 4 ? questionToEdit.options : [...questionToEdit.options, '', '', '', ''].slice(0, 4),
      imageUrl: questionToEdit.imageUrl || '',
      handIcon: questionToEdit.handIcon || ''
    });
    // Remove the question from the list so it can be edited and re-added
    setFormData({
      ...formData,
      questions: formData.questions.filter((_, i) => i !== index)
    });
    // Show the form and scroll to it
    setShowAddQuestionForm(true);
  };

  const handleSaveExam = async () => {
    if (!formData.title || formData.questions.length === 0) {
      toast.warning('Please provide a title and at least one question');
      return;
    }

    const examId = editingExam ? editingExam.id : formData.id || `exam_${Date.now()}`;

    try {
      await saveExam(
        examId,
        {
          title: formData.title,
          category: formData.category,
          passingScore: formData.passingScore,
          timeLimit: formData.timeLimit,
          order: formData.order,
          questions: formData.questions
        },
        currentUser?.uid,
        currentUser?.email
      );
      
      await loadExams();
      setShowForm(false);
      toast.success('Exam saved');
    } catch (error) {
      console.error('Error saving exam:', error);
      toast.error(error?.message || 'Failed to save exam');
    }
  };

  const handleDeleteExam = async () => {
    if (!examToDelete) return;

    try {
      await deleteExam(
        examToDelete.id,
        currentUser?.uid,
        currentUser?.email,
        examToDelete.title
      );
      await loadExams();
      toast.success('Exam deleted');
    } catch (error) {
      console.error('Error deleting exam:', error);
      toast.error(error?.message || 'Failed to delete exam');
    } finally {
      setShowDeleteConfirm(false);
      setExamToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-management">
        <div className="loading-container">
          <p>Loading exams...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-management">
      <div className="management-header">
        <Link to="/admin" className="back-button">← Back to Dashboard</Link>
        <h1>🎓 Exam Management</h1>
        <p>Create, edit, and delete proficiency exams</p>
      </div>

      <div className="management-controls card">
        <button className="btn-primary" onClick={handleCreateNew}>
          + Create New Exam
        </button>
        <div className="management-stats">
          <span>Total Exams: <strong>{exams.length}</strong></span>
        </div>
      </div>

      <div className="management-grid">
        {exams.map((exam) => (
          <div key={exam.id} className="management-item card">
            <div className="item-header">
              <div>
                <span className="exam-order-badge">#{exam.order || '?'}</span>
                <h3>{exam.title || 'Untitled Exam'}</h3>
              </div>
              <span className="badge exam">
                {exam.passingScore || 80}% to pass
              </span>
            </div>
            <div className="item-details">
              <p><strong>Category:</strong> {exam.category || 'N/A'}</p>
              <p><strong>Questions:</strong> {exam.questions?.length || 0}</p>
              <p><strong>Time Limit:</strong> {exam.timeLimit || 30} minutes</p>
            </div>
            <div className="item-actions">
              <button className="btn-secondary" onClick={() => handleEdit(exam)}>
                Edit
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  setExamToDelete(exam);
                  setShowDeleteConfirm(true);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {exams.length === 0 && (
        <div className="no-results card">
          <p>No exams found. Create your first exam!</p>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content modal-large card" onClick={(e) => e.stopPropagation()}>
            <h2>{editingExam ? 'Edit Exam' : 'Create New Exam'}</h2>
            
            <div className="form-group">
              <label>Exam Title:</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter exam title"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category:</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <option value="alphabet">Alphabet</option>
                  <option value="greetings">Greetings</option>
                  <option value="numbers">Numbers</option>
                  <option value="daily-conversation">Daily Conversation</option>
                  <option value="common">Common Words</option>
                  <option value="comprehensive">Comprehensive</option>
                </select>
              </div>

              <div className="form-group">
                <label>Passing Score (%):</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.passingScore}
                  onChange={(e) => setFormData({ ...formData, passingScore: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Time Limit (minutes):</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={formData.timeLimit}
                  onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) })}
                />
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
                  💡 Lower numbers appear first. Users must pass exams in order.
                </small>
              </div>
            </div>

            <div className="questions-section">
              <div className="questions-header-sticky">
                <h3>Questions ({formData.questions.length})</h3>
                <button 
                  type="button"
                  className="btn-secondary btn-small"
                  onClick={() => setShowAddQuestionForm(!showAddQuestionForm)}
                >
                  {showAddQuestionForm ? '− Hide Form' : '+ Add Question'}
                </button>
              </div>
              
              {showAddQuestionForm && (
              <div className="add-question-form">
                <div className="form-group">
                  <label>Question:</label>
                  <input
                    type="text"
                    value={currentQuestion.question}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, question: e.target.value })}
                    placeholder="Enter question"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Image URL (optional):</label>
                    <input
                      type="text"
                      value={currentQuestion.imageUrl}
                      onChange={(e) => setCurrentQuestion({ ...currentQuestion, imageUrl: e.target.value })}
                      placeholder="https://example.com/sign-image.jpg"
                    />
                  </div>

                  <div className="form-group">
                    <label>Hand Icon:</label>
                    <div className="icon-selector">
                      {['✋', '👋', '🤙', '🤘', '👌', '✌️', '🤞', '🫰', '🤟', '🫶'].map((icon) => (
                        <button
                          key={icon}
                          type="button"
                          className={`icon-button ${currentQuestion.handIcon === icon ? 'selected' : ''}`}
                          onClick={() => setCurrentQuestion({ ...currentQuestion, handIcon: icon })}
                        >
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {currentQuestion.imageUrl && (
                  <div className="image-preview">
                    <img src={currentQuestion.imageUrl} alt="Question preview" onError={(e) => e.target.style.display = 'none'} />
                  </div>
                )}

                <div className="form-group">
                  <label>Options (Select the correct answer):</label>
                  {currentQuestion.options.map((option, index) => (
                    <div key={index} className="option-input-row">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={currentQuestion.answer === option && option !== ''}
                        onChange={() => setCurrentQuestion({ ...currentQuestion, answer: option })}
                        disabled={!option.trim()}
                      />
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => {
                          const newOptions = [...currentQuestion.options];
                          newOptions[index] = e.target.value;
                          const newQuestion = { ...currentQuestion, options: newOptions };
                          // If this was the selected answer and it's being changed, update the answer
                          if (currentQuestion.answer === option) {
                            newQuestion.answer = e.target.value;
                          }
                          setCurrentQuestion(newQuestion);
                        }}
                        placeholder={`Option ${index + 1}`}
                        className="option-input"
                      />
                    </div>
                  ))}
                  <small style={{ color: '#666', marginTop: '8px', display: 'block' }}>
                    💡 Fill in the options, then select the correct answer using the radio button
                  </small>
                </div>

                <button className="btn-secondary" onClick={handleAddQuestion}>
                  ✓ Add Question
                </button>
              </div>
              )}
              
              {formData.questions.length > 0 && (
              <div className="questions-summary">
                <p>✓ {formData.questions.length} question{formData.questions.length !== 1 ? 's' : ''} added</p>
              </div>
              )}

              <div className="questions-list" style={{ maxHeight: showAddQuestionForm ? '250px' : '400px' }}>
                {formData.questions.map((q, index) => (
                  <div key={index} className="question-item">
                    <div className="question-content">
                      <div className="question-header-row">
                        <strong>Q{index + 1}:</strong> 
                        {q.handIcon && <span className="hand-icon-display">{q.handIcon}</span>}
                        {q.imageUrl && <span className="image-indicator">🖼️</span>}
                      </div>
                      <p>{q.question}</p>
                      {q.imageUrl && (
                        <div className="question-thumbnail">
                          <img src={q.imageUrl} alt="Question" />
                        </div>
                      )}
                      <small><strong>Answer:</strong> {q.answer}</small>
                      <br />
                      <small><strong>Options:</strong> {q.options.join(', ')}</small>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexDirection: 'column' }}>
                      <button
                        className="btn-small btn-secondary"
                        onClick={() => handleEditQuestion(index)}
                        title="Edit this question"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        className="btn-small btn-danger"
                        onClick={() => handleRemoveQuestion(index)}
                        title="Remove this question"
                      >
                        🗑️ Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-actions">
              <button className="btn-primary" onClick={handleSaveExam}>
                {editingExam ? 'Update Exam' : 'Create Exam'}
              </button>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && examToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h2>⚠️ Confirm Delete</h2>
            <p>Are you sure you want to delete this exam:</p>
            <p><strong>{examToDelete.title}</strong>?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={handleDeleteExam}>
                Delete Exam
              </button>
              <button className="btn-secondary" onClick={() => {
                setShowDeleteConfirm(false);
                setExamToDelete(null);
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

export default ExamManagement;
