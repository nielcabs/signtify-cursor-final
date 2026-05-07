import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getAllQuizzes, saveQuiz, deleteQuiz, getAllUsers } from '../../auth/adminUtils';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ui/Toast';
import { broadcastNotification, NOTIFICATION_TYPES } from '../../notifications/notifications';
import '../../styles/pages/AdminManagement.css';

function QuizManagement() {
  const { currentUser } = useAuth();
  const toast = useToast();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [quizToDelete, setQuizToDelete] = useState(null);
  const [showAddQuestionForm, setShowAddQuestionForm] = useState(true);

  const [formData, setFormData] = useState({
    id: '',
    title: '',
    category: 'alphabet',
    difficulty: 'easy',
    questions: []
  });

  const [currentQuestion, setCurrentQuestion] = useState({
    question: '',
    answer: '',
    imageUrl: '',
    handIcon: ''
  });

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      const quizzesData = await getAllQuizzes();
      setQuizzes(quizzesData);
    } catch (error) {
      console.error('Error loading quizzes:', error);
      toast.error('Failed to load quizzes');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = () => {
    setEditingQuiz(null);
    setFormData({
      id: '',
      title: '',
      category: 'alphabet',
      difficulty: 'easy',
      questions: []
    });
    setCurrentQuestion({
      question: '',
      answer: '',
      imageUrl: '',
      handIcon: ''
    });
    setShowAddQuestionForm(true);
    setShowForm(true);
  };

  const handleEdit = (quiz) => {
    setEditingQuiz(quiz);
    setFormData({
      id: quiz.id,
      title: quiz.title || '',
      category: quiz.category || 'alphabet',
      difficulty: quiz.difficulty || 'easy',
      questions: quiz.questions || []
    });
    setShowAddQuestionForm(quiz.questions && quiz.questions.length > 0 ? false : true);
    setShowForm(true);
  };

  const handleAddQuestion = () => {
    const prompt = currentQuestion.question.trim();
    const ans = currentQuestion.answer.trim();
    if (!prompt || !ans) {
      toast.warning('Fill in the question prompt and the correct sign to detect');
      return;
    }

    setFormData({
      ...formData,
      questions: [
        ...formData.questions,
        {
          question: prompt,
          answer: ans,
          options: [ans],
          imageUrl: (currentQuestion.imageUrl || '').trim(),
          handIcon: currentQuestion.handIcon || '',
        }
      ]
    });

    setCurrentQuestion({
      question: '',
      answer: '',
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

  const handleSaveQuiz = async () => {
    if (!formData.title || formData.questions.length === 0) {
      toast.warning('Please provide a title and at least one question');
      return;
    }

    const quizId = editingQuiz ? editingQuiz.id : formData.id || `quiz_${Date.now()}`;
    const isNew = !editingQuiz;

    try {
      await saveQuiz(
        quizId,
        {
          title: formData.title,
          category: formData.category,
          difficulty: formData.difficulty,
          questions: formData.questions.map((q) => {
            const ans = String(q.answer || '').trim();
            return { ...q, answer: ans, options: ans ? [ans] : [] };
          })
        },
        currentUser?.uid,
        currentUser?.email
      );

      // Notify all active users when a new quiz is created (non-blocking).
      if (isNew) {
        try {
          const usersList = await getAllUsers({ includeArchived: false });
          const uids = usersList.map((u) => u.id).filter(Boolean);
          await broadcastNotification(uids, {
            type: NOTIFICATION_TYPES.INFO,
            title: `📝 New quiz available: ${formData.title.trim()}`,
            message: 'A new quiz was added. Try it to test your progress.',
            link: '/quizzes',
            createdBy: currentUser?.uid || null,
            meta: { quizId, category: formData.category, difficulty: formData.difficulty },
          });
        } catch (e) {
          console.warn('Quiz create broadcast failed:', e?.message || e);
        }
      }
      
      await loadQuizzes();
      setShowForm(false);
      toast.success('Quiz saved');
    } catch (error) {
      console.error('Error saving quiz:', error);
      toast.error(error?.message || 'Failed to save quiz');
    }
  };

  const handleDeleteQuiz = async () => {
    if (!quizToDelete) return;

    try {
      await deleteQuiz(
        quizToDelete.id,
        currentUser?.uid,
        currentUser?.email,
        quizToDelete.title
      );
      await loadQuizzes();
      toast.success('Quiz deleted');
    } catch (error) {
      console.error('Error deleting quiz:', error);
      toast.error(error?.message || 'Failed to delete quiz');
    } finally {
      setShowDeleteConfirm(false);
      setQuizToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-management">
        <div className="loading-container">
          <p>Loading quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-management">
      <div className="management-header">
        <Link to="/admin" className="back-button">← Back to Dashboard</Link>
        <h1>📝 Quiz Management</h1>
        <p>Create, edit, and delete quizzes</p>
      </div>

      <div className="management-controls card">
        <button className="btn-primary" onClick={handleCreateNew}>
          + Create New Quiz
        </button>
        <div className="management-stats">
          <span>Total Quizzes: <strong>{quizzes.length}</strong></span>
        </div>
      </div>

      <div className="management-grid">
        {quizzes.map((quiz) => (
          <div key={quiz.id} className="management-item card">
            <div className="item-header">
              <h3>{quiz.title || 'Untitled Quiz'}</h3>
              <span className={`badge ${quiz.difficulty || 'easy'}`}>
                {quiz.difficulty || 'easy'}
              </span>
            </div>
            <div className="item-details">
              <p><strong>Category:</strong> {quiz.category || 'N/A'}</p>
              <p><strong>Questions:</strong> {quiz.questions?.length || 0}</p>
            </div>
            <div className="item-actions">
              <button className="btn-secondary" onClick={() => handleEdit(quiz)}>
                Edit
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  setQuizToDelete(quiz);
                  setShowDeleteConfirm(true);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {quizzes.length === 0 && (
        <div className="no-results card">
          <p>No quizzes found. Create your first quiz!</p>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal-content modal-large card" onClick={(e) => e.stopPropagation()}>
            <h2>{editingQuiz ? 'Edit Quiz' : 'Create New Quiz'}</h2>
            
            <div className="form-group">
              <label>Quiz Title:</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter quiz title"
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
                  <option value="common">Common Words</option>
                  <option value="emotions">Emotions</option>
                </select>
              </div>

              <div className="form-group">
                <label>Difficulty:</label>
                <select
                  value={formData.difficulty}
                  onChange={(e) => setFormData({ ...formData, difficulty: e.target.value })}
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
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

                <div className="exam-camera-hint" role="note">
                  <strong>Camera-based quiz</strong>
                  <p>
                    Learners perform the sign on camera. Enter the one label the detector should match (e.g. <strong>A</strong>, <strong>Hello</strong>, <strong>5</strong>).
                  </p>
                </div>

                <div className="form-group">
                  <label htmlFor="quiz-correct-sign-text">Correct sign to detect</label>
                  <input
                    id="quiz-correct-sign-text"
                    type="text"
                    value={currentQuestion.answer}
                    onChange={(e) => setCurrentQuestion({ ...currentQuestion, answer: e.target.value })}
                    placeholder="e.g. A, Hello, 5"
                    autoComplete="off"
                  />
                  <small className="field-hint-text">
                    Must match how the app names this sign (letters, common words, or numbers 0–10). This is the only label used for scoring.
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
                      <small><strong>Correct sign (camera):</strong> {q.answer}</small>
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
              <button className="btn-primary" onClick={handleSaveQuiz}>
                {editingQuiz ? 'Update Quiz' : 'Create Quiz'}
              </button>
              <button className="btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && quizToDelete && (
        <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
            <h2>⚠️ Confirm Delete</h2>
            <p>Are you sure you want to delete this quiz:</p>
            <p><strong>{quizToDelete.title}</strong>?</p>
            <p className="warning-text">This action cannot be undone.</p>
            <div className="modal-actions">
              <button className="btn-danger" onClick={handleDeleteQuiz}>
                Delete Quiz
              </button>
              <button className="btn-secondary" onClick={() => {
                setShowDeleteConfirm(false);
                setQuizToDelete(null);
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

export default QuizManagement;
