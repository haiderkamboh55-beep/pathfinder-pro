import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function AssessmentHistoryPage() {
    const navigate = useNavigate();
    const [assessments, setAssessments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedAssessment, setSelectedAssessment] = useState(null);

    useEffect(() => {
        loadAssessmentHistory();
    }, []);

    const loadAssessmentHistory = async () => {
        try {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setError('Please log in to view your assessment history');
                setLoading(false);
                return;
            }

            const { data, error: fetchError } = await supabase
                .from('career_assessments')
                .select('*')
                .eq('user_id', user.id)
                .order('completed_at', { ascending: false });

            if (fetchError) {
                console.error('Error fetching assessments:', fetchError);
                setError('Failed to load assessment history. Please try again.');
            } else {
                setAssessments(data || []);
            }
        } catch (err) {
            console.error('Error:', err);
            setError('An error occurred while loading your history');
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getSeverityColor = (severity) => {
        const colors = {
            'Minimal': '#22c55e',
            'Mild': '#84cc16',
            'Moderate': '#f59e0b',
            'Moderately Significant': '#f97316',
            'Significant': '#ef4444'
        };
        return colors[severity] || '#6b7280';
    };

    const getHollandDescription = (code) => {
        const descriptions = {
            'R': 'Realistic - Practical, hands-on work',
            'I': 'Investigative - Analytical, intellectual work',
            'A': 'Artistic - Creative, expressive work',
            'S': 'Social - Helping and teaching others',
            'E': 'Enterprising - Leadership and business',
            'C': 'Conventional - Organized, detail-oriented work'
        };
        if (!code) return '';
        return code.split('').map(c => descriptions[c] || c).join(' | ');
    };

    // Comprehensive markdown renderer for career advice
    const renderMarkdown = (text) => {
        if (!text) return null;

        // Split by lines for processing
        const lines = text.split('\n');
        const elements = [];
        let listItems = [];
        let inList = false;

        const processInlineFormatting = (line) => {
            // Process markdown links [text](url)
            let processed = line.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="advice-link">${linkText}</a>`;
            });

            // Process bold **text** or __text__
            processed = processed.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
            processed = processed.replace(/__([^_]+)__/g, '<strong>$1</strong>');

            // Process italic *text* or _text_
            processed = processed.replace(/(?<!\*)\*(?!\*)([^*]+)\*(?!\*)/g, '<em>$1</em>');

            // Process standalone URLs
            processed = processed.replace(/(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi, (url) => {
                if (processed.includes(`href="${url}"`)) return url; // Already a link
                return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="advice-link">${url}</a>`;
            });

            return processed;
        };

        lines.forEach((line, index) => {
            const trimmedLine = line.trim();

            // Skip empty lines but close any open list
            if (!trimmedLine) {
                if (inList && listItems.length > 0) {
                    elements.push(
                        <ul key={`list-${index}`} className="advice-list">
                            {listItems.map((item, i) => (
                                <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                            ))}
                        </ul>
                    );
                    listItems = [];
                    inList = false;
                }
                return;
            }

            // Handle headers
            if (trimmedLine.startsWith('### ')) {
                if (inList && listItems.length > 0) {
                    elements.push(
                        <ul key={`list-${index}`} className="advice-list">
                            {listItems.map((item, i) => (
                                <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                            ))}
                        </ul>
                    );
                    listItems = [];
                    inList = false;
                }
                elements.push(
                    <h4 key={index} className="advice-heading">
                        {processInlineFormatting(trimmedLine.substring(4))}
                    </h4>
                );
                return;
            }

            if (trimmedLine.startsWith('## ')) {
                if (inList && listItems.length > 0) {
                    elements.push(
                        <ul key={`list-${index}`} className="advice-list">
                            {listItems.map((item, i) => (
                                <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                            ))}
                        </ul>
                    );
                    listItems = [];
                    inList = false;
                }
                elements.push(
                    <h3 key={index} className="advice-section-title">
                        {processInlineFormatting(trimmedLine.substring(3))}
                    </h3>
                );
                return;
            }

            // Handle numbered lists (1. 2. 3.)
            const numberedMatch = trimmedLine.match(/^(\d+)\.\s+(.+)/);
            if (numberedMatch) {
                inList = true;
                listItems.push(processInlineFormatting(numberedMatch[2]));
                return;
            }

            // Handle bullet points (* or -)
            if (trimmedLine.startsWith('* ') || trimmedLine.startsWith('- ')) {
                inList = true;
                listItems.push(processInlineFormatting(trimmedLine.substring(2)));
                return;
            }

            // Regular paragraph - close any open list first
            if (inList && listItems.length > 0) {
                elements.push(
                    <ul key={`list-${index}`} className="advice-list">
                        {listItems.map((item, i) => (
                            <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                        ))}
                    </ul>
                );
                listItems = [];
                inList = false;
            }

            elements.push(
                <p key={index} className="advice-paragraph" dangerouslySetInnerHTML={{ __html: processInlineFormatting(trimmedLine) }} />
            );
        });

        // Close any remaining list
        if (listItems.length > 0) {
            elements.push(
                <ul key="list-final" className="advice-list">
                    {listItems.map((item, i) => (
                        <li key={i} dangerouslySetInnerHTML={{ __html: item }} />
                    ))}
                </ul>
            );
        }

        return elements;
    };

    if (loading) {
        return (
            <div className="history-page">
                <div className="history-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading your assessment history...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="history-page">
            <div className="history-header">
                <div className="history-title-section">
                    <h1>📊 Assessment History</h1>
                    <p className="history-subtitle">
                        View all your completed career assessments and track your progress over time
                    </p>
                </div>
                <button className="primary-cta" onClick={() => navigate('/onboarding')}>
                    ➕ New Assessment
                </button>
            </div>

            {error && (
                <div className="history-error">
                    <span>⚠️</span>
                    <p>{error}</p>
                </div>
            )}

            {assessments.length === 0 && !error ? (
                <div className="history-empty">
                    <div className="empty-icon">📋</div>
                    <h2>No Assessments Yet</h2>
                    <p>Complete your first career assessment to see your history here.</p>
                    <button className="primary-cta" onClick={() => navigate('/onboarding')}>
                        Start Your First Assessment
                    </button>
                </div>
            ) : (
                <div className="history-content">
                    <div className="assessments-list">
                        {assessments.map((assessment, index) => (
                            <div
                                key={assessment.id || index}
                                className={`assessment-card ${selectedAssessment?.id === assessment.id ? 'selected' : ''}`}
                                onClick={() => setSelectedAssessment(assessment)}
                            >
                                <div className="assessment-card-header">
                                    <div className="assessment-date">
                                        <span className="date-icon">📅</span>
                                        <span>{formatDate(assessment.completed_at)}</span>
                                    </div>
                                    {index === 0 && <span className="latest-badge">Latest</span>}
                                </div>

                                <div className="assessment-card-body">
                                    <div className="assessment-info">
                                        <h3>{assessment.target_role || 'Career Assessment'}</h3>
                                        <p className="assessment-name">{assessment.full_name}</p>
                                    </div>

                                    <div className="assessment-scores">
                                        <div className="score-item">
                                            <span className="score-label">Holland Code</span>
                                            <span className="score-value holland">{assessment.holland_code || 'N/A'}</span>
                                        </div>
                                        <div className="score-item">
                                            <span className="score-label">GAD-7</span>
                                            <span className="score-value" style={{ color: getSeverityColor(assessment.gad_severity) }}>
                                                {assessment.gad_total_score || 0}/21
                                            </span>
                                        </div>
                                        <div className="score-item">
                                            <span className="score-label">PHQ-9</span>
                                            <span className="score-value" style={{ color: getSeverityColor(assessment.phq_severity) }}>
                                                {assessment.phq_total_score || 0}/27
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="assessment-card-footer">
                                    <span className="view-details">Click to view full report →</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {selectedAssessment && (
                        <div className="assessment-detail">
                            <div className="detail-header">
                                <h2>Assessment Report</h2>
                                <button className="close-detail" onClick={() => setSelectedAssessment(null)}>×</button>
                            </div>

                            <div className="detail-content">
                                <div className="detail-section">
                                    <h3>📋 Basic Information</h3>
                                    <div className="detail-grid">
                                        <div className="detail-item">
                                            <span className="label">Name</span>
                                            <span className="value">{selectedAssessment.full_name}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Target Role</span>
                                            <span className="value">{selectedAssessment.target_role}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Education</span>
                                            <span className="value">{selectedAssessment.education_level}</span>
                                        </div>
                                        <div className="detail-item">
                                            <span className="label">Country</span>
                                            <span className="value">{selectedAssessment.country}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h3>🎯 Skills</h3>
                                    <div className="skills-tags">
                                        {(Array.isArray(selectedAssessment.skills)
                                            ? selectedAssessment.skills
                                            : (selectedAssessment.skills || '').split(',')
                                        ).map((skill, idx) => (
                                            <span key={idx} className="skill-tag">{skill.trim()}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="detail-section">
                                    <h3>🧭 Holland Code (RIASEC)</h3>
                                    <div className="holland-display">
                                        <span className="holland-code">{selectedAssessment.holland_code}</span>
                                        <p className="holland-desc">{getHollandDescription(selectedAssessment.holland_code)}</p>
                                    </div>
                                </div>

                                <div className="detail-section scores-section">
                                    <h3>📊 Mental Health Screening</h3>
                                    <div className="scores-grid">
                                        <div className="score-card">
                                            <h4>GAD-7 (Anxiety)</h4>
                                            <div className="score-display">
                                                <span className="score-number" style={{ color: getSeverityColor(selectedAssessment.gad_severity) }}>
                                                    {selectedAssessment.gad_total_score || 0}
                                                </span>
                                                <span className="score-max">/21</span>
                                            </div>
                                            <span className="severity-badge" style={{ backgroundColor: getSeverityColor(selectedAssessment.gad_severity) }}>
                                                {selectedAssessment.gad_severity || 'N/A'}
                                            </span>
                                        </div>
                                        <div className="score-card">
                                            <h4>PHQ-9 (Mood)</h4>
                                            <div className="score-display">
                                                <span className="score-number" style={{ color: getSeverityColor(selectedAssessment.phq_severity) }}>
                                                    {selectedAssessment.phq_total_score || 0}
                                                </span>
                                                <span className="score-max">/27</span>
                                            </div>
                                            <span className="severity-badge" style={{ backgroundColor: getSeverityColor(selectedAssessment.phq_severity) }}>
                                                {selectedAssessment.phq_severity || 'N/A'}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {selectedAssessment.career_advice && (
                                    <div className="detail-section advice-section">
                                        <h3>🚀 Career Advice & Recommendations</h3>
                                        <div className="advice-content">
                                            {renderMarkdown(selectedAssessment.career_advice)}
                                        </div>
                                    </div>
                                )}

                                <div className="detail-footer">
                                    <span className="completed-date">
                                        Completed: {formatDate(selectedAssessment.completed_at)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
