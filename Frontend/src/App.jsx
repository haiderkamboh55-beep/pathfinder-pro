import React, { useState } from 'react';
import axios from 'axios';

export default function App() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSuggest = async () => {
    setLoading(true);
    // This matches the UserProfile schema in your backend models.py
    const mockData = {
      skills: ["React", "Python", "FastAPI"],
      holland_code: "I",
      gad_score: 5,
      phq_score: 3
    };

    try {
      const res = await axios.post("http://localhost:8000/recommend", mockData);
      setResults(res.data);
    } catch (err) {
      console.error(err);
      alert("Check if Backend is running at port 8000!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '40px', fontFamily: 'Arial' }}>
      <h1>PathFinder Pro: AI Career Navigator</h1>
      <button 
        onClick={handleSuggest}
        style={{ padding: '10px 20px', background: '#007bff', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
      >
        {loading ? "AI is Analyzing..." : "Get AI Career Suggestions"}
      </button>

      <div style={{ marginTop: '30px', display: 'grid', gap: '20px' }}>
        {results.map((job, i) => (
          <div key={i} style={{ border: '1px solid #ddd', padding: '20px', borderRadius: '10px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
            <h3>{job.job_title} ({job.match_percentage}%)</h3>
            <p>{job.reasoning}</p>
            <div style={{ color: 'red', fontSize: '12px' }}>Gap: {job.skill_gaps.join(', ')}</div>
          </div>
        ))}
      </div>
    </div>
  );
}