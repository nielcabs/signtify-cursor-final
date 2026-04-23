import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import '../styles/pages/Dictionary.css';

const alphabetSvgModules = import.meta.glob('../../ASL pics/Alphabets_SVG/*.svg*', {
  eager: true,
  import: 'default'
});

const alphabetSvgMap = Object.entries(alphabetSvgModules).reduce((acc, [path, assetUrl]) => {
  const fileName = path.split('/').pop() || '';
  const letterMatch = fileName.match(/[A-Z]/);
  if (letterMatch) {
    acc[letterMatch[0]] = assetUrl;
  }
  return acc;
}, {});

function Dictionary() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();

  const dictionaryData = [
    // Alphabet
    ...Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ').map(letter => ({
      word: letter,
      category: 'Alphabet',
      description: `Sign language representation of the letter ${letter}`
    })),
    // Greetings
    { word: 'Hello', category: 'Greetings', description: 'A friendly greeting' },
    { word: 'Goodbye', category: 'Greetings', description: 'Farewell gesture' },
    { word: 'Thank You', category: 'Greetings', description: 'Expression of gratitude' },
    { word: 'Please', category: 'Greetings', description: 'Polite request' },
    { word: 'Sorry', category: 'Greetings', description: 'Apology gesture' },
    { word: 'Good Morning', category: 'Greetings', description: 'Morning greeting' },
    { word: 'Good Night', category: 'Greetings', description: 'Evening farewell' },
    { word: 'How are you?', category: 'Greetings', description: 'Inquiry about wellbeing' },
    { word: 'Nice to meet you', category: 'Greetings', description: 'Greeting for first meeting' },
    { word: 'Yes', category: 'Common', description: 'Affirmative response' },
    { word: 'No', category: 'Common', description: 'Negative response' },
    { word: 'Help', category: 'Common', description: 'Request for assistance' },
    { word: 'Welcome', category: 'Greetings', description: 'Welcoming gesture' },
    { word: 'Excuse me', category: 'Greetings', description: 'Polite interruption' },
    { word: 'See you later', category: 'Greetings', description: 'Casual farewell' },
    // Common words
    { word: 'Family', category: 'Common', description: 'Relatives and loved ones' },
    { word: 'Friend', category: 'Common', description: 'Close companion' },
    { word: 'Love', category: 'Emotions', description: 'Deep affection' },
    { word: 'Happy', category: 'Emotions', description: 'Feeling of joy' },
    { word: 'Sad', category: 'Emotions', description: 'Feeling of sorrow' },
    { word: 'Angry', category: 'Emotions', description: 'Feeling of anger' },
    { word: 'Eat', category: 'Actions', description: 'Consuming food' },
    { word: 'Drink', category: 'Actions', description: 'Consuming liquid' },
    { word: 'Sleep', category: 'Actions', description: 'Resting state' },
    { word: 'Walk', category: 'Actions', description: 'Moving on foot' },
    { word: 'Run', category: 'Actions', description: 'Moving quickly' },
    { word: 'Stop', category: 'Actions', description: 'Cease movement' },
    { word: 'Go', category: 'Actions', description: 'Move forward' },
    { word: 'Come', category: 'Actions', description: 'Move toward' },
    { word: 'Home', category: 'Places', description: 'Place of residence' },
    { word: 'School', category: 'Places', description: 'Educational institution' },
    { word: 'Work', category: 'Places', description: 'Place of employment' },
    { word: 'Today', category: 'Time', description: 'Current day' },
    { word: 'Tomorrow', category: 'Time', description: 'Next day' },
    { word: 'Yesterday', category: 'Time', description: 'Previous day' },
    { word: 'Now', category: 'Time', description: 'Present moment' },
    { word: 'Later', category: 'Time', description: 'Future time' },
  ];

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedWord, setSelectedWord] = useState(null);

  // Dictionary is now fully accessible without exam restrictions.
  const allowedData = dictionaryData;
  const categories = ['All', ...new Set(allowedData.map(item => item.category))];

  const filteredData = allowedData.filter(item => {
    const matchesSearch = item.word.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getAlphabetImage = (word, category) => {
    if (category !== 'Alphabet') return null;
    return alphabetSvgMap[word] || null;
  };

  if (!currentUser) {
    navigate('/');
    return null;
  }

  return (
    <div className="dictionary-page">
      <div className="dictionary-header">
        <h1>Sign Language Dictionary</h1>
        <p>Browse and search sign language words and categories.</p>
      </div>

      <div className="dictionary-controls card">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search for a word or sign..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="category-filters">
          {categories.map(category => (
            <button
              key={category}
              className={`filter-button ${selectedCategory === category ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category)}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      <div className="dictionary-content">
        <div className="words-list">
          <div className="words-grid">
            {filteredData.map((item, index) => (
              <div
                key={index}
                className={`word-card card ${selectedWord === item ? 'active' : ''}`}
                onClick={() => setSelectedWord(item)}
              >
                <div className="word-icon">
                  {getAlphabetImage(item.word, item.category) ? (
                    <img
                      src={getAlphabetImage(item.word, item.category)}
                      alt={`ASL ${item.word}`}
                      className="dictionary-alphabet-icon"
                    />
                  ) : (
                    item.category === 'Alphabet' ? '✋' : '👋'
                  )}
                </div>
                <h3>{item.word}</h3>
                <span className="word-category">{item.category}</span>
              </div>
            ))}
          </div>

          {filteredData.length === 0 && (
            <div className="no-results">
              <p>No words found matching your search.</p>
            </div>
          )}
        </div>

        {selectedWord && (
          <div className="word-detail card">
            <button className="close-button" onClick={() => setSelectedWord(null)}>×</button>
            <h2>{selectedWord.word}</h2>
            <span className="detail-category">{selectedWord.category}</span>
            
            <div className="sign-visual">
              <div className="sign-placeholder">
                {getAlphabetImage(selectedWord.word, selectedWord.category) ? (
                  <img
                    src={getAlphabetImage(selectedWord.word, selectedWord.category)}
                    alt={`Sign for ${selectedWord.word}`}
                    className="dictionary-alphabet-detail-image"
                  />
                ) : (
                  selectedWord.category === 'Alphabet' ? '✋' : '👋'
                )}
                <p>Sign for "{selectedWord.word}"</p>
              </div>
            </div>

            <div className="word-description">
              <h3>Description</h3>
              <p>{selectedWord.description}</p>
            </div>

            <div className="word-actions">
              <button>Practice This Sign</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Dictionary;
