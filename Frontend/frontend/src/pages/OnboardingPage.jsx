import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { supabase } from '../supabaseClient';

const BACKEND_BASE_URL = 'http://localhost:8000';

// Answer options for mental health assessments
const FREQUENCY_OPTIONS = [
    { value: 0, label: "Not at all" },
    { value: 1, label: "Several days" },
    { value: 2, label: "More than half the days" },
    { value: 3, label: "Nearly every day" }
];

// Agreement options for interests
const AGREEMENT_OPTIONS = [
    { value: 1, label: "Strongly Disagree" },
    { value: 2, label: "Disagree" },
    { value: 3, label: "Neutral" },
    { value: 4, label: "Agree" },
    { value: 5, label: "Strongly Agree" }
];

// Career interest categories for Holland Code
const INTEREST_CATEGORIES = [
    {
        code: 'R', name: 'Realistic', desc: 'Practical, hands-on work with tools, machines, or nature', questions: [
            "I enjoy building, fixing, or working with physical objects",
            "I prefer outdoor activities and hands-on tasks"
        ]
    },
    {
        code: 'I', name: 'Investigative', desc: 'Analytical thinking, research, and problem-solving', questions: [
            "I enjoy analyzing data and solving complex problems",
            "I like researching topics and understanding how things work"
        ]
    },
    {
        code: 'A', name: 'Artistic', desc: 'Creative expression through art, design, or writing', questions: [
            "I express myself through creative activities",
            "I prefer unstructured work where I can be imaginative"
        ]
    },
    {
        code: 'S', name: 'Social', desc: 'Helping, teaching, or working with people', questions: [
            "I enjoy helping, teaching, or counseling others",
            "I work well in team environments"
        ]
    },
    {
        code: 'E', name: 'Enterprising', desc: 'Leading, persuading, and business activities', questions: [
            "I like leading projects and influencing others",
            "I'm motivated by goals and competition"
        ]
    },
    {
        code: 'C', name: 'Conventional', desc: 'Organized, detail-oriented, systematic work', questions: [
            "I prefer organized tasks with clear procedures",
            "I'm detail-oriented and good with data"
        ]
    }
];

// Work preference questions
const WORK_PREFERENCES = [
    { id: 'remote', question: "I prefer working remotely over going to an office", type: 'scale' },
    { id: 'team_size', question: "I work better in small teams (under 10 people)", type: 'scale' },
    { id: 'structure', question: "I prefer having clear guidelines and structure", type: 'scale' },
    { id: 'pace', question: "I thrive in fast-paced environments", type: 'scale' },
    { id: 'autonomy', question: "I prefer making my own decisions at work", type: 'scale' },
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

export default function OnboardingPage({ onComplete, profile, onProfileChange }) {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Form 1: Basic Info
    const [basicInfo, setBasicInfo] = useState({
        fullName: profile?.fullName || '',
        educationLevel: profile?.educationLevel || '',
        targetRole: profile?.targetRole || '',
        skills: profile?.skillsInput || '',
        country: profile?.country || ''
    });

    // Form 2: Interests & Work Preferences
    const [interestScores, setInterestScores] = useState({});
    const [workPreferences, setWorkPreferences] = useState({});

    // Form 3 & 4: AI-Generated Questions
    const [aiGeneratedQuestions, setAiGeneratedQuestions] = useState(null);
    const [gadResponses, setGadResponses] = useState({});
    const [phqResponses, setPhqResponses] = useState({});

    // Form 5: Personalized AI Questions
    const [personalizedQuestions, setPersonalizedQuestions] = useState([]);
    const [personalizedResponses, setPersonalizedResponses] = useState({});
    const [personalizationNote, setPersonalizationNote] = useState('');

    // Final Results
    const [careerAdvice, setCareerAdvice] = useState('');
    const [jobListings, setJobListings] = useState([]);
    const [jobsLoading, setJobsLoading] = useState(false);
    const [nameWarning, setNameWarning] = useState('');

    // Validation errors for all steps
    const [step1Errors, setStep1Errors] = useState({});
    const [step2Errors, setStep2Errors] = useState({ interests: [], workPrefs: [] });
    const [step3Errors, setStep3Errors] = useState([]);
    const [step4Errors, setStep4Errors] = useState([]);
    const [step5Errors, setStep5Errors] = useState([]);
    const [showValidationAlert, setShowValidationAlert] = useState(false);

    // Ref for container to scroll to
    const containerRef = useRef(null);

    // Scroll to top when step changes
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, [currentStep]);

    // Calculate Holland Code from interest scores
    const calculateHollandCode = () => {
        const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

        INTEREST_CATEGORIES.forEach(cat => {
            cat.questions.forEach((_, qIdx) => {
                const key = `${cat.code}_${qIdx}`;
                scores[cat.code] += interestScores[key] || 3;
            });
        });

        const sorted = Object.entries(scores)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([code]) => code);

        return sorted.join('');
    };

    // Get interests list from high-scoring categories
    const getInterests = () => {
        const scores = { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 };

        INTEREST_CATEGORIES.forEach(cat => {
            cat.questions.forEach((_, qIdx) => {
                const key = `${cat.code}_${qIdx}`;
                scores[cat.code] += interestScores[key] || 3;
            });
        });

        return Object.entries(scores)
            .filter(([, score]) => score >= 7)
            .map(([code]) => {
                const cat = INTEREST_CATEGORIES.find(c => c.code === code);
                return cat?.name || code;
            });
    };

    // Calculate total GAD score
    const calculateGADScore = () => {
        return Object.values(gadResponses).reduce((sum, val) => sum + (val || 0), 0);
    };

    // Calculate total PHQ score
    const calculatePHQScore = () => {
        return Object.values(phqResponses).reduce((sum, val) => sum + (val || 0), 0);
    };

    // Get severity label and color
    const getSeverity = (score, type) => {
        if (type === 'gad') {
            if (score <= 4) return { level: 'Minimal', color: '#22c55e' };
            if (score <= 9) return { level: 'Mild', color: '#84cc16' };
            if (score <= 14) return { level: 'Moderate', color: '#f59e0b' };
            return { level: 'Significant', color: '#ef4444' };
        } else {
            if (score <= 4) return { level: 'Minimal', color: '#22c55e' };
            if (score <= 9) return { level: 'Mild', color: '#84cc16' };
            if (score <= 14) return { level: 'Moderate', color: '#f59e0b' };
            if (score <= 19) return { level: 'Moderately Significant', color: '#f97316' };
            return { level: 'Significant', color: '#ef4444' };
        }
    };

    // Save assessment data to Supabase
    const saveAssessmentToDatabase = async (careerAdviceText) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                console.warn('No authenticated user, skipping database save');
                return;
            }

            const hollandCode = calculateHollandCode();
            const interests = getInterests();
            const gadScore = calculateGADScore();
            const phqScore = calculatePHQScore();
            const skillsList = basicInfo.skills.split(',').map(s => s.trim()).filter(Boolean);

            // Format GAD and PHQ responses using standard questions
            const gadFormatted = STANDARD_GAD7_QUESTIONS.map((q, idx) => ({
                question: q.question,
                answer: FREQUENCY_OPTIONS.find(o => o.value === gadResponses[idx])?.label || 'Not answered',
                score: gadResponses[idx] || 0
            }));

            const phqFormatted = STANDARD_PHQ9_QUESTIONS.map((q, idx) => ({
                question: q.question,
                answer: FREQUENCY_OPTIONS.find(o => o.value === phqResponses[idx])?.label || 'Not answered',
                score: phqResponses[idx] || 0
            }));

            // Save to career_assessments table
            const { error } = await supabase.from('career_assessments').upsert({
                user_id: user.id,
                full_name: basicInfo.fullName,
                education_level: basicInfo.educationLevel,
                target_role: basicInfo.targetRole,
                country: basicInfo.country,
                skills: skillsList,
                holland_code: hollandCode,
                interests: interests,
                work_preferences: workPreferences,
                gad_responses: gadFormatted,
                gad_total_score: gadScore,
                gad_severity: getSeverity(gadScore, 'gad').level,
                phq_responses: phqFormatted,
                phq_total_score: phqScore,
                phq_severity: getSeverity(phqScore, 'phq').level,
                career_advice: careerAdviceText,
                completed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

            if (error) {
                console.error('Error saving assessment to database:', error);
            } else {
                console.log('Assessment saved to database successfully');
            }
        } catch (err) {
            console.error('Failed to save assessment:', err);
        }
    };

    // Note: We no longer use AI to generate GAD-7/PHQ-9 questions.
    // We now use the official standardized clinical questions (STANDARD_GAD7_QUESTIONS and STANDARD_PHQ9_QUESTIONS)
    // AI is only used at the final step to generate personalized career advice based on all collected data.

    // Generate personalized follow-up questions based on all 4 forms data
    const generatePersonalizedQuestions = async () => {
        setIsLoading(true);
        setError('');

        try {
            const hollandCode = calculateHollandCode();
            const interests = getInterests();
            const skillsList = basicInfo.skills.split(',').map(s => s.trim()).filter(Boolean);

            const response = await axios.post(`${BACKEND_BASE_URL}/generate-personalized-questions`, {
                full_name: basicInfo.fullName,
                education_level: basicInfo.educationLevel,
                target_role: basicInfo.targetRole,
                skills: skillsList,
                country: basicInfo.country,
                holland_code: hollandCode,
                interests: interests,
                work_preferences: workPreferences,
                gad_total_score: calculateGADScore(),
                phq_total_score: calculatePHQScore(),
                gad_severity: getSeverity(calculateGADScore(), 'gad').level,
                phq_severity: getSeverity(calculatePHQScore(), 'phq').level
            });

            if (response.data?.questions && response.data.questions.length > 0) {
                setPersonalizedQuestions(response.data.questions);
                setPersonalizationNote(response.data.personalization_note || '');
                console.log('[PERSONALIZED] Generated questions:', response.data.questions);
            } else {
                console.warn('[PERSONALIZED] No questions returned, using fallback');
                // Fallback questions if API fails
                setPersonalizedQuestions([
                    {
                        id: 1,
                        question: `What initially drew you to pursue a career as a ${basicInfo.targetRole}?`,
                        category: "Career Motivation",
                        options: ["Passion for technical challenges", "Job security and salary", "Desire to make an impact", "Natural career progression", "Inspired by role models"]
                    },
                    {
                        id: 2,
                        question: "How do you prefer to learn new skills for your career?",
                        category: "Learning Style",
                        options: ["Structured online courses", "Hands-on projects", "Reading documentation", "Mentorship and peer learning", "Certification programs"]
                    },
                    {
                        id: 3,
                        question: "What does an ideal work environment look like for you?",
                        category: "Work Environment",
                        options: ["Quiet, focused workspace", "Collaborative open office", "Fully remote", "Hybrid flexibility", "Startup energy"]
                    },
                    {
                        id: 4,
                        question: "How do you handle career setbacks or challenges?",
                        category: "Resilience",
                        options: ["View as learning opportunities", "Seek mentor guidance", "Take time to process", "Pivot and try alternatives", "Focus on what I can control"]
                    },
                    {
                        id: 5,
                        question: "Where do you see yourself in 5 years?",
                        category: "Future Vision",
                        options: ["Technical expert", "Team lead or manager", "Entrepreneur", "Specialized field", "Work-life balance focus"]
                    }
                ]);
            }

            setCurrentStep(5);
        } catch (err) {
            console.error('Error generating personalized questions:', err);
            setError('Failed to generate personalized questions. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    // Generate comprehensive career advice
    const generateCareerAdvice = async () => {
        setIsLoading(true);
        setError('');

        try {
            const hollandCode = calculateHollandCode();
            const interests = getInterests();
            const skillsList = basicInfo.skills.split(',').map(s => s.trim()).filter(Boolean);

            // Format responses with standard question text
            const gadFormatted = STANDARD_GAD7_QUESTIONS.map((q, idx) => ({
                question: q.question,
                answer: FREQUENCY_OPTIONS.find(o => o.value === gadResponses[idx])?.label || 'Not answered',
                score: gadResponses[idx] || 0
            }));

            const phqFormatted = STANDARD_PHQ9_QUESTIONS.map((q, idx) => ({
                question: q.question,
                answer: FREQUENCY_OPTIONS.find(o => o.value === phqResponses[idx])?.label || 'Not answered',
                score: phqResponses[idx] || 0
            }));

            // Format personalized question responses
            const personalizedFormatted = personalizedQuestions.map((q, idx) => ({
                question: q.question,
                category: q.category,
                answer: personalizedResponses[q.id] || 'Not answered'
            }));

            // Fetch career advice and job listings in parallel
            const [adviceResponse, jobsResponse] = await Promise.all([
                axios.post(`${BACKEND_BASE_URL}/comprehensive-advice`, {
                    full_name: basicInfo.fullName,
                    education_level: basicInfo.educationLevel,
                    target_role: basicInfo.targetRole,
                    skills: skillsList,
                    holland_code: hollandCode,
                    interests: interests,
                    work_preferences: workPreferences,
                    gad_responses: gadFormatted,
                    phq_responses: phqFormatted,
                    gad_total_score: calculateGADScore(),
                    phq_total_score: calculatePHQScore(),
                    personalized_responses: personalizedFormatted
                }),
                axios.post(`${BACKEND_BASE_URL}/search-jobs`, {
                    target_role: basicInfo.targetRole,
                    skills: skillsList,
                    location: basicInfo.country || '',
                    remote_preference: workPreferences.remote >= 4 // If they prefer remote
                }).catch(err => {
                    console.warn('Job search failed:', err);
                    return { data: { jobs: [], success: false } };
                })
            ]);

            setCareerAdvice(adviceResponse.data.advice);

            // Debug: Log job search response
            console.log('[JOB SEARCH] Full response:', jobsResponse.data);
            console.log('[JOB SEARCH] Jobs found:', jobsResponse.data?.jobs?.length || 0);

            // Set job listings if available
            if (jobsResponse.data?.jobs && jobsResponse.data.jobs.length > 0) {
                console.log('[JOB SEARCH] Setting job listings:', jobsResponse.data.jobs);
                setJobListings(jobsResponse.data.jobs);
            } else {
                console.log('[JOB SEARCH] No jobs found or empty array');
                setJobListings([]);
            }

            // Save all assessment data to database
            await saveAssessmentToDatabase(adviceResponse.data.advice);

            // Update profile with all data from career discovery
            onProfileChange('fullName', basicInfo.fullName);
            onProfileChange('educationLevel', basicInfo.educationLevel);
            onProfileChange('targetRole', basicInfo.targetRole);
            onProfileChange('country', basicInfo.country);  // IMPORTANT: Add country for job searches
            onProfileChange('skillsInput', basicInfo.skills);
            onProfileChange('hollandCode', hollandCode);
            onProfileChange('gadScore', calculateGADScore());
            onProfileChange('phqScore', calculatePHQScore());
            onProfileChange('interests', getInterests().join(', '));

            console.log('📋 Profile updated with career discovery data:', {
                fullName: basicInfo.fullName,
                targetRole: basicInfo.targetRole,
                country: basicInfo.country,
                skills: basicInfo.skills,
                hollandCode: hollandCode
            });

            setCurrentStep(6);
        } catch (err) {
            console.error('Error generating advice:', err);
            setError('Failed to generate career advice. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleNext = () => {
        // Validate current step before proceeding
        if (currentStep === 1) {
            const errors = {};
            let hasErrors = false;

            // Validate all required fields
            if (!basicInfo.fullName || basicInfo.fullName.trim() === '') {
                errors.fullName = 'Full Name is required';
                hasErrors = true;
            }
            if (!basicInfo.educationLevel || basicInfo.educationLevel === '') {
                errors.educationLevel = 'Education Level is required';
                hasErrors = true;
            }
            if (!basicInfo.country || basicInfo.country === '') {
                errors.country = 'Country is required';
                hasErrors = true;
            }
            if (!basicInfo.targetRole || basicInfo.targetRole.trim() === '') {
                errors.targetRole = 'Target Career/Role is required';
                hasErrors = true;
            }
            if (!basicInfo.skills || basicInfo.skills.trim() === '') {
                errors.skills = 'Skills are required';
                hasErrors = true;
            }

            if (hasErrors) {
                setStep1Errors(errors);
                setShowValidationAlert(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => setShowValidationAlert(false), 10000);
                return;
            } else {
                setStep1Errors({});
                setShowValidationAlert(false);
            }
        }

        // Validate Step 2: Interests & Work Preferences
        if (currentStep === 2) {
            const missingInterests = [];
            const missingWorkPrefs = [];
            let hasErrors = false;

            // Check all interest category questions
            INTEREST_CATEGORIES.forEach(cat => {
                cat.questions.forEach((question, qIdx) => {
                    const key = `${cat.code}_${qIdx}`;
                    if (interestScores[key] === undefined) {
                        missingInterests.push({ category: cat.name, question: question, key: key });
                        hasErrors = true;
                    }
                });
            });

            // Check all work preference questions
            WORK_PREFERENCES.forEach(pref => {
                if (workPreferences[pref.id] === undefined) {
                    missingWorkPrefs.push({ id: pref.id, question: pref.question });
                    hasErrors = true;
                }
            });

            if (hasErrors) {
                setStep2Errors({ interests: missingInterests, workPrefs: missingWorkPrefs });
                setShowValidationAlert(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => setShowValidationAlert(false), 10000);
                return;
            } else {
                setStep2Errors({ interests: [], workPrefs: [] });
                setShowValidationAlert(false);
            }
        }

        // Validate Step 3: GAD-7 Questions
        if (currentStep === 3) {
            const missingQuestions = [];
            let hasErrors = false;

            STANDARD_GAD7_QUESTIONS.forEach((q, idx) => {
                if (gadResponses[idx] === undefined) {
                    missingQuestions.push({ index: idx, question: q.question });
                    hasErrors = true;
                }
            });

            if (hasErrors) {
                setStep3Errors(missingQuestions);
                setShowValidationAlert(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => setShowValidationAlert(false), 10000);
                return;
            } else {
                setStep3Errors([]);
                setShowValidationAlert(false);
            }
        }

        // Validate Step 4: PHQ-9 Questions
        if (currentStep === 4) {
            const missingQuestions = [];
            let hasErrors = false;

            STANDARD_PHQ9_QUESTIONS.forEach((q, idx) => {
                if (phqResponses[idx] === undefined) {
                    missingQuestions.push({ index: idx, question: q.question });
                    hasErrors = true;
                }
            });

            if (hasErrors) {
                setStep4Errors(missingQuestions);
                setShowValidationAlert(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => setShowValidationAlert(false), 10000);
                return;
            } else {
                setStep4Errors([]);
                setShowValidationAlert(false);
            }
        }

        // Validate Step 5: Personalized AI Questions
        if (currentStep === 5) {
            const missingQuestions = [];
            let hasErrors = false;

            personalizedQuestions.forEach((q, idx) => {
                if (personalizedResponses[q.id] === undefined) {
                    missingQuestions.push({ id: q.id, question: q.question, category: q.category });
                    hasErrors = true;
                }
            });

            if (hasErrors) {
                setStep5Errors(missingQuestions);
                setShowValidationAlert(true);
                window.scrollTo({ top: 0, behavior: 'smooth' });
                setTimeout(() => setShowValidationAlert(false), 10000);
                return;
            } else {
                setStep5Errors([]);
                setShowValidationAlert(false);
            }
        }

        if (currentStep === 4) {
            // After PHQ-9, generate personalized questions (Form 5)
            generatePersonalizedQuestions();
        } else if (currentStep === 5) {
            // After personalized questions, generate career advice (Form 6)
            generateCareerAdvice();
        } else if (currentStep < 6) {
            // For all other steps, just proceed to next
            setCurrentStep(currentStep + 1);
            window.scrollTo(0, 0);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            window.scrollTo(0, 0);
        }
    };

    const renderProgressBar = () => (
        <div className="onboarding-progress">
            {[
                { num: 1, label: 'Basic Info' },
                { num: 2, label: 'Interests' },
                { num: 3, label: 'GAD-7 Anxiety' },
                { num: 4, label: 'PHQ-9 Mood' },
                { num: 5, label: 'AI Questions' },
                { num: 6, label: 'Career Advice' }
            ].map(step => (
                <div
                    key={step.num}
                    className={`progress-step ${currentStep >= step.num ? 'active' : ''} ${currentStep === step.num ? 'current' : ''}`}
                >
                    <div className="step-number">{step.num}</div>
                    <div className="step-label">{step.label}</div>
                </div>
            ))}
            <div className="progress-line" style={{ width: `${((currentStep - 1) / 5) * 100}%` }}></div>
        </div>
    );

    // Form 1: Basic Information
    const renderStep1 = () => (
        <div className="onboarding-form">
            {/* Validation Alert Banner */}
            {showValidationAlert && Object.keys(step1Errors).length > 0 && (
                <div className="validation-alert">
                    <div className="validation-alert-icon">⚠️</div>
                    <div className="validation-alert-content">
                        <strong>Please complete all required fields</strong>
                        <p>The following fields are required before you can continue:</p>
                        <ul>
                            {step1Errors.fullName && <li>Full Name</li>}
                            {step1Errors.educationLevel && <li>Education Level</li>}
                            {step1Errors.country && <li>Country</li>}
                            {step1Errors.targetRole && <li>Target Career/Role</li>}
                            {step1Errors.skills && <li>Your Skills</li>}
                        </ul>
                    </div>
                    <button className="validation-alert-close" onClick={() => setShowValidationAlert(false)}>×</button>
                </div>
            )}

            <div className="form-section">
                <h2>👤 Tell Us About Yourself</h2>
                <p className="section-desc">This information helps us personalize your career guidance experience</p>

                <div className="form-grid">
                    <div className="form-group">
                        <label>Full Name *</label>
                        <input
                            type="text"
                            value={basicInfo.fullName}
                            onChange={(e) => {
                                const value = e.target.value;
                                // Clear validation error when user starts typing
                                if (step1Errors.fullName) {
                                    setStep1Errors({ ...step1Errors, fullName: null });
                                }
                                // Check if the value contains any non-alphabet characters
                                if (/[^a-zA-Z\s]/.test(value)) {
                                    setNameWarning('Only alphabets are allowed. Numbers and special characters are not permitted.');
                                    // Remove any characters that are not letters or spaces
                                    const sanitizedValue = value.replace(/[^a-zA-Z\s]/g, '');
                                    setBasicInfo({ ...basicInfo, fullName: sanitizedValue });
                                    // Clear warning after 3 seconds
                                    setTimeout(() => setNameWarning(''), 3000);
                                } else {
                                    setNameWarning('');
                                    setBasicInfo({ ...basicInfo, fullName: value });
                                }
                            }}
                            placeholder="Enter your full name"
                            required
                            className={step1Errors.fullName ? 'field-error' : ''}
                        />
                        {nameWarning && <span className="field-warning">{nameWarning}</span>}
                        {step1Errors.fullName && <span className="field-error-message">⚠️ {step1Errors.fullName}</span>}
                    </div>

                    <div className="form-group">
                        <label>Education Level *</label>
                        <select
                            value={basicInfo.educationLevel}
                            onChange={(e) => {
                                setBasicInfo({ ...basicInfo, educationLevel: e.target.value });
                                if (step1Errors.educationLevel) {
                                    setStep1Errors({ ...step1Errors, educationLevel: null });
                                }
                            }}
                            required
                            className={step1Errors.educationLevel ? 'field-error' : ''}
                        >
                            <option value="">Select education level</option>
                            <option value="high_school">High School</option>
                            <option value="associate">Associate Degree</option>
                            <option value="bachelor">Bachelor's Degree</option>
                            <option value="master">Master's Degree</option>
                            <option value="doctorate">Doctorate/PhD</option>
                            <option value="self_taught">Self-Taught/Bootcamp</option>
                        </select>
                        {step1Errors.educationLevel && <span className="field-error-message">⚠️ {step1Errors.educationLevel}</span>}
                    </div>

                    <div className="form-group">
                        <label>Country *</label>
                        <select
                            value={basicInfo.country}
                            onChange={(e) => {
                                setBasicInfo({ ...basicInfo, country: e.target.value });
                                if (step1Errors.country) {
                                    setStep1Errors({ ...step1Errors, country: null });
                                }
                            }}
                            required
                            className={step1Errors.country ? 'field-error' : ''}
                        >
                            <option value="">Select your country</option>
                            <option value="United States">United States</option>
                            <option value="United Kingdom">United Kingdom</option>
                            <option value="Canada">Canada</option>
                            <option value="Germany">Germany</option>
                            <option value="Australia">Australia</option>
                            <option value="India">India</option>
                            <option value="Pakistan">Pakistan</option>
                            <option value="UAE">United Arab Emirates</option>
                            <option value="Saudi Arabia">Saudi Arabia</option>
                            <option value="Singapore">Singapore</option>
                            <option value="Netherlands">Netherlands</option>
                            <option value="France">France</option>
                            <option value="Ireland">Ireland</option>
                            <option value="Sweden">Sweden</option>
                            <option value="Switzerland">Switzerland</option>
                            <option value="Remote">Remote / Worldwide</option>
                        </select>
                        <small style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                            We'll show you jobs available in your country
                        </small>
                        {step1Errors.country && <span className="field-error-message">⚠️ {step1Errors.country}</span>}
                    </div>

                    <div className="form-group">
                        <label>Target Career/Role *</label>
                        <input
                            type="text"
                            value={basicInfo.targetRole}
                            onChange={(e) => {
                                setBasicInfo({ ...basicInfo, targetRole: e.target.value });
                                if (step1Errors.targetRole) {
                                    setStep1Errors({ ...step1Errors, targetRole: null });
                                }
                            }}
                            placeholder="e.g., Software Engineer, Data Scientist"
                            required
                            className={step1Errors.targetRole ? 'field-error' : ''}
                        />
                        {step1Errors.targetRole && <span className="field-error-message">⚠️ {step1Errors.targetRole}</span>}
                    </div>

                    <div className="form-group full-width">
                        <label>Your Skills (comma-separated) *</label>
                        <textarea
                            value={basicInfo.skills}
                            onChange={(e) => {
                                setBasicInfo({ ...basicInfo, skills: e.target.value });
                                if (step1Errors.skills) {
                                    setStep1Errors({ ...step1Errors, skills: null });
                                }
                            }}
                            placeholder="e.g., Python, JavaScript, Data Analysis, Communication, Project Management"
                            rows={3}
                            required
                            className={step1Errors.skills ? 'field-error' : ''}
                        />
                        <small style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                            Enter at least 3 skills separated by commas
                        </small>
                        {step1Errors.skills && <span className="field-error-message">⚠️ {step1Errors.skills}</span>}
                    </div>
                </div>
            </div>
        </div>
    );

    // Form 2: Interests & Work Preferences
    const renderStep2 = () => (
        <div className="onboarding-form">
            {/* Validation Alert Banner for Step 2 */}
            {showValidationAlert && (step2Errors.interests.length > 0 || step2Errors.workPrefs.length > 0) && (
                <div className="validation-alert">
                    <div className="validation-alert-icon">⚠️</div>
                    <div className="validation-alert-content">
                        <strong>Please answer all questions before continuing</strong>
                        <p>You have {step2Errors.interests.length + step2Errors.workPrefs.length} unanswered question(s):</p>
                        <ul>
                            {step2Errors.interests.slice(0, 3).map((err, idx) => (
                                <li key={idx}>{err.category}: "{err.question}"</li>
                            ))}
                            {step2Errors.workPrefs.slice(0, 3).map((err, idx) => (
                                <li key={`wp-${idx}`}>Work Preferences: "{err.question}"</li>
                            ))}
                            {(step2Errors.interests.length + step2Errors.workPrefs.length) > 6 && (
                                <li>...and {step2Errors.interests.length + step2Errors.workPrefs.length - 6} more</li>
                            )}
                        </ul>
                    </div>
                    <button className="validation-alert-close" onClick={() => setShowValidationAlert(false)}>×</button>
                </div>
            )}

            <div className="form-section">
                <h2>🧭 Career Interest Assessment</h2>
                <p className="section-desc">
                    Rate how much you agree with each statement. This determines your Holland Code (RIASEC) personality type.
                </p>

                <div className="assessment-questions">
                    {INTEREST_CATEGORIES.map(cat => (
                        <div key={cat.code} className="interest-category">
                            <div className="category-header">
                                <span className="category-code">{cat.code}</span>
                                <div>
                                    <strong>{cat.name}</strong>
                                    <p className="category-desc">{cat.desc}</p>
                                </div>
                            </div>
                            {cat.questions.map((question, qIdx) => {
                                const key = `${cat.code}_${qIdx}`;
                                const isUnanswered = step2Errors.interests.some(err => err.key === key);
                                return (
                                    <div key={key} className={`question-card ${isUnanswered ? 'unanswered' : ''}`}>
                                        <p className="question-text">
                                            {question}
                                            {isUnanswered && <span className="required-indicator"> *</span>}
                                        </p>
                                        <div className="answer-options">
                                            {AGREEMENT_OPTIONS.map(opt => (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    className={`option-btn ${interestScores[key] === opt.value ? 'selected' : ''}`}
                                                    onClick={() => setInterestScores({ ...interestScores, [key]: opt.value })}
                                                >
                                                    {opt.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>

            <div className="form-section">
                <h2>💼 Work Style Preferences</h2>
                <p className="section-desc">How do you prefer to work? This helps match you with compatible environments.</p>

                <div className="assessment-questions">
                    {WORK_PREFERENCES.map(pref => {
                        const isUnanswered = step2Errors.workPrefs.some(err => err.id === pref.id);
                        return (
                            <div key={pref.id} className={`question-card ${isUnanswered ? 'unanswered' : ''}`}>
                                <p className="question-text">
                                    {pref.question}
                                    {isUnanswered && <span className="required-indicator"> *</span>}
                                </p>
                                <div className="answer-options">
                                    {AGREEMENT_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            className={`option-btn ${workPreferences[pref.id] === opt.value ? 'selected' : ''}`}
                                            onClick={() => setWorkPreferences({ ...workPreferences, [pref.id]: opt.value })}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="ai-note">
                <span className="ai-badge">📋 Clinical Standards</span>
                <p>The next steps use <strong>GAD-7 and PHQ-9</strong> — internationally validated clinical screening tools. Your responses, combined with your profile, will be analyzed by AI to generate personalized career recommendations.</p>
            </div>
        </div>
    );

    // Form 3: Standard GAD-7 Questions
    const renderStep3 = () => (
        <div className="onboarding-form">
            {/* Validation Alert Banner for Step 3 */}
            {showValidationAlert && step3Errors.length > 0 && (
                <div className="validation-alert">
                    <div className="validation-alert-icon">⚠️</div>
                    <div className="validation-alert-content">
                        <strong>Please answer all GAD-7 questions before continuing</strong>
                        <p>You have {step3Errors.length} unanswered question(s):</p>
                        <ul>
                            {step3Errors.slice(0, 3).map((err, idx) => (
                                <li key={idx}>Question {err.index + 1}: "{err.question}"</li>
                            ))}
                            {step3Errors.length > 3 && (
                                <li>...and {step3Errors.length - 3} more</li>
                            )}
                        </ul>
                    </div>
                    <button className="validation-alert-close" onClick={() => setShowValidationAlert(false)}>×</button>
                </div>
            )}

            <div className="form-section">
                <h2>💭 Anxiety Screening (GAD-7)</h2>
                <div className="personalization-note">
                    <span className="ai-badge">📋 Clinical Standard</span>
                    <p>The GAD-7 is a validated clinical tool developed by Drs. Spitzer, Kroenke, Williams, and Löwe. It's used worldwide to assess generalized anxiety.</p>
                </div>
                <p className="section-desc">
                    Over the <strong>last 2 weeks</strong>, how often have you been bothered by the following?
                    <br />
                    <span className="disclaimer">These questions help us recommend careers matching your wellbeing needs. This is not a clinical diagnosis.</span>
                </p>

                <div className="assessment-questions">
                    {STANDARD_GAD7_QUESTIONS.map((q, idx) => {
                        const isUnanswered = step3Errors.some(err => err.index === idx);
                        return (
                            <div key={idx} className={`question-card mental-health ${isUnanswered ? 'unanswered' : ''}`}>
                                <p className="question-text">
                                    {idx + 1}. {q.question}
                                    {isUnanswered && <span className="required-indicator"> *</span>}
                                </p>
                                <div className="answer-options frequency">
                                    {FREQUENCY_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            className={`option-btn ${gadResponses[idx] === opt.value ? 'selected' : ''}`}
                                            onClick={() => setGadResponses({ ...gadResponses, [idx]: opt.value })}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="score-preview">
                    <span>Current Score: {calculateGADScore()} / 21</span>
                    <span className="severity" style={{ color: getSeverity(calculateGADScore(), 'gad').color }}>
                        {getSeverity(calculateGADScore(), 'gad').level} Anxiety Indicators
                    </span>
                </div>
            </div>
        </div>
    );

    // Form 4: Standard PHQ-9 Questions
    const renderStep4 = () => (
        <div className="onboarding-form">
            {/* Validation Alert Banner for Step 4 */}
            {showValidationAlert && step4Errors.length > 0 && (
                <div className="validation-alert">
                    <div className="validation-alert-icon">⚠️</div>
                    <div className="validation-alert-content">
                        <strong>Please answer all PHQ-9 questions before continuing</strong>
                        <p>You have {step4Errors.length} unanswered question(s):</p>
                        <ul>
                            {step4Errors.slice(0, 3).map((err, idx) => (
                                <li key={idx}>Question {err.index + 1}: "{err.question}"</li>
                            ))}
                            {step4Errors.length > 3 && (
                                <li>...and {step4Errors.length - 3} more</li>
                            )}
                        </ul>
                    </div>
                    <button className="validation-alert-close" onClick={() => setShowValidationAlert(false)}>×</button>
                </div>
            )}

            <div className="form-section">
                <h2>🌤️ Mood Screening (PHQ-9)</h2>
                <div className="personalization-note">
                    <span className="ai-badge">📋 Clinical Standard</span>
                    <p>The PHQ-9 is a validated clinical tool developed by Drs. Kroenke, Spitzer, and Williams. It's used worldwide to assess depression symptoms.</p>
                </div>
                <p className="section-desc">
                    Over the <strong>last 2 weeks</strong>, how often have you been bothered by the following?
                    <br />
                    <span className="disclaimer">These responses help match career recommendations to your wellbeing. This is not a clinical diagnosis.</span>
                </p>

                <div className="assessment-questions">
                    {STANDARD_PHQ9_QUESTIONS.map((q, idx) => {
                        const isUnanswered = step4Errors.some(err => err.index === idx);
                        return (
                            <div key={idx} className={`question-card mental-health ${isUnanswered ? 'unanswered' : ''}`}>
                                <p className="question-text">
                                    {idx + 1}. {q.question}
                                    {isUnanswered && <span className="required-indicator"> *</span>}
                                </p>
                                <div className="answer-options frequency">
                                    {FREQUENCY_OPTIONS.map(opt => (
                                        <button
                                            key={opt.value}
                                            type="button"
                                            className={`option-btn ${phqResponses[idx] === opt.value ? 'selected' : ''}`}
                                            onClick={() => setPhqResponses({ ...phqResponses, [idx]: opt.value })}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="score-preview">
                    <span>Current Score: {calculatePHQScore()} / 27</span>
                    <span className="severity" style={{ color: getSeverity(calculatePHQScore(), 'phq').color }}>
                        {getSeverity(calculatePHQScore(), 'phq').level} Mood Indicators
                    </span>
                </div>
            </div>
        </div>
    );

    // Step 5: Personalized AI Questions
    const renderStep5 = () => (
        <div className="onboarding-form">
            {/* Validation Alert Banner for Step 5 */}
            {showValidationAlert && step5Errors.length > 0 && (
                <div className="validation-alert">
                    <div className="validation-alert-icon">⚠️</div>
                    <div className="validation-alert-content">
                        <strong>Please answer all personalized questions before continuing</strong>
                        <p>You have {step5Errors.length} unanswered question(s):</p>
                        <ul>
                            {step5Errors.slice(0, 3).map((err, idx) => (
                                <li key={idx}>{err.category || 'Question'}: "{err.question}"</li>
                            ))}
                            {step5Errors.length > 3 && (
                                <li>...and {step5Errors.length - 3} more</li>
                            )}
                        </ul>
                    </div>
                    <button className="validation-alert-close" onClick={() => setShowValidationAlert(false)}>×</button>
                </div>
            )}

            <div className="form-section">
                <h2>🤖 Personalized Questions for You</h2>
                <div className="personalization-note">
                    <span className="ai-badge">✨ AI-Generated</span>
                    <p>{personalizationNote || 'Based on your complete profile, we\'ve crafted these questions specifically for you to better understand your career journey.'}</p>
                </div>
                <p className="section-desc">
                    These questions are tailored to your background as a <strong>{basicInfo.targetRole}</strong> with your unique personality type.
                </p>

                <div className="assessment-questions">
                    {personalizedQuestions.map((q, idx) => {
                        const isUnanswered = step5Errors.some(err => err.id === q.id);
                        return (
                            <div key={q.id} className={`question-card personalized ${isUnanswered ? 'unanswered' : ''}`}>
                                <div className="question-header">
                                    <span className="question-category">{q.category || 'Personal Insight'}</span>
                                </div>
                                <p className="question-text">
                                    {idx + 1}. {q.question}
                                    {isUnanswered && <span className="required-indicator"> *</span>}
                                </p>
                                {q.context && (
                                    <p className="question-context">
                                        <small>💡 {q.context}</small>
                                    </p>
                                )}
                                <div className="answer-options personalized-options">
                                    {(q.options || []).map((option, optIdx) => (
                                        <button
                                            key={optIdx}
                                            type="button"
                                            className={`option-btn personalized-option ${personalizedResponses[q.id] === option ? 'selected' : ''}`}
                                            onClick={() => setPersonalizedResponses({ ...personalizedResponses, [q.id]: option })}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="ai-note">
                    <span className="ai-badge">🎯 Final Step</span>
                    <p>After completing these questions, we'll generate your <strong>comprehensive career guidance</strong> including personalized job recommendations, skill development paths, and wellbeing-focused career tips.</p>
                </div>
            </div>
        </div>
    );

    // Step 6: AI-Generated Career Advice
    const renderStep6 = () => (
        <div className="onboarding-form">
            <div className="form-section results-section">
                <h2>🎯 Your Personalized Career Guidance</h2>
                <p className="section-desc">Based on your complete assessment, here's your AI-generated career roadmap</p>

                <div className="career-advice-content">
                    {careerAdvice ? (
                        <div className="advice-text" dangerouslySetInnerHTML={{
                            __html: (() => {
                                let html = careerAdvice;

                                // Step 1: Convert markdown links [text](url) to placeholder
                                html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
                                    '{{LINK:$2:TEXT:$1}}');

                                // Step 2: Convert standalone URLs (not already in a link)
                                html = html.replace(/(^|[^:])((https?:\/\/)[^\s<\]{}]+)/gm, (match, prefix, url) => {
                                    // Truncate long URLs for display
                                    const displayUrl = url.length > 50 ? url.substring(0, 50) + '...' : url;
                                    return `${prefix}{{LINK:${url}:TEXT:${displayUrl}}}`;
                                });

                                // Step 3: Headers
                                html = html.replace(/^## (.*?)$/gm, '</p><h3 class="advice-heading">$1</h3><p>');
                                html = html.replace(/^### (.*?)$/gm, '</p><h4 class="advice-subheading">$1</h4><p>');
                                html = html.replace(/^# (.*?)$/gm, '</p><h2 class="advice-title">$1</h2><p>');
                                html = html.replace(/^\d+\.\s*\*\*(.*?)\*\*:?/gm, '</p><h4 class="section-title">$1</h4><p>');

                                // Step 4: Bold text
                                html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

                                // Step 5: Bullet points
                                html = html.replace(/^\s*[-*]\s+/gm, '</p><li>');

                                // Step 6: Paragraphs
                                html = html.replace(/\n\n/g, '</p><p>');
                                html = html.replace(/\n/g, '<br/>');

                                // Step 7: Convert placeholders back to actual links
                                html = html.replace(/\{\{LINK:(.*?):TEXT:(.*?)\}\}/g,
                                    '<a href="$1" target="_blank" rel="noopener noreferrer" class="course-link">$2 🔗</a>');

                                return html;
                            })()
                        }} />
                    ) : (
                        <p>Generating your personalized career advice...</p>
                    )}
                </div>

                <div className="results-summary">
                    <div className="summary-card">
                        <h4>Your Holland Code</h4>
                        <span className="code-highlight">{calculateHollandCode()}</span>
                    </div>
                    <div className="summary-card">
                        <h4>Anxiety Level</h4>
                        <span style={{ color: getSeverity(calculateGADScore(), 'gad').color }}>
                            {getSeverity(calculateGADScore(), 'gad').level} ({calculateGADScore()}/21)
                        </span>
                    </div>
                    <div className="summary-card">
                        <h4>Mood Level</h4>
                        <span style={{ color: getSeverity(calculatePHQScore(), 'phq').color }}>
                            {getSeverity(calculatePHQScore(), 'phq').level} ({calculatePHQScore()}/27)
                        </span>
                    </div>
                </div>

                {/* Job Listings Section */}
                <div className="job-listings-section">
                    <h3>💼 Job Opportunities For You</h3>
                    <p className="section-desc">Real job openings matching your profile in {basicInfo.country || 'your region'}</p>

                    {jobListings.length > 0 ? (
                        <div className="job-listings-grid">
                            {jobListings.map((job, index) => (
                                <div key={index} className="job-card">
                                    <div className="job-card-header">
                                        <h4 className="job-title">{job.job_title}</h4>
                                        {job.job_type && (
                                            <span className="job-type-badge">{job.job_type}</span>
                                        )}
                                    </div>
                                    <div className="job-company">
                                        <span className="company-icon">🏢</span>
                                        {job.company_name}
                                    </div>
                                    {job.location && (
                                        <div className="job-location">
                                            <span className="location-icon">📍</span>
                                            {job.location}
                                        </div>
                                    )}
                                    {job.salary && (
                                        <div className="job-salary">
                                            <span className="salary-icon">💰</span>
                                            {job.salary}
                                        </div>
                                    )}
                                    {job.posted_date && (
                                        <div className="job-posted">
                                            <span className="posted-icon">📅</span>
                                            Posted: {job.posted_date}
                                        </div>
                                    )}
                                    {job.description && (
                                        <p className="job-description">
                                            {job.description.length > 200
                                                ? job.description.substring(0, 200) + '...'
                                                : job.description}
                                        </p>
                                    )}
                                    <a
                                        href={job.apply_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="apply-btn"
                                    >
                                        Apply Now →
                                    </a>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="no-jobs-message">
                            <p>🔍 No job listings were found for "{basicInfo.targetRole}" in {basicInfo.country || 'your region'}.</p>
                            <p>Try these job portals:</p>
                            <div className="job-portal-links">
                                <a
                                    href={`https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(basicInfo.targetRole)}&location=${encodeURIComponent(basicInfo.country || '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="portal-link"
                                >
                                    🔗 LinkedIn Jobs
                                </a>
                                <a
                                    href={`https://www.indeed.com/jobs?q=${encodeURIComponent(basicInfo.targetRole)}&l=${encodeURIComponent(basicInfo.country || '')}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="portal-link"
                                >
                                    🔗 Indeed
                                </a>
                                <a
                                    href={`https://www.glassdoor.com/Job/jobs.htm?sc.keyword=${encodeURIComponent(basicInfo.targetRole)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="portal-link"
                                >
                                    🔗 Glassdoor
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                <div className="next-actions">
                    <button
                        className="btn-primary"
                        onClick={() => navigate('/dashboard')}
                    >
                        Go to Dashboard
                    </button>
                    <button
                        className="btn-secondary"
                        onClick={() => navigate('/assistant')}
                    >
                        Chat with AI Assistant
                    </button>
                </div>
            </div>
        </div>
    );

    const canProceed = () => {
        switch (currentStep) {
            case 1:
                // Form 1 (Basic Info) - All fields are required
                return basicInfo.fullName?.trim() &&
                    basicInfo.educationLevel &&
                    basicInfo.targetRole?.trim() &&
                    basicInfo.country &&
                    basicInfo.skills?.trim();
            case 2:
                // Form 2 (Interests) - Optional, can proceed with empty fields
                return true;
            case 3:
                // Form 3 (GAD-7) - Optional, can proceed with empty fields
                return true;
            case 4:
                // Form 4 (PHQ-9) - Optional, can proceed with empty fields
                return true;
            case 5:
                // Form 5 (AI Questions) - Optional, can proceed with empty fields
                return true;
            default:
                return true;
        }
    };

    return (
        <div className="onboarding-container" ref={containerRef}>
            <div className="onboarding-header">
                <h1>Career Discovery Assessment</h1>
                <p>Complete this AI-powered assessment to receive personalized career guidance</p>
            </div>

            {renderProgressBar()}

            {error && (
                <div className="error-banner">
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError('')}>×</button>
                </div>
            )}

            {currentStep === 1 && Object.keys(step1Errors).some(key => step1Errors[key]) && (
                <div className="error-banner" style={{ marginTop: '20px' }}>
                    <span>⚠️ Please fill in all required fields before continuing</span>
                </div>
            )}

            <div className="onboarding-content">
                {currentStep === 1 && renderStep1()}
                {currentStep === 2 && renderStep2()}
                {currentStep === 3 && renderStep3()}
                {currentStep === 4 && renderStep4()}
                {currentStep === 5 && renderStep5()}
                {currentStep === 6 && renderStep6()}
            </div>

            {currentStep < 6 && (
                <div className="onboarding-actions">
                    {currentStep === 1 && (
                        <button type="button" className="btn-secondary" onClick={handleBack} disabled={isLoading} style={{ visibility: 'hidden' }}>
                            ← Back
                        </button>
                    )}
                    {currentStep > 1 && (
                        <button type="button" className="btn-secondary" onClick={handleBack} disabled={isLoading}>
                            ← Back
                        </button>
                    )}

                    <div className="next-button-container">
                        <button
                            type="button"
                            className={`btn-primary ${currentStep === 5 ? 'btn-success' : ''}`}
                            onClick={handleNext}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <span>🔄 Generating with AI...</span>
                            ) : currentStep === 2 ? (
                                '📋 Proceed to Clinical Assessment →'
                            ) : currentStep === 4 ? (
                                '🤖 Generate Personalized Questions'
                            ) : currentStep === 5 ? (
                                '🎯 Generate My Career Advice'
                            ) : (
                                'Continue →'
                            )}
                        </button>
                        {isLoading && (
                            <div className="loading-wait-message">
                                <span className="loading-spinner-small"></span>
                                <span>{currentStep === 4 ? 'Generating personalized questions based on your profile...' : 'Please wait while AI generates your personalized career advice...'}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
