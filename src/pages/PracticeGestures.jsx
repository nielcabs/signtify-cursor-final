import { useState } from 'react';
import '../styles/pages/PracticeGestures.css';

function PracticeGestures() {
  const practiceCategories = [
    {
      name: 'Alphabet',
      items: Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map(letter => ({
        sign: letter,
        type: 'letter'
      }))
    },
    {
      name: 'Greetings',
      items: [
        { sign: 'Hello', type: 'greeting' },
        { sign: 'Goodbye', type: 'greeting' },
        { sign: 'Thank You', type: 'greeting' },
        { sign: 'Please', type: 'greeting' },
        { sign: 'Sorry', type: 'greeting' },
        { sign: 'Good Morning', type: 'greeting' },
        { sign: 'Good Night', type: 'greeting' },
        { sign: 'How are you?', type: 'greeting' },
      ]
    },
    {
      name: 'Common Words',
      items: [
        { sign: 'Yes', type: 'word' },
        { sign: 'No', type: 'word' },
        { sign: 'Help', type: 'word' },
        { sign: 'Family', type: 'word' },
        { sign: 'Friend', type: 'word' },
        { sign: 'Love', type: 'word' },
        { sign: 'Happy', type: 'word' },
        { sign: 'Sad', type: 'word' },
      ]
    }
  ];

  const [selectedCategory, setSelectedCategory] = useState('Alphabet');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPracticing, setIsPracticing] = useState(false);
  const [practiceMode, setPracticeMode] = useState('manual'); // manual or auto

  const currentCategory = practiceCategories.find(cat => cat.name === selectedCategory);
  const currentSign = currentCategory?.items[currentIndex];

  const handleNext = () => {
    if (currentIndex < currentCategory.items.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      setCurrentIndex(currentCategory.items.length - 1);
    }
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setCurrentIndex(0);
    setIsPracticing(false);
  };

  const startPractice = () => {
    setIsPracticing(true);
    setCurrentIndex(0);
  };

  const stopPractice = () => {
    setIsPracticing(false);
  };

  return (
    <div className="practice-page">
      <div className="practice-header">
        <h1>Practice Gestures</h1>
        <p>Practice sign language gestures at your own pace</p>
      </div>

      <div className="practice-controls card">
        <div className="category-selector">
          <h3>Select Category</h3>
          <div className="category-buttons">
            {practiceCategories.map(category => (
              <button
                key={category.name}
                className={`category-btn ${selectedCategory === category.name ? 'active' : ''}`}
                onClick={() => handleCategoryChange(category.name)}
              >
                {category.name}
                <span className="item-count">({category.items.length})</span>
              </button>
            ))}
          </div>
        </div>

        <div className="practice-mode">
          <h3>Practice Mode</h3>
          <div className="mode-buttons">
            <button
              className={`mode-btn ${practiceMode === 'manual' ? 'active' : ''}`}
              onClick={() => setPracticeMode('manual')}
            >
              Manual
            </button>
            <button
              className={`mode-btn ${practiceMode === 'auto' ? 'active' : ''}`}
              onClick={() => setPracticeMode('auto')}
            >
              Auto-Play
            </button>
          </div>
        </div>
      </div>

      <div className="practice-area">
        <div className="sign-display-large card">
          <div className="progress-indicator">
            <span>{currentIndex + 1} / {currentCategory?.items.length}</span>
          </div>

          <div className="current-sign">
            <div className="sign-visual-large">
              <div className="sign-placeholder-large">
                {currentSign?.type === 'letter' ? '✋' : '👋'}
              </div>
            </div>
            <h2>{currentSign?.sign}</h2>
            <p className="sign-type">{currentSign?.type}</p>
          </div>

          <div className="practice-navigation">
            <button onClick={handlePrevious} className="nav-btn">
              ← Previous
            </button>
            
            {!isPracticing ? (
              <button onClick={startPractice} className="practice-btn">
                Start Practice
              </button>
            ) : (
              <button onClick={stopPractice} className="practice-btn secondary">
                Stop Practice
              </button>
            )}
            
            <button onClick={handleNext} className="nav-btn">
              Next →
            </button>
          </div>
        </div>

        <div className="practice-tips card">
          <h3>💡 Practice Tips</h3>
          <ul>
            <li>Practice each sign slowly and deliberately</li>
            <li>Focus on hand shape, position, and movement</li>
            <li>Use a mirror to check your form</li>
            <li>Repeat each sign multiple times</li>
            <li>Practice regularly for best results</li>
          </ul>
        </div>
      </div>

      <div className="quick-reference">
        <h3>Quick Reference</h3>
        <div className="reference-grid">
          {currentCategory?.items.map((item, index) => (
            <button
              key={index}
              className={`reference-item ${currentIndex === index ? 'active' : ''}`}
              onClick={() => setCurrentIndex(index)}
            >
              {item.sign}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default PracticeGestures;
