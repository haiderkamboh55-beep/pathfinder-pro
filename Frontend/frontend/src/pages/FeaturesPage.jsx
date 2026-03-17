import React from 'react';

const features = [
    {
        icon: '🧠',
        title: 'AI-Powered Career Matching',
        description: 'Our Gemini-powered AI analyzes your psychological profile, skills, and preferences to suggest careers that truly fit you.',
        highlight: 'Machine Learning'
    },
    {
        icon: '📊',
        title: 'Real-Time Market Analytics',
        description: 'Live job market data from LinkedIn and Indeed APIs to ensure recommendations align with actual demand.',
        highlight: 'Live Data'
    },
    {
        icon: '💚',
        title: 'Mental Health Compatibility',
        description: 'Integrates GAD-7 and PHQ-9 assessments to recommend roles that support your wellbeing.',
        highlight: 'Well-being First'
    },
    {
        icon: '🎯',
        title: 'Skill Gap Detection',
        description: 'NLP-powered analysis identifies gaps between your current skills and target roles, with course recommendations.',
        highlight: 'Upskilling'
    },
    {
        icon: '🤖',
        title: 'Intelligent Chatbot',
        description: 'Get personalized career advice anytime through our conversational AI assistant.',
        highlight: 'LangChain'
    },
    {
        icon: '🏆',
        title: 'Gamified Progress',
        description: 'Track your career development journey with badges, levels, and milestone achievements.',
        highlight: 'Engagement'
    },
    {
        icon: '📈',
        title: 'Market Trends Dashboard',
        description: 'Visualize in-demand skills, salary trends, and career outlooks at a glance.',
        highlight: 'Insights'
    },
    {
        icon: '🔒',
        title: 'Secure & Private',
        description: 'Your data is protected with enterprise-grade security and Row Level Security policies.',
        highlight: 'Privacy'
    }
];

export default function FeaturesPage() {
    return (
        <>
            <section className="page-hero">
                <div className="page-hero-content">
                    <span className="hero-badge">Platform Features</span>
                    <h1>
                        Everything you need for
                        <span className="accent-gradient"> career success</span>
                    </h1>
                    <p className="hero-description">
                        PathFinder Pro combines cutting-edge AI, psychological profiling, and real-time market data
                        to deliver a comprehensive career guidance experience.
                    </p>
                </div>
            </section>

            <section className="features-grid">
                {features.map((feature, index) => (
                    <div key={index} className="feature-card">
                        <div className="feature-icon">{feature.icon}</div>
                        <div className="feature-content">
                            <span className="feature-highlight">{feature.highlight}</span>
                            <h3>{feature.title}</h3>
                            <p>{feature.description}</p>
                        </div>
                    </div>
                ))}
            </section>

            <section className="cta-section">
                <div className="cta-card">
                    <h2>Ready to discover your ideal career path?</h2>
                    <p>Join thousands of professionals using AI to navigate their careers with confidence.</p>
                    <div className="cta-buttons">
                        <a href="/signup" className="primary-cta">Start Free Today</a>
                        <a href="/about" className="ghost-cta">Learn More</a>
                    </div>
                </div>
            </section>
        </>
    );
}
