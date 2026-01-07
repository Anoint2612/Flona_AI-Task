import { useState } from 'react';
import './App.css';

const API_URL = 'http://localhost:3000/api';

function App() {
  const [aRollFile, setARollFile] = useState(null);
  const [aRollMetadata, setARollMetadata] = useState('');
  const [bRolls, setBRolls] = useState([{ id: 'broll_1', file: null, metadata: '' }]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const addBRoll = () => {
    const newId = `broll_${bRolls.length + 1}`;
    setBRolls([...bRolls, { id: newId, file: null, metadata: '' }]);
  };

  const updateBRoll = (index, field, value) => {
    const updated = [...bRolls];
    updated[index][field] = value;
    setBRolls(updated);
  };

  const removeBRoll = (index) => {
    setBRolls(bRolls.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // For demo, we'll use the provided URLs from video_url.json
      // In production, you'd upload files and get URLs
      const payload = {
        a_roll: {
          url: 'https://fzuudapb1wvjxbrr.public.blob.vercel-storage.com/food_quality_ugc/a_roll.mp4',
          metadata: aRollMetadata || 'Young Indian woman (mid-20s) with a calm, aware tone, speaking in Hinglish, delivering a food-quality awareness message.'
        },
        b_rolls: bRolls.map((broll, index) => ({
          id: broll.id,
          url: `https://fzuudapb1wvjxbrr.public.blob.vercel-storage.com/food_quality_ugc/${broll.id}.mp4`,
          metadata: broll.metadata || `B-roll ${index + 1} description`
        }))
      };

      const response = await fetch(`${API_URL}/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Fetch the results
      const assetId = data.asset_id;
      const [transcript, plan, manifest] = await Promise.all([
        fetch(`${API_URL}/asset/${assetId}/transcript`).then(r => r.json()).catch(() => null),
        fetch(`${API_URL}/asset/${assetId}/plan`).then(r => r.json()).catch(() => null),
        fetch(`${API_URL}/asset/${assetId}/manifest`).then(r => r.json()).catch(() => null)
      ]);

      setResult({ assetId, transcript, plan, manifest });
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header>
        <h1>🎬 AI B-Roll Insertion System</h1>
        <p>Automatically match and insert B-roll clips into your A-roll video</p>
      </header>

      <div className="container">
        <form onSubmit={handleSubmit}>
          <section className="upload-section">
            <h2>📹 A-Roll Video</h2>
            <div className="form-group">
              <label>Description/Metadata:</label>
              <textarea
                value={aRollMetadata}
                onChange={(e) => setARollMetadata(e.target.value)}
                placeholder="Describe what happens in the A-roll video..."
                rows="3"
              />
              <small>Using demo video from cloud storage</small>
            </div>
          </section>

          <section className="upload-section">
            <h2>🎞️ B-Roll Clips</h2>
            {bRolls.map((broll, index) => (
              <div key={broll.id} className="broll-item">
                <h3>{broll.id}</h3>
                <div className="form-group">
                  <label>Description/Metadata:</label>
                  <textarea
                    value={broll.metadata}
                    onChange={(e) => updateBRoll(index, 'metadata', e.target.value)}
                    placeholder="Describe what this B-roll shows..."
                    rows="2"
                  />
                </div>
                {bRolls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBRoll(index)}
                    className="btn-remove"
                  >
                    Remove
                  </button>
                )}
              </div>
            ))}
            <button type="button" onClick={addBRoll} className="btn-add">
              + Add B-Roll
            </button>
          </section>

          <button type="submit" disabled={loading} className="btn-submit">
            {loading ? '⏳ Processing...' : '🚀 Generate Plan'}
          </button>
        </form>

        {error && (
          <div className="error">
            <h3>❌ Error</h3>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className="results">
            <h2>✅ Results</h2>
            <p className="asset-id">Asset ID: <code>{result.assetId}</code></p>

            {result.transcript && (
              <section className="result-section">
                <h3>📝 Transcript</h3>
                <div className="transcript">
                  {result.transcript.map((segment) => (
                    <div key={segment.id} className="transcript-segment">
                      <span className="timestamp">
                        [{segment.start.toFixed(2)}s - {segment.end.toFixed(2)}s]
                      </span>
                      <span className="text">{segment.text}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {result.plan && (
              <section className="result-section">
                <h3>🎯 B-Roll Insertion Plan</h3>
                <div className="plan">
                  {result.plan.map((insertion, index) => (
                    <div key={index} className="insertion">
                      <div className="insertion-header">
                        <h4>Insertion #{index + 1}</h4>
                        <span className="score">
                          {(insertion.similarity_score * 100).toFixed(1)}% match
                        </span>
                      </div>
                      <div className="insertion-details">
                        <p>
                          <strong>Time:</strong> {insertion.start_sec.toFixed(2)}s -
                          {(insertion.start_sec + insertion.duration_sec).toFixed(2)}s
                          ({insertion.duration_sec}s duration)
                        </p>
                        <p><strong>B-Roll:</strong> {insertion.broll_id}</p>
                        <p className="explanation">{insertion.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {result.manifest && (
              <section className="result-section">
                <h3>📊 Video Info</h3>
                <div className="manifest">
                  <p>
                    <strong>Duration:</strong>{' '}
                    {result.manifest.a_roll.technical_metadata?.duration}s
                  </p>
                  <p>
                    <strong>Resolution:</strong>{' '}
                    {result.manifest.a_roll.technical_metadata?.resolution}
                  </p>
                  <p>
                    <strong>FPS:</strong>{' '}
                    {result.manifest.a_roll.technical_metadata?.fps}
                  </p>
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
