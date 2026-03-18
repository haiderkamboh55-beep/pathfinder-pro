import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import ReCAPTCHA from 'react-google-recaptcha';

export default function LoginPage({ onLoginSuccess }) {
    const navigate = useNavigate();
    const [isLogin, setIsLogin] = useState(true);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        fullName: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [resetEmailSent, setResetEmailSent] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [nameWarning, setNameWarning] = useState('');
    const [passwordWarning, setPasswordWarning] = useState('');
    const [captchaVerified, setCaptchaVerified] = useState(false);
    const recaptchaRef = useRef(null);

    // Get reCAPTCHA site key from environment
    const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    const isCaptchaConfigured = RECAPTCHA_SITE_KEY && !RECAPTCHA_SITE_KEY.includes('YOUR_');

    const handleCaptchaChange = (value) => {
        setCaptchaVerified(!!value);
    };

    const resetCaptcha = () => {
        if (recaptchaRef.current) {
            recaptchaRef.current.reset();
        }
        setCaptchaVerified(false);
    };

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

        // For password field, show warning if less than 8 characters (only for sign up)
        if (field === 'password' && !isLogin) {
            if (value.length > 0 && value.length < 8) {
                setPasswordWarning('Password must be at least 8 characters long.');
            } else {
                setPasswordWarning('');
            }
        }

        setFormData(prev => ({ ...prev, [field]: value }));
        setError('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        // Check CAPTCHA if configured
        if (isCaptchaConfigured && !captchaVerified) {
            setError('Please complete the human verification.');
            setLoading(false);
            return;
        }

        try {
            const { data, error: supabaseError } = await supabase.auth.signInWithPassword({
                email: formData.email,
                password: formData.password,
            });

            if (supabaseError) throw supabaseError;
            onLoginSuccess?.(data.user || { email: formData.email });
        } catch (err) {
            console.error('Login failed', err);
            setError(err.message || 'Login failed. Please check your credentials.');
            resetCaptcha();
        } finally {
            setLoading(false);
        }
    };

    const handleSignUp = async (e) => {
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
                    data: { full_name: formData.fullName }
                }
            });

            if (signUpError) throw signUpError;

            if (data.user) {
                await supabase.from('profiles').upsert({
                    id: data.user.id,
                    full_name: formData.fullName,
                    email: formData.email
                }, { onConflict: 'id' });
            }

            setSuccess(true);
        } catch (err) {
            console.error('Sign up error:', err);
            setError(err.message || 'Failed to create account. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (!formData.email) {
            setError('Please enter your email address');
            setLoading(false);
            return;
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            setError('Please enter a valid email address');
            setLoading(false);
            return;
        }

        try {
            // Method 1: Check via backend API (queries profiles table)
            let emailExists = false;

            try {
                const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/check-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: formData.email })
                });

                if (response.ok) {
                    const data = await response.json();
                    emailExists = data.exists;

                    if (!emailExists) {
                        setError('This user doesn\'t exist. Please check your email address.');
                        setLoading(false);
                        return;
                    }
                }
            } catch (backendErr) {
                console.log('Backend check failed, using fallback method');
                // Fallback: Try sign-in attempt to check if email exists
                const { error: signInError } = await supabase.auth.signInWithPassword({
                    email: formData.email,
                    password: 'dummy_password_check_12345'
                });

                if (signInError) {
                    const errorMessage = signInError.message.toLowerCase();
                    // These errors indicate the email EXISTS
                    if (!errorMessage.includes('invalid login credentials') &&
                        !errorMessage.includes('email not confirmed') &&
                        !errorMessage.includes('invalid password')) {
                        setError('This user doesn\'t exist. Please check your email address.');
                        setLoading(false);
                        return;
                    }
                }
            }

            // Email exists (or we couldn't verify), proceed with password reset
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(
                formData.email,
                {
                    redirectTo: `${window.location.origin}/reset-password`,
                }
            );

            if (resetError) throw resetError;
            setResetEmailSent(true);

        } catch (err) {
            console.error('Password reset error:', err);
            setError(err.message || 'Failed to send reset email. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Scroll to top when success page shows
    React.useEffect(() => {
        if (success) {
            window.scrollTo({ top: 0, behavior: 'instant' });
        }
    }, [success]);

    // Reset email sent success view
    if (resetEmailSent) {
        return (
            <section className="auth-page">
                <div className="auth-card success-card">
                    <div className="success-icon">📧</div>
                    <h2>Check Your Email</h2>
                    <p>We've sent a password reset link to <strong>{formData.email}</strong></p>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '12px' }}>
                        If the email exists in our system, you'll receive a reset link shortly.
                        Check your spam folder if you don't see it.
                    </p>
                    <button
                        className="primary-cta"
                        style={{ marginTop: '24px' }}
                        onClick={() => { setResetEmailSent(false); setShowForgotPassword(false); setIsLogin(true); }}
                    >
                        Back to Login
                    </button>
                </div>
            </section>
        );
    }

    if (success) {
        return (
            <section className="auth-page">
                <div className="auth-card success-card">
                    <div className="success-icon">✓</div>
                    <h2>Account Created!</h2>
                    <p>Please check your email to confirm your account, then you can sign in.</p>
                    <button
                        className="primary-cta"
                        style={{ marginTop: '24px' }}
                        onClick={() => { setSuccess(false); setIsLogin(true); }}
                    >
                        Go to Login
                    </button>
                </div>
            </section>
        );
    }

    // Forgot Password View
    if (showForgotPassword) {
        return (
            <section className="auth-page">
                <div className="auth-container">
                    <div className="auth-card">
                        <div className="auth-header">
                            <div className="logo-mark">PF</div>
                            <h1>Reset Password</h1>
                            <p>Enter your email address and we'll send you a reset link</p>
                        </div>

                        <form className="auth-form" onSubmit={handleForgotPassword}>
                            <div className="field">
                                <label>Email Address</label>
                                <input
                                    type="email"
                                    autoComplete="email"
                                    value={formData.email}
                                    onChange={(e) => handleChange('email', e.target.value)}
                                    placeholder="you@example.com"
                                    required
                                />
                            </div>

                            {error && <div className="error-banner">{error}</div>}

                            <button className="primary-cta full-width" type="submit" disabled={loading}>
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </button>

                            <p className="auth-footer-text">
                                Remember your password? <button type="button" className="link-btn" onClick={() => { setShowForgotPassword(false); setError(''); }}>Back to Login</button>
                            </p>
                        </form>
                    </div>
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
                        <h1>{isLogin ? 'Welcome back' : 'Create your account'}</h1>
                        <p>{isLogin ? 'Sign in to continue your career journey' : 'Start your AI-powered career journey today'}</p>
                    </div>

                    {/* Toggle Tabs */}
                    <div className="auth-tabs">
                        <button
                            className={`auth-tab ${isLogin ? 'active' : ''}`}
                            onClick={() => { setIsLogin(true); setError(''); }}
                        >
                            Sign In
                        </button>
                        <button
                            className={`auth-tab ${!isLogin ? 'active' : ''}`}
                            onClick={() => { setIsLogin(false); setError(''); }}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form className="auth-form" onSubmit={isLogin ? handleLogin : handleSignUp}>
                        {!isLogin && (
                            <div className="field">
                                <label>Full Name</label>
                                <input
                                    type="text"
                                    placeholder="John Doe"
                                    value={formData.fullName}
                                    onChange={(e) => handleChange('fullName', e.target.value)}
                                    required={!isLogin}
                                />
                                {nameWarning && <span className="field-warning">{nameWarning}</span>}
                            </div>
                        )}

                        <div className="field">
                            <label>Email Address</label>
                            <input
                                type="email"
                                autoComplete="email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                placeholder="you@example.com"
                                required
                            />
                        </div>

                        <div className="field">
                            <label>Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    autoComplete={isLogin ? "current-password" : "new-password"}
                                    value={formData.password}
                                    onChange={(e) => handleChange('password', e.target.value)}
                                    placeholder="••••••••"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    className="password-toggle-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                    tabIndex={-1}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                >
                                    {showPassword ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                        </svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                        </svg>
                                    )}
                                </button>
                            </div>
                            {!isLogin && passwordWarning && <span className="field-warning">{passwordWarning}</span>}
                        </div>

                        {isLogin && (
                            <div className="forgot-password-link">
                                <button
                                    type="button"
                                    className="link-btn"
                                    onClick={() => { setShowForgotPassword(true); setError(''); }}
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        )}

                        {!isLogin && (
                            <div className="field">
                                <label>Confirm Password</label>
                                <div className="password-input-wrapper">
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        value={formData.confirmPassword}
                                        onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                        placeholder="••••••••"
                                        required={!isLogin}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle-btn"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        tabIndex={-1}
                                        aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                                    >
                                        {showConfirmPassword ? (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                                <line x1="1" y1="1" x2="23" y2="23" />
                                            </svg>
                                        ) : (
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                <circle cx="12" cy="12" r="3" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && <div className="error-banner">{error}</div>}

                        {/* reCAPTCHA Human Verification */}
                        {isCaptchaConfigured && (
                            <div className="captcha-container" style={{ display: 'flex', justifyContent: 'center', margin: '16px 0' }}>
                                <ReCAPTCHA
                                    ref={recaptchaRef}
                                    sitekey={RECAPTCHA_SITE_KEY}
                                    onChange={handleCaptchaChange}
                                    theme="light"
                                />
                            </div>
                        )}

                        <button className="primary-cta full-width" type="submit" disabled={loading || (isCaptchaConfigured && !captchaVerified)}>
                            {loading
                                ? (isLogin ? 'Signing in...' : 'Creating Account...')
                                : (isLogin ? 'Sign In' : 'Create Account')
                            }
                        </button>

                        <p className="auth-footer-text">
                            {isLogin ? (
                                <>Don't have an account? <button type="button" className="link-btn" onClick={() => setIsLogin(false)}>Create one</button></>
                            ) : (
                                <>Already have an account? <button type="button" className="link-btn" onClick={() => setIsLogin(true)}>Sign in</button></>
                            )}
                        </p>
                    </form>
                </div>

                <div className="auth-benefits">
                    <h3>Why join PathFinder Pro?</h3>
                    <ul className="benefits-list">
                        <li>
                            <span className="benefit-icon benefit-icon-ai">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z" />
                                    <path d="M16 11v1a4 4 0 0 1-8 0v-1" />
                                    <line x1="12" y1="16" x2="12" y2="22" />
                                    <line x1="8" y1="22" x2="16" y2="22" />
                                    <circle cx="12" cy="6" r="1" fill="currentColor" />
                                </svg>
                            </span>
                            <div>
                                <strong>AI-Powered Insights</strong>
                                <p>Get personalized career recommendations powered by Gemini</p>
                            </div>
                        </li>
                        <li>
                            <span className="benefit-icon benefit-icon-health">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                                </svg>
                            </span>
                            <div>
                                <strong>Mental Health First</strong>
                                <p>Career suggestions that consider your wellbeing</p>
                            </div>
                        </li>
                        <li>
                            <span className="benefit-icon benefit-icon-data">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="20" x2="18" y2="10" />
                                    <line x1="12" y1="20" x2="12" y2="4" />
                                    <line x1="6" y1="20" x2="6" y2="14" />
                                    <line x1="2" y1="20" x2="22" y2="20" />
                                </svg>
                            </span>
                            <div>
                                <strong>Real Market Data</strong>
                                <p>Live job trends from LinkedIn and Indeed</p>
                            </div>
                        </li>
                        <li>
                            <span className="benefit-icon benefit-icon-target">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="10" />
                                    <circle cx="12" cy="12" r="6" />
                                    <circle cx="12" cy="12" r="2" />
                                </svg>
                            </span>
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
