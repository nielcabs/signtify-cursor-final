import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import '../styles/pages/Home.css';

function Home() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  return (
    <div className="home">
      {/* Hero Section */}
      <section className={`hero ${isVisible ? 'fade-in' : ''}`}>
        <div className="hero-content">
          <div className="hero-text">
            <h1 className="hero-title">
              The free, fun, and effective way to learn <span className="highlight">sign language!</span>
            </h1>
            <div className="hero-buttons">
              <Link to="/lessons/alphabet">
                <button className="cta-button primary">GET STARTED</button>
              </Link>
              <Link to="/dictionary">
                <button className="cta-button secondary-outline">EXPLORE DICTIONARY</button>
              </Link>
            </div>
          </div>
          <div className="hero-illustration">
            <div className="illustration-container">
              <div className="hand-icon">✋</div>
              <div className="floating-signs">
                <span className="sign sign-1">👋</span>
                <span className="sign sign-2">🤟</span>
                <span className="sign sign-3">👌</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Signtify Section */}
      <section className="why-section">
        <h2 className="section-title">Why learn with Signtify?</h2>
        <div className="why-grid">
          <div className="why-card">
            <div className="why-icon" style={{backgroundColor: '#58CC02'}}>📚</div>
            <h3>Effective and efficient</h3>
            <p>Learning sign language with Signtify is fun and research shows it works! With quick, bite-sized lessons, you'll master signs in no time.</p>
          </div>
          
          <div className="why-card">
            <div className="why-icon" style={{backgroundColor: '#FF9600'}}>🎮</div>
            <h3>Engaging and fun</h3>
            <p>Master sign language through interactive games, quizzes, and challenges. Our lessons are designed to be addictive and enjoyable!</p>
          </div>
          
          <div className="why-card">
            <div className="why-icon" style={{backgroundColor: '#1CB0F6'}}>🏆</div>
            <h3>Track your progress</h3>
            <p>Set goals, earn achievements, and watch your skills improve. Take proficiency exams to certify your sign language abilities.</p>
          </div>
        </div>
      </section>

      {/* Features Showcase */}
      <section className="features-showcase">
        <div className="feature-row">
          <div className="feature-visual">
            <div className="feature-box">
              <span className="feature-emoji">✋👋🤟</span>
            </div>
          </div>
          <div className="feature-description">
            <h2>Learn the fundamentals</h2>
            <p>Start with the alphabet and progress to common greetings and phrases. Our structured lessons make it easy to build a strong foundation in sign language.</p>
            <Link to="/lessons/alphabet">
              <button className="feature-cta">START LESSONS →</button>
            </Link>
          </div>
        </div>

        <div className="feature-row reverse">
          <div className="feature-description">
            <h2>Practice makes perfect</h2>
            <p>Test your knowledge with interactive quizzes and practice sessions. Get instant feedback and track your improvement over time.</p>
            <Link to="/mini-quiz/alphabet">
              <button className="feature-cta">TRY A QUIZ →</button>
            </Link>
          </div>
          <div className="feature-visual">
            <div className="feature-box blue">
              <span className="feature-emoji">✏️📝✅</span>
            </div>
          </div>
        </div>

        <div className="feature-row">
          <div className="feature-visual">
            <div className="feature-box orange">
              <span className="feature-emoji">🎓📖🏅</span>
            </div>
          </div>
          <div className="feature-description">
            <h2>Certify your skills</h2>
            <p>Take proficiency exams to validate your sign language abilities. Each exam shows its passing score—meet it to unlock the next and showcase your progress!</p>
            <Link to="/proficiency-exams">
              <button className="feature-cta">VIEW EXAMS →</button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="stats-section">
        <div className="stats-container">
          <div className="stat-item">
            <div className="stat-number">26</div>
            <div className="stat-label">Alphabet Signs</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">20+</div>
            <div className="stat-label">Greetings</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">100+</div>
            <div className="stat-label">Dictionary Words</div>
          </div>
          <div className="stat-item">
            <div className="stat-number">∞</div>
            <div className="stat-label">Possibilities</div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="final-cta">
        <h2>Ready to start your sign language journey?</h2>
        <p>Join thousands learning sign language the fun way!</p>
        <Link to="/lessons/alphabet">
          <button className="cta-button large">GET STARTED FOR FREE</button>
        </Link>
      </section>
    </div>
  );
}

export default Home;
