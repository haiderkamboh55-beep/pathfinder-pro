import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer({ authUser }) {
    return (
        <footer className="app-footer-enhanced">
            <div className="footer-grid">
                <div className="footer-brand">
                    <div className="footer-logo">
                        <div className="logo-mark small">PF</div>
                        <span>PathFinder Pro</span>
                    </div>
                    <p className="footer-tagline">
                        AI-powered career navigation combining psychology, machine learning, and live labor market intelligence.
                    </p>
                    <div className="footer-social">
                        <a href="#" className="social-link" aria-label="LinkedIn">in</a>
                        <a href="#" className="social-link" aria-label="Twitter">X</a>
                        <a href="#" className="social-link" aria-label="GitHub">GH</a>
                    </div>
                </div>

                <div className="footer-links-group">
                    <h4>Product</h4>
                    <ul>
                        <li><Link to="/features">Features</Link></li>
                        <li><Link to="/services">Services</Link></li>
                        <li><Link to="/about">About Us</Link></li>
                    </ul>
                </div>

                <div className="footer-links-group">
                    <h4>Resources</h4>
                    <ul>
                        <li><Link to="/assessments">Assessments</Link></li>
                        <li><Link to="/assistant">AI Assistant</Link></li>
                        <li><a href="#">Documentation</a></li>
                    </ul>
                </div>

                <div className="footer-links-group">
                    <h4>Legal</h4>
                    <ul>
                        <li><a href="#">Privacy Policy</a></li>
                        <li><a href="#">Terms of Service</a></li>
                        <li><a href="#">Cookie Policy</a></li>
                    </ul>
                </div>
            </div>

            <div className="footer-bottom">
                <span>© {new Date().getFullYear()} PathFinder Pro. All rights reserved.</span>
                {authUser?.email && <span className="footer-user">Signed in as {authUser.email}</span>}
            </div>
        </footer>
    );
}
