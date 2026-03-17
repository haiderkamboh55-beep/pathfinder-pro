import React, { useState } from 'react';

// Answer options for mental health assessments (standard GAD-7/PHQ-9 scale)
const FREQUENCY_OPTIONS = [
    { value: 0, label: "Not at all" },
    { value: 1, label: "Several days" },
    { value: 2, label: "More than half the days" },
    { value: 3, label: "Nearly every day" }
];

// ============================================================
// OFFICIAL STANDARDIZED GAD-7 QUESTIONS (Generalized Anxiety Disorder 7-item scale)
// Source: Spitzer RL, Kroenke K, Williams JBW, Löwe B. (2006)
// These are clinically validated and should NOT be modified
// ============================================================
const STANDARD_GAD7_QUESTIONS = [
    {
        id: 0,
        question: "Feeling nervous, anxious, or on edge",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 1,
        question: "Not being able to stop or control worrying",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 2,
        question: "Worrying too much about different things",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 3,
        question: "Trouble relaxing",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 4,
        question: "Being so restless that it's hard to sit still",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 5,
        question: "Becoming easily annoyed or irritable",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 6,
        question: "Feeling afraid as if something awful might happen",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    }
];

// ============================================================
// OFFICIAL STANDARDIZED PHQ-9 QUESTIONS (Patient Health Questionnaire 9-item)
// Source: Kroenke K, Spitzer RL, Williams JBW. (2001)
// These are clinically validated and should NOT be modified
// ============================================================
const STANDARD_PHQ9_QUESTIONS = [
    {
        id: 0,
        question: "Little interest or pleasure in doing things",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 1,
        question: "Feeling down, depressed, or hopeless",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 2,
        question: "Trouble falling or staying asleep, or sleeping too much",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 3,
        question: "Feeling tired or having little energy",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 4,
        question: "Poor appetite or overeating",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 5,
        question: "Feeling bad about yourself — or that you are a failure or have let yourself or your family down",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 6,
        question: "Trouble concentrating on things, such as reading the newspaper or watching television",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 7,
        question: "Moving or speaking so slowly that other people could have noticed? Or the opposite — being so fidgety or restless that you have been moving around a lot more than usual",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    },
    {
        id: 8,
        question: "Thoughts that you would be better off dead or of hurting yourself in some way",
        context: "Over the last 2 weeks, how often have you been bothered by the following?"
    }
];

const hollandTypes = [
    { code: 'R', name: 'Realistic', desc: 'Practical, hands-on problem-solving' },
    { code: 'I', name: 'Investigative', desc: 'Analytical, intellectual, scientific' },
    { code: 'A', name: 'Artistic', desc: 'Creative, expressive, original' },
    { code: 'S', name: 'Social', desc: 'Helping, teaching, counseling' },
    { code: 'E', name: 'Enterprising', desc: 'Leading, persuading, managing' },
    { code: 'C', name: 'Conventional', desc: 'Organizing, data management, detail-oriented' }
];

export default function AssessmentsPage({ profile, onProfileChange }) {
    const [activeTab, setActiveTab] = useState('holland');
    const [gadAnswers, setGadAnswers] = useState(Array(7).fill(0));
    const [phqAnswers, setPhqAnswers] = useState(Array(9).fill(0));

    const handleGadChange = (index, value) => {
        const newAnswers = [...gadAnswers];
        newAnswers[index] = parseInt(value);
        setGadAnswers(newAnswers);
        const total = newAnswers.reduce((a, b) => a + b, 0);
        onProfileChange?.('gadScore', total);
    };

    const handlePhqChange = (index, value) => {
        const newAnswers = [...phqAnswers];
        newAnswers[index] = parseInt(value);
        setPhqAnswers(newAnswers);
        const total = newAnswers.reduce((a, b) => a + b, 0);
        onProfileChange?.('phqScore', total);
    };

    const gadTotal = gadAnswers.reduce((a, b) => a + b, 0);
    const phqTotal = phqAnswers.reduce((a, b) => a + b, 0);

    const getGadLevel = (score) => {
        if (score <= 4) return { level: 'Minimal', color: 'green' };
        if (score <= 9) return { level: 'Mild', color: 'yellow' };
        if (score <= 14) return { level: 'Moderate', color: 'orange' };
        return { level: 'Severe', color: 'red' };
    };

    const getPhqLevel = (score) => {
        if (score <= 4) return { level: 'Minimal', color: 'green' };
        if (score <= 9) return { level: 'Mild', color: 'yellow' };
        if (score <= 14) return { level: 'Moderate', color: 'orange' };
        if (score <= 19) return { level: 'Moderately Severe', color: 'red' };
        return { level: 'Severe', color: 'red' };
    };

    return (
        <>
            <section className="page-hero compact">
                <div className="page-hero-content">
                    <span className="hero-badge">Psychological Profiling</span>
                    <h1>
                        Understand yourself
                        <span className="accent-gradient"> better</span>
                    </h1>
                    <p className="hero-description">
                        Complete these scientifically-validated assessments to help us recommend
                        careers that align with your personality and wellbeing.
                    </p>
                </div>
            </section>

            <section className="assessment-tabs">
                <button
                    className={`tab-btn ${activeTab === 'holland' ? 'active' : ''}`}
                    onClick={() => setActiveTab('holland')}
                >
                    🎯 Holland Code (RIASEC)
                </button>
                <button
                    className={`tab-btn ${activeTab === 'gad7' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gad7')}
                >
                    💚 GAD-7 Anxiety
                </button>
                <button
                    className={`tab-btn ${activeTab === 'phq9' ? 'active' : ''}`}
                    onClick={() => setActiveTab('phq9')}
                >
                    💙 PHQ-9 Depression
                </button>
            </section>

            {activeTab === 'holland' && (
                <section className="assessment-content">
                    <div className="card">
                        <div className="card-header">
                            <h2>Holland Code (RIASEC) Assessment</h2>
                            <p>Select up to 3 personality types that best describe your interests.</p>
                        </div>
                        <div className="card-body">
                            <div className="holland-grid">
                                {hollandTypes.map((type) => (
                                    <label key={type.code} className="holland-option">
                                        <input
                                            type="checkbox"
                                            checked={profile?.hollandCode?.includes(type.code) || false}
                                            onChange={(e) => {
                                                const current = profile?.hollandCode || '';
                                                if (e.target.checked && current.length < 3) {
                                                    onProfileChange?.('hollandCode', current + type.code);
                                                } else if (!e.target.checked) {
                                                    onProfileChange?.('hollandCode', current.replace(type.code, ''));
                                                }
                                            }}
                                        />
                                        <div className="holland-card">
                                            <span className="holland-code">{type.code}</span>
                                            <h4>{type.name}</h4>
                                            <p>{type.desc}</p>
                                        </div>
                                    </label>
                                ))}
                            </div>
                            <div className="assessment-result">
                                <span>Your Holland Code:</span>
                                <strong className="result-value">{profile?.hollandCode || 'Not selected'}</strong>
                            </div>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === 'gad7' && (
                <section className="assessment-content">
                    <div className="card">
                        <div className="card-header">
                            <h2>GAD-7 Anxiety Assessment</h2>
                            <p>Over the last 2 weeks, how often have you been bothered by the following?</p>
                        </div>
                        <div className="card-body">
                            <div className="personalization-note" style={{ marginBottom: '20px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                <span className="ai-badge">📋 Clinical Standard</span>
                                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    The GAD-7 is a validated clinical tool developed by Drs. Spitzer, Kroenke, Williams, and Löwe. It's used worldwide to assess generalized anxiety.
                                </p>
                            </div>
                            <div className="questionnaire">
                                {STANDARD_GAD7_QUESTIONS.map((q, index) => (
                                    <div key={index} className="question-row">
                                        <p className="question-text">{index + 1}. {q.question}</p>
                                        <div className="answer-options">
                                            {FREQUENCY_OPTIONS.map((opt) => (
                                                <label key={opt.value} className="answer-option">
                                                    <input
                                                        type="radio"
                                                        name={`gad-${index}`}
                                                        value={opt.value}
                                                        checked={gadAnswers[index] === opt.value}
                                                        onChange={(e) => handleGadChange(index, e.target.value)}
                                                    />
                                                    <span>{opt.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="assessment-result">
                                <span>Your GAD-7 Score:</span>
                                <strong className={`result-value ${getGadLevel(gadTotal).color}`}>
                                    {gadTotal}/21 - {getGadLevel(gadTotal).level}
                                </strong>
                            </div>
                            <p className="disclaimer">
                                This is a screening tool, not a diagnostic instrument. Please consult a healthcare professional for clinical advice.
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {activeTab === 'phq9' && (
                <section className="assessment-content">
                    <div className="card">
                        <div className="card-header">
                            <h2>PHQ-9 Depression Screening</h2>
                            <p>Over the last 2 weeks, how often have you been bothered by the following?</p>
                        </div>
                        <div className="card-body">
                            <div className="personalization-note" style={{ marginBottom: '20px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.3)' }}>
                                <span className="ai-badge">📋 Clinical Standard</span>
                                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    The PHQ-9 is a validated clinical tool developed by Drs. Kroenke, Spitzer, and Williams. It's used worldwide to assess depression symptoms.
                                </p>
                            </div>
                            <div className="questionnaire">
                                {STANDARD_PHQ9_QUESTIONS.map((q, index) => (
                                    <div key={index} className="question-row">
                                        <p className="question-text">{index + 1}. {q.question}</p>
                                        <div className="answer-options">
                                            {FREQUENCY_OPTIONS.map((opt) => (
                                                <label key={opt.value} className="answer-option">
                                                    <input
                                                        type="radio"
                                                        name={`phq-${index}`}
                                                        value={opt.value}
                                                        checked={phqAnswers[index] === opt.value}
                                                        onChange={(e) => handlePhqChange(index, e.target.value)}
                                                    />
                                                    <span>{opt.label}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="assessment-result">
                                <span>Your PHQ-9 Score:</span>
                                <strong className={`result-value ${getPhqLevel(phqTotal).color}`}>
                                    {phqTotal}/27 - {getPhqLevel(phqTotal).level}
                                </strong>
                            </div>
                            <p className="disclaimer">
                                This is a screening tool, not a diagnostic instrument. Please consult a healthcare professional for clinical advice.
                            </p>
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}
