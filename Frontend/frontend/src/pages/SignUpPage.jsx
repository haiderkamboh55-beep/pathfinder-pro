import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function SignUpPage({ onSignUpSuccess }) {
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [nameWarning, setNameWarning] = useState('');
    const [passwordWarning, setPasswordWarning] = useState('');

    const handleChange = (field, value) => {
        // For fullName field, only allow alphabets and spaces
        if (field === 'fullName') {
            // Check if the value contains any non-alphabet characters
            if (/[^a-zA-Z\s]/.test(value)) {
                setNameWarning('Only alphabets are allowed. Numbers and special characters are not permitted.');
                // Remove any characters that are not letters or spaces
                value = value.replace(/[^a-zA-Z\s]/g, '');
                // Clear warning after 3 seconds
                setTimeout(() => setNameWarning(''), 3000);
            } else {
                setNameWarning('');
            }
        }

        // For password field, show warning if less than 8 characters
        if (field === 'password') {
            if (value.length > 0 && value.length < 8) {
                setPasswordWarning('Password must be at least 8 characters long.');
            } else {
                setPasswordWarning('');
            }
        }

        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }

        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters');
            setLoading(false);
            return;
        }

        try {
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        full_name: formData.fullName
                    }
                }
            });

            if (signUpError) throw signUpError;

            // Update profile with full name
            if (data.user) {
                await supabase.from('profiles').upsert({
                    id: data.user.id,
                    full_name: formData.fullName
                }, { onConflict: 'id' });
            }

            setSuccess(true);
            onSignUpSuccess?.(data.user);
        } catch (err) {
            console.error('Sign up error:', err);
            setError(err.message || 'Failed to create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (success) {
        return (
            <section className="auth-page">
                <div className="auth-card success-card">
                    <div className="success-icon">✓</div>
                    <h2>Account Created!</h2>
                    <p>Please check your email to confirm your account, then you can sign in.</p>
                    <Link to="/login" className="primary-cta">Go to Login</Link>
                </div>
            </section>
        );
    }

    return (
        <section className="auth-page">
            <div className="auth-container">
                <div className="auth-card">
                    <div className="auth-header">
                        <div className="logo-mark">PF</div>
                        <h1>Create your account</h1>
                        <p>Start your AI-powered career journey today</p>
                    </div>

                    <form className="auth-form" onSubmit={handleSubmit}>
                        <div className="field">
                            <label>Full Name</label>
                            <input
                                type="text"
                                placeholder="John Doe"
                                value={formData.fullName}
                                onChange={(e) => handleChange('fullName', e.target.value)}
                                required
                            />
                            {nameWarning && <span className="field-warning">{nameWarning}</span>}
                        </div>

                        <div className="field">
                            <label>Email Address</label>
                            <input
                                type="email"
                                placeholder="you@example.com"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                required
                            />
                        </div>

                        <div className="field">
                            <label>Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={formData.password}
                                onChange={(e) => handleChange('password', e.target.value)}
                                required
                                minLength={8}
                            />
                            {passwordWarning && <span className="field-warning">{passwordWarning}</span>}
                        </div>

                        <div className="field">
                            <label>Confirm Password</label>
                            <input
                                type="password"
                                placeholder="••••••••"
                                value={formData.confirmPassword}
                                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                required
                            />
                        </div>

                        {error && <div className="error-banner">{error}</div>}

                        <button type="submit" className="primary-cta full-width" disabled={loading}>
                            {loading ? 'Creating Account...' : 'Create Account'}
                        </button>

                        <p className="auth-footer-text">
                            Already have an account? <Link to="/login">Sign in</Link>
                        </p>
                    </form>
                </div>

                <div className="auth-benefits">
                    <h3>Why join PathFinder Pro?</h3>
                    <ul className="benefits-list">
                        <li>
                            <span className="benefit-icon">🧠</span>
                            <div>
                                <strong>AI-Powered Insights</strong>
                                <p>Get personalized career recommendations powered by Gemini</p>
                            </div>
                        </li>
                        <li>
                            <span className="benefit-icon">💚</span>
                            <div>
                                <strong>Mental Health First</strong>
                                <p>Career suggestions that consider your wellbeing</p>
                            </div>
                        </li>
                        <li>
                            <span className="benefit-icon">📊</span>
                            <div>
                                <strong>Real Market Data</strong>
                                <p>Live job trends from LinkedIn and Indeed</p>
                            </div>
                        </li>
                        <li>
                            <span className="benefit-icon">🎯</span>
                            <div>
                                <strong>Skill Gap Analysis</strong>
                                <p>Know exactly what to learn for your dream role</p>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </section>
    );
}
