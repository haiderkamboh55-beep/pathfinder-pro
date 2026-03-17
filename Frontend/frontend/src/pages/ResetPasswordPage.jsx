import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function ResetPasswordPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [initializing, setInitializing] = useState(true);
    const [sessionReady, setSessionReady] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordWarning, setPasswordWarning] = useState('');

    useEffect(() => {
        const handleRecovery = async () => {
            try {
                // Get all possible parameters
                const code = searchParams.get('code');
                const token = searchParams.get('token');
                const tokenHash = searchParams.get('token_hash');
                const type = searchParams.get('type');

                // Also check for hash fragment (older flow or some email clients)
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const hashType = hashParams.get('type');

                console.log('=== Reset Password Debug ===');
                console.log('Full URL:', window.location.href);
                console.log('Code param:', code);
                console.log('Token param:', token);
                console.log('Token hash param:', tokenHash);
                console.log('Type param:', type);
                console.log('Hash access_token:', accessToken ? 'present' : 'none');
                console.log('Hash type:', hashType);

                // Method 1: Try PKCE code exchange
                if (code) {
                    console.log('Attempting PKCE code exchange...');

                    try {
                        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

                        if (exchangeError) {
                            console.error('PKCE exchange failed:', exchangeError.message);
                            // PKCE failed - this is common when email opened in different context
                            // Try to get any existing session that might have been set by Supabase
                            const { data: { session } } = await supabase.auth.getSession();
                            if (session) {
                                console.log('Found existing session despite PKCE failure');
                                setSessionReady(true);
                                return;
                            }
                            throw exchangeError;
                        } else if (data.session) {
                            console.log('PKCE exchange successful!');
                            setSessionReady(true);
                            return;
                        }
                    } catch (pkceError) {
                        console.error('PKCE flow error:', pkceError);
                        // Continue to try other methods
                    }
                }

                // Method 2: Try token_hash verification (magic link style)
                if (tokenHash && type === 'recovery') {
                    console.log('Attempting token hash verification...');
                    const { data, error: verifyError } = await supabase.auth.verifyOtp({
                        token_hash: tokenHash,
                        type: 'recovery'
                    });

                    if (!verifyError && data.session) {
                        console.log('Token hash verification successful!');
                        setSessionReady(true);
                        return;
                    }
                    console.error('Token hash verification failed:', verifyError);
                }

                // Method 3: Handle hash fragment flow (older method)
                if (accessToken && hashType === 'recovery') {
                    console.log('Attempting hash fragment session...');
                    const { data, error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken
                    });

                    if (!sessionError && data.session) {
                        console.log('Hash fragment session successful!');
                        setSessionReady(true);
                        window.history.replaceState({}, document.title, window.location.pathname);
                        return;
                    }
                    console.error('Hash fragment session failed:', sessionError);
                }

                // Method 4: Check for existing session (might have been set by redirect)
                console.log('Checking for existing session...');
                const { data: { session: existingSession } } = await supabase.auth.getSession();
                if (existingSession) {
                    console.log('Found existing session');
                    setSessionReady(true);
                    return;
                }

                // Method 5: Wait for auth state change (Supabase might handle it automatically)
                console.log('Waiting for auth state change...');
                await new Promise(resolve => setTimeout(resolve, 2000));

                const { data: { session: delayedSession } } = await supabase.auth.getSession();
                if (delayedSession) {
                    console.log('Session found after delay');
                    setSessionReady(true);
                    return;
                }

                // All methods failed
                console.log('All recovery methods failed');
                setError('Your reset link has expired or is invalid. Please request a new one.');

            } catch (err) {
                console.error('Recovery error:', err);
                setError('Something went wrong. Please try again.');
            } finally {
                setInitializing(false);
            }
        };

        // Listen for auth state changes - this catches PASSWORD_RECOVERY events
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth state change:', event, session ? 'has session' : 'no session');
            if (event === 'PASSWORD_RECOVERY') {
                console.log('PASSWORD_RECOVERY event received!');
                setSessionReady(true);
                setInitializing(false);
            } else if (event === 'SIGNED_IN' && session) {
                console.log('SIGNED_IN event with session');
                setSessionReady(true);
                setInitializing(false);
            }
        });

        // Run the recovery handler
        handleRecovery();

        return () => subscription.unsubscribe();
    }, [searchParams]);

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({
                password: password
            });

            if (updateError) throw updateError;

            setSuccess(true);

            // Sign out and redirect to login after 3 seconds
            setTimeout(async () => {
                await supabase.auth.signOut();
                navigate('/login');
            }, 3000);
        } catch (err) {
            console.error('Password update error:', err);
            setError(err.message || 'Failed to update password. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (initializing) {
        return (
            <section className="auth-page">
                <div className="auth-card success-card">
                    <div className="logo-mark">PF</div>
                    <h2>Verifying...</h2>
                    <p>Please wait while we verify your reset link.</p>
                </div>
            </section>
        );
    }

    if (success) {
        return (
            <section className="auth-page">
                <div className="auth-card success-card">
                    <div className="success-icon">✓</div>
                    <h2>Password Updated!</h2>
                    <p>Your password has been successfully changed.</p>
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '12px' }}>
                        Redirecting you to login...
                    </p>
                </div>
            </section>
        );
    }

    if (error && !sessionReady) {
        return (
            <section className="auth-page">
                <div className="auth-card success-card">
                    <div className="success-icon" style={{ background: '#f59e0b' }}>⚠️</div>
                    <h2>Link Expired</h2>
                    <p>{error}</p>
                    <button
                        className="primary-cta"
                        style={{ marginTop: '24px' }}
                        onClick={() => navigate('/login')}
                    >
                        Back to Login
                    </button>
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
                        <h1>Set New Password</h1>
                        <p>Enter your new password below</p>
                    </div>

                    <form className="auth-form" onSubmit={handleResetPassword}>
                        <div className="field">
                            <label>New Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    value={password}
                                    onChange={(e) => {
                                        setPassword(e.target.value);
                                        setError('');
                                        if (e.target.value.length > 0 && e.target.value.length < 8) {
                                            setPasswordWarning('Password must be at least 8 characters long.');
                                        } else {
                                            setPasswordWarning('');
                                        }
                                    }}
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
                            {passwordWarning && <span className="field-warning">{passwordWarning}</span>}
                        </div>

                        <div className="field">
                            <label>Confirm New Password</label>
                            <div className="password-input-wrapper">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    autoComplete="new-password"
                                    value={confirmPassword}
                                    onChange={(e) => { setConfirmPassword(e.target.value); setError(''); }}
                                    placeholder="••••••••"
                                    required
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

                        {error && <div className="error-banner">{error}</div>}

                        <button className="primary-cta full-width" type="submit" disabled={loading}>
                            {loading ? 'Updating Password...' : 'Update Password'}
                        </button>

                        <p className="auth-footer-text">
                            <button type="button" className="link-btn" onClick={() => navigate('/login')}>
                                Back to Login
                            </button>
                        </p>
                    </form>
                </div>
            </div>
        </section>
    );
}
