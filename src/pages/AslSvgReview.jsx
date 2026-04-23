import { useMemo, useState } from 'react';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const STORAGE_KEY = 'asl-svg-review-v1';

const BASE_CHECKLIST = [
  'Palm orientation looks correct',
  'Correct fingers are extended vs folded',
  'Thumb placement matches ASL handshape',
  'Shape is distinct from common look-alikes',
];

const LETTER_NOTES = {
  A: 'Closed fist, thumb alongside index side (not tucked across fingers).',
  B: 'Four fingers straight up together, thumb folded across palm.',
  C: 'Curved hand clearly forms a C arc.',
  D: 'Index up, thumb touching middle finger (ring+pinky folded).',
  E: 'Fingers folded to thumb; fingertips near thumb base.',
  F: 'Index and thumb make a circle; other three fingers up.',
  G: 'Index and thumb horizontal/parallel, close together.',
  H: 'Index + middle extended together horizontally.',
  I: 'Only pinky up.',
  J: 'Starts like I, includes motion path for letter J.',
  K: 'Index + middle up with split, thumb between bases.',
  L: 'Index up + thumb out, making L.',
  M: 'Thumb tucked under three fingers.',
  N: 'Thumb tucked under two fingers.',
  O: 'All fingertips touching thumb to form O.',
  P: 'K-shape angled downward.',
  Q: 'G-shape angled downward.',
  R: 'Index and middle crossed.',
  S: 'Fist with thumb wrapped in front of fingers.',
  T: 'Thumb tucked between index and middle fingers.',
  U: 'Index + middle together upright.',
  V: 'Index + middle separated in V.',
  W: 'Index + middle + ring extended.',
  X: 'Index bent like a hook; others folded.',
  Y: 'Thumb + pinky extended; others folded.',
  Z: 'Index traces a Z motion path.',
};

const CONFUSION_WARNINGS = {
  G: ['Q'],
  Q: ['G'],
  K: ['P', 'V'],
  P: ['K'],
  M: ['N', 'T'],
  N: ['M', 'T'],
  T: ['M', 'N'],
  U: ['V', 'W'],
  V: ['U', 'K'],
  W: ['U', 'V'],
  J: ['I'],
  Z: ['D'],
};

const MOTION_LETTERS = new Set(['J', 'Z']);

function readSavedReviews() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function AslSvgReview() {
  const [reviews, setReviews] = useState(readSavedReviews);

  const stats = useMemo(() => {
    let ok = 0;
    let needsFix = 0;
    LETTERS.forEach((letter) => {
      const status = reviews?.[letter]?.status || 'unknown';
      if (status === 'ok') ok += 1;
      if (status === 'fix') needsFix += 1;
    });
    return {
      total: LETTERS.length,
      reviewed: ok + needsFix,
      ok,
      needsFix,
      pending: LETTERS.length - (ok + needsFix),
    };
  }, [reviews]);

  const updateReview = (letter, patch) => {
    setReviews((prev) => {
      const next = {
        ...prev,
        [letter]: {
          status: prev?.[letter]?.status || 'unknown',
          note: prev?.[letter]?.note || '',
          ...patch,
        },
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const resetAll = () => {
    localStorage.removeItem(STORAGE_KEY);
    setReviews({});
  };

  return (
    <div style={{ padding: 20, maxWidth: 1300, margin: '0 auto' }}>
      <h1 style={{ marginBottom: 8 }}>ASL SVG Review</h1>
      <p style={{ marginTop: 0, color: '#555' }}>
        Audit each letter image against known ASL handshape cues. Mark issues and leave notes for replacement.
      </p>

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: '#fff',
          borderRadius: 12,
          padding: 12,
          marginBottom: 16,
        }}
      >
        <strong>Progress:</strong>
        <span>Reviewed {stats.reviewed}/{stats.total}</span>
        <span style={{ color: '#1e7e34' }}>Looks correct: {stats.ok}</span>
        <span style={{ color: '#b26a00' }}>Needs replacement: {stats.needsFix}</span>
        <span style={{ color: '#666' }}>Pending: {stats.pending}</span>
        <button onClick={resetAll} style={{ marginLeft: 'auto', padding: '8px 12px' }}>
          Reset all reviews
        </button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {LETTERS.map((letter) => {
          const record = reviews?.[letter] || { status: 'unknown', note: '' };
          const warnings = CONFUSION_WARNINGS[letter] || [];

          return (
            <div
              key={letter}
              style={{
                display: 'grid',
                gridTemplateColumns: '160px 1fr',
                gap: 14,
                background: '#fff',
                borderRadius: 12,
                padding: 12,
                border:
                  record.status === 'ok'
                    ? '1px solid #95d5a6'
                    : record.status === 'fix'
                      ? '1px solid #f1c27d'
                      : '1px solid #ececec',
              }}
            >
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>{letter}</div>
                <img
                  src={`/asl/${letter}.svg`}
                  alt={`ASL ${letter}`}
                  style={{
                    width: 140,
                    height: 170,
                    objectFit: 'contain',
                    background: '#f7f7f7',
                    borderRadius: 8,
                    border: '1px solid #eee',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ color: '#333' }}>
                  <strong>Expected cue:</strong> {LETTER_NOTES[letter]}
                </div>

                {MOTION_LETTERS.has(letter) && (
                  <div style={{ color: '#8a4f00' }}>
                    <strong>Motion required:</strong> {letter} should include directional movement cue.
                  </div>
                )}

                {warnings.length > 0 && (
                  <div style={{ color: '#7a5a00' }}>
                    <strong>Common confusion:</strong> {warnings.join(', ')}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#555', fontSize: 13 }}>
                  {BASE_CHECKLIST.map((item) => (
                    <span key={item} style={{ background: '#f4f4f4', padding: '4px 8px', borderRadius: 14 }}>
                      {item}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <label htmlFor={`status-${letter}`}>Status:</label>
                  <select
                    id={`status-${letter}`}
                    value={record.status}
                    onChange={(e) => updateReview(letter, { status: e.target.value })}
                    style={{ padding: '6px 8px' }}
                  >
                    <option value="unknown">Not reviewed</option>
                    <option value="ok">Looks correct</option>
                    <option value="fix">Needs replacement</option>
                  </select>
                </div>

                <textarea
                  value={record.note}
                  onChange={(e) => updateReview(letter, { note: e.target.value })}
                  rows={2}
                  placeholder={`Notes for ${letter} (what is wrong / what to replace)`}
                  style={{ width: '100%', padding: 8, resize: 'vertical' }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AslSvgReview;
