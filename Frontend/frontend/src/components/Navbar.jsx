import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

export default function Navbar({ authUser, onLogout }) {
    const location = useLocation();
    const [theme, setTheme] = useState(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('theme');
            if (saved) return saved;
            return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
        }
        return 'dark';
    });

    const [sidebarOpen, setSidebarOpen] = useState(true);

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    // Check if we're on a page that should show sidebar (authenticated pages)
    const showSidebar = authUser && ['/dashboard', '/assistant', '/onboarding', '/achievements', '/profile', '/history'].some(p => location.pathname.startsWith(p));

    if (showSidebar) {
        return (
            <aside className="sidebar">
                <div className="sidebar-header">
                    <div className="logo-area">
                        <img src="/logo.png" alt="PathFinder Pro" className="logo-image" />
                        <div className="sidebar-brand">
                            <div className="logo-title">PathFinder</div>
                            <div className="logo-subtitle">Pro</div>
                        </div>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <div className="nav-section">
                        <span className="nav-section-label">Main</span>
                        <NavLink to="/dashboard" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            Dashboard
                        </NavLink>
                        <NavLink to="/onboarding" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            Career Discovery
                        </NavLink>

                        <NavLink to="/assistant" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            AI Assistant
                        </NavLink>
                        <NavLink to="/achievements" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            Achievements
                        </NavLink>
                        <NavLink to="/profile" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            My Profile
                        </NavLink>
                        <NavLink to="/history" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            📊 Assessment History
                        </NavLink>
                    </div>

                    <div className="nav-section">
                        <span className="nav-section-label">Explore</span>
                        <NavLink to="/" end className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            Home
                        </NavLink>
                        <NavLink to="/features" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            Features
                        </NavLink>
                        <NavLink to="/services" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            Services
                        </NavLink>
                        <NavLink to="/about" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
                            About
                        </NavLink>
                    </div>
                </nav>

                <div className="sidebar-footer">
                    <button className="theme-toggle sidebar-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                        {theme === 'dark' ? '☀️' : '🌙'}
                    </button>
                    <button className="sidebar-logout" onClick={onLogout}>
                        Sign Out
                    </button>
                </div>
            </aside>
        );
    }

    // Regular top navbar for public pages
    return (
        <header className="app-header">
            <div className="logo-area">
                <img src="/logo.png" alt="PathFinder Pro" className="logo-image" />
                <div>
                    <div className="logo-title">PathFinder Pro</div>
                    <div className="logo-subtitle">AI-Powered Career Navigation</div>
                </div>
            </div>
            <nav className="nav-links">
                <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                    Home
                </NavLink>
                <NavLink to="/features" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                    Features
                </NavLink>
                <NavLink to="/services" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                    Services
                </NavLink>
                <NavLink to="/about" className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}>
                    About
                </NavLink>

                <button className="theme-toggle" onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
                    <span className="icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
                </button>

                {!authUser ? (
                    <NavLink to="/login" className={({ isActive }) => `nav-link nav-link-accent ${isActive ? 'nav-link-active' : ''}`}>
                        Get Started
                    </NavLink>
                ) : (
                    <NavLink to="/dashboard" className="nav-link nav-link-accent">
                        Dashboard
                    </NavLink>
                )}
            </nav>
        </header>
    );
}
