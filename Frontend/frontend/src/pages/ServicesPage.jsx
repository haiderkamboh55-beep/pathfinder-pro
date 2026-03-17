import React from 'react';

const services = [
    {
        tier: 'Explorer',
        price: 'Free',
        description: 'Perfect for getting started with AI-powered career guidance.',
        features: [
            'Basic career assessments',
            'AI chatbot (5 queries/day)',
            'Skills profile creation',
            'Market trends overview',
            'Community access'
        ],
        cta: 'Get Started',
        popular: false
    },
    {
        tier: 'Professional',
        price: '$19/mo',
        description: 'Comprehensive tools for serious career development.',
        features: [
            'Everything in Explorer',
            'Unlimited AI chatbot access',
            'Full GAD-7 & PHQ-9 assessments',
            'Personalized skill gap analysis',
            'Course recommendations',
            'Job matching (LinkedIn & Indeed)',
            'Progress tracking & badges',
            'Priority support'
        ],
        cta: 'Start Free Trial',
        popular: true
    },
    {
        tier: 'Enterprise',
        price: 'Custom',
        description: 'For organizations investing in employee career development.',
        features: [
            'Everything in Professional',
            'Bulk user management',
            'Custom assessments',
            'API access',
            'SSO integration',
            'Dedicated success manager',
            'Custom reporting',
            'White-label options'
        ],
        cta: 'Contact Sales',
        popular: false
    }
];

const integrations = [
    { name: 'LinkedIn', desc: 'Real-time job postings' },
    { name: 'Indeed', desc: 'Internship opportunities' },
    { name: 'Coursera', desc: 'Learning recommendations' },
    { name: 'Udemy', desc: 'Skill development courses' }
];

export default function ServicesPage() {
    return (
        <>
            <section className="page-hero">
                <div className="page-hero-content">
                    <span className="hero-badge">Pricing & Services</span>
                    <h1>
                        Choose the plan that
                        <span className="accent-gradient"> fits your journey</span>
                    </h1>
                    <p className="hero-description">
                        From individual career seekers to enterprise teams, we have solutions
                        that scale with your needs.
                    </p>
                </div>
            </section>

            <section className="pricing-grid">
                {services.map((service, index) => (
                    <div key={index} className={`pricing-card ${service.popular ? 'popular' : ''}`}>
                        {service.popular && <span className="popular-badge">Most Popular</span>}
                        <div className="pricing-header">
                            <h3>{service.tier}</h3>
                            <div className="pricing-amount">{service.price}</div>
                            <p>{service.description}</p>
                        </div>
                        <ul className="pricing-features">
                            {service.features.map((feature, idx) => (
                                <li key={idx}>
                                    <span className="check-icon">✓</span>
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <a href="/signup" className={service.popular ? 'primary-cta' : 'ghost-cta'}>
                            {service.cta}
                        </a>
                    </div>
                ))}
            </section>

            <section className="integrations-section">
                <h2>Powered by Industry-Leading Integrations</h2>
                <div className="integrations-grid">
                    {integrations.map((item, index) => (
                        <div key={index} className="integration-card">
                            <h4>{item.name}</h4>
                            <p>{item.desc}</p>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
}
