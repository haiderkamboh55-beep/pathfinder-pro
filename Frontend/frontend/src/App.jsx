import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { supabase } from './supabaseClient';

// Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ScrollToTop from './components/ScrollToTop';

// Pages
import FeaturesPage from './pages/FeaturesPage';
import ServicesPage from './pages/ServicesPage';
import AssessmentsPage from './pages/AssessmentsPage';
import OnboardingPage from './pages/OnboardingPage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import AssessmentHistoryPage from './pages/AssessmentHistoryPage';

const BACKEND_BASE_URL = 'http://localhost:8000';

const initialProfile = {
  fullName: '',
  email: '',
  phone: '',
  countryCode: '+92',
  educationLevel: '',
  targetRole: '',
  country: '',
  skillsInput: '',
  hollandCode: '',
  gadScore: 5,
  phqScore: 5,
  bio: '',
  interests: '',
  experience: '',
  location: '',
  linkedin: '',
  github: '',
};

export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState(initialProfile);
  const [recommendations, setRecommendations] = useState([]);
  const [isRecommending, setIsRecommending] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      from: 'bot',
      text: 'Hi, I\'m your PathFinder Pro assistant. Tell me where you are today and where you\'d like to go, and we will chart a path together.',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [error, setError] = useState('');
  const [authUser, setAuthUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [dashboardJobs, setDashboardJobs] = useState([]);

  // Job search pagination - tracks current page for "more jobs" requests
  const [jobPage, setJobPage] = useState(1);
  // Track shown job IDs to prevent duplicates when asking for "more jobs"
  const [shownJobIds, setShownJobIds] = useState([]);

  // Gamification - Points & Rewards System
  const [userPoints, setUserPoints] = useState(0);
  const [showRewardNotification, setShowRewardNotification] = useState(false);
  const [lastEarnedPoints, setLastEarnedPoints] = useState(0);

  // Badge tiers based on points
  const BADGE_TIERS = [
    { name: 'Newcomer', minPoints: 0, icon: '🌱', color: '#6b7280' },
    { name: 'Bronze', minPoints: 50, icon: '🥉', color: '#cd7f32' },
    { name: 'Silver', minPoints: 150, icon: '🥈', color: '#c0c0c0' },
    { name: 'Gold', minPoints: 300, icon: '🥇', color: '#ffd700' },
    { name: 'Platinum', minPoints: 500, icon: '💎', color: '#e5e4e2' },
    { name: 'Diamond', minPoints: 1000, icon: '👑', color: '#b9f2ff' },
  ];

  // Get current badge based on points
  const getCurrentBadge = (points) => {
    for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
      if (points >= BADGE_TIERS[i].minPoints) {
        return BADGE_TIERS[i];
      }
    }
    return BADGE_TIERS[0];
  };

  // Get next badge
  const getNextBadge = (points) => {
    for (let i = 0; i < BADGE_TIERS.length; i++) {
      if (points < BADGE_TIERS[i].minPoints) {
        return BADGE_TIERS[i];
      }
    }
    return null; // Max level reached
  };

  // Load user points from Supabase with localStorage fallback
  const loadUserPoints = async (userId) => {
    console.log(`🔍 Loading points for user: ${userId}`);

    try {
      // First try to load from Supabase
      const { data, error } = await supabase
        .from('user_achievements')
        .select('points')
        .eq('user_id', userId)
        .single();

      console.log('Supabase response:', { data, error });

      if (error) {
        // If table doesn't exist or other error, fall back to localStorage
        console.log('Supabase load error, using localStorage fallback:', error.message, error.code);
        const localPoints = localStorage.getItem(`pathfinder_points_${userId}`);
        if (localPoints) {
          const points = parseInt(localPoints, 10) || 0;
          setUserPoints(points);
          console.log(`📊 Loaded ${points} points from localStorage`);
        } else {
          console.log('No points in localStorage either');
        }
        return;
      }

      if (data) {
        setUserPoints(data.points || 0);
        // Also save to localStorage as backup
        localStorage.setItem(`pathfinder_points_${userId}`, String(data.points || 0));
        console.log(`📊 Loaded ${data.points} points from database`);
      } else {
        console.log('No data returned from Supabase');
        // No data found, check localStorage
        const localPoints = localStorage.getItem(`pathfinder_points_${userId}`);
        if (localPoints) {
          const points = parseInt(localPoints, 10) || 0;
          setUserPoints(points);
          console.log(`📊 Loaded ${points} points from localStorage (no DB record)`);
        } else {
          // Create initial record for new user
          setUserPoints(0);
          try {
            await supabase
              .from('user_achievements')
              .upsert({ user_id: userId, points: 0 });
          } catch (e) {
            console.log('Could not create initial DB record');
          }
        }
      }
    } catch (e) {
      console.error('Error in loadUserPoints:', e);
      // Fallback to localStorage on any error
      const localPoints = localStorage.getItem(`pathfinder_points_${userId}`);
      if (localPoints) {
        setUserPoints(parseInt(localPoints, 10) || 0);
      }
    }
  };

  // Save user points to Supabase AND localStorage
  const saveUserPoints = async (userId, points) => {
    // Always save to localStorage first (reliable backup)
    localStorage.setItem(`pathfinder_points_${userId}`, String(points));
    console.log(`💾 Saved ${points} points to localStorage`);

    // Then try to save to Supabase
    try {
      const { error } = await supabase
        .from('user_achievements')
        .upsert({
          user_id: userId,
          points: points,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.log('Could not save to Supabase:', error.message);
      } else {
        console.log(`💾 Saved ${points} points to database`);
      }
    } catch (e) {
      console.log('Supabase save failed, but localStorage backup is saved');
    }
  };

  // Award points function - now persists to database AND localStorage
  const awardPoints = async (points, action) => {
    const newTotal = userPoints + points;
    setUserPoints(newTotal);
    setLastEarnedPoints(points);
    setShowRewardNotification(true);
    console.log(`🎉 Earned ${points} points for: ${action}`);

    // Save to database and localStorage if user is logged in
    if (authUser?.id) {
      await saveUserPoints(authUser.id, newTotal);
    }

    // Hide notification after 3 seconds
    setTimeout(() => {
      setShowRewardNotification(false);
    }, 3000);
  };

  // Load user profile from Supabase
  const loadUserProfile = async (userId, userEmail) => {
    console.log(`🔍 Loading profile for user: ${userId}`);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.log('Profile load error, using localStorage:', error.message);
        const localProfile = localStorage.getItem(`pathfinder_profile_${userId}`);
        if (localProfile) {
          const profileData = JSON.parse(localProfile);
          setProfile(prev => ({ ...prev, ...profileData }));
          console.log('📋 Loaded profile from localStorage');
        }
        return;
      }

      if (data) {
        const profileData = {
          fullName: data.full_name || '',
          email: userEmail || data.email || '',
          phone: data.phone || '',
          countryCode: data.country_code || '+92',
          educationLevel: data.education_level || '',
          targetRole: data.target_role || '',
          country: data.country || '',
          skillsInput: data.skills || '',
          hollandCode: data.holland_code || '',
          gadScore: data.gad_score || 5,
          phqScore: data.phq_score || 5,
          bio: data.bio || '',
          interests: data.interests || '',
          experience: data.experience || '',
          location: data.location || '',
          linkedin: data.linkedin || '',
          github: data.github || '',
        };
        setProfile(prev => ({ ...prev, ...profileData }));
        localStorage.setItem(`pathfinder_profile_${userId}`, JSON.stringify(profileData));
        console.log('📋 Loaded profile from database');
      }
    } catch (e) {
      console.error('Error loading profile:', e);
      const localProfile = localStorage.getItem(`pathfinder_profile_${userId}`);
      if (localProfile) {
        setProfile(prev => ({ ...prev, ...JSON.parse(localProfile) }));
      }
    }
  };

  // Save user profile to Supabase
  const saveUserProfile = async (userId, profileData) => {
    // Always save to localStorage first
    localStorage.setItem(`pathfinder_profile_${userId}`, JSON.stringify(profileData));
    console.log('💾 Saved profile to localStorage');

    try {
      // Prepare profile data for saving - only include fields that definitely exist in table
      // Use user_id as the id since the table uses id as primary key
      const profileRecord = {
        id: userId,  // Use userId as the primary key id
        user_id: userId,
        full_name: profileData.fullName || null,
        email: profileData.email || null,
        phone: profileData.phone || null,
        country_code: profileData.countryCode || '+92',
        education_level: profileData.educationLevel || null,
        target_role: profileData.targetRole || null,
        country: profileData.country || null,
        skills: profileData.skillsInput || null,
        holland_code: profileData.hollandCode || null,
        gad_score: Number(profileData.gadScore) || 5,
        phq_score: Number(profileData.phqScore) || 5,
        bio: profileData.bio || null,
        interests: profileData.interests || null,
        experience: profileData.experience || null,
        location: profileData.location || null,
        linkedin: profileData.linkedin || null,
        github: profileData.github || null,
        updated_at: new Date().toISOString()
      };

      console.log('📤 Attempting to save profile to Supabase...');
      console.log('User ID:', userId);
      console.log('Profile Record:', JSON.stringify(profileRecord, null, 2));

      const { data, error } = await supabase
        .from('profiles')
        .upsert(profileRecord, { onConflict: 'id' })
        .select();

      if (error) {
        console.error('❌ Supabase save error:', error);
        console.error('Error code:', error.code);
        console.error('Error message:', error.message);
        console.error('Error details:', error.details);
        console.error('Error hint:', error.hint);
        alert(`Profile save failed: ${error.message}\n\nPlease check the browser console for details.`);
      } else {
        console.log('✅ Profile saved successfully to Supabase!');
        console.log('Saved data:', data);
        alert('Profile saved to database successfully! ✓');
      }
    } catch (e) {
      console.error('❌ Profile save exception:', e);
      alert(`Profile save error: ${e.message}`);
    }
  };

  // Session timeout in milliseconds (30 minutes)
  const SESSION_TIMEOUT = 30 * 60 * 1000;
  const lastActivityRef = React.useRef(Date.now());

  // Check and handle session timeout
  useEffect(() => {
    const checkSessionTimeout = () => {
      if (authUser && Date.now() - lastActivityRef.current > SESSION_TIMEOUT) {
        console.log('Session timeout - logging out');
        handleLogout();
      }
    };

    const intervalId = setInterval(checkSessionTimeout, 60000); // Check every minute
    return () => clearInterval(intervalId);
  }, [authUser]);

  // Track user activity to reset timeout
  useEffect(() => {
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener('mousemove', resetActivity);
    window.addEventListener('keydown', resetActivity);
    window.addEventListener('click', resetActivity);
    window.addEventListener('scroll', resetActivity);

    return () => {
      window.removeEventListener('mousemove', resetActivity);
      window.removeEventListener('keydown', resetActivity);
      window.removeEventListener('click', resetActivity);
      window.removeEventListener('scroll', resetActivity);
    };
  }, []);

  // Listen for auth state changes (login, logout, session expiry)
  useEffect(() => {
    // Get initial session and validate it
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error || !session) {
          // No valid session - ensure clean state
          setAuthUser(null);
          sessionStorage.clear();
          setIsAuthLoading(false);
          return;
        }

        // Check if session is expired
        const expiresAt = session.expires_at;
        const now = Math.floor(Date.now() / 1000);

        if (expiresAt && now >= expiresAt) {
          // Session expired - clear everything
          console.log('Session expired, clearing auth state');
          await supabase.auth.signOut();
          setAuthUser(null);
          sessionStorage.clear();
          setIsAuthLoading(false);
          return;
        }

        // Valid session
        setAuthUser(session.user ?? null);
        lastActivityRef.current = Date.now();

        // Load user points and profile from database
        if (session.user?.id) {
          loadUserPoints(session.user.id);
          loadUserProfile(session.user.id, session.user.email);
        }
      } catch (e) {
        console.error('Error checking session:', e);
        setAuthUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    initializeAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event);

        if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
          // User logged out or token refresh failed - clear all state
          setAuthUser(null);
          setProfile(initialProfile);
          setRecommendations([]);
          setChatMessages([{
            from: 'bot',
            text: 'Hi, I\'m your PathFinder Pro assistant. Tell me where you are today and where you\'d like to go, and we will chart a path together.',
          }]);
          setChatInput('');
          setError('');
          // Clear session storage
          sessionStorage.clear();
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          setAuthUser(session?.user ?? null);
          lastActivityRef.current = Date.now();
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const handleProfileChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const parsedSkills = useMemo(
    () => profile.skillsInput.split(',').map((s) => s.trim()).filter(Boolean),
    [profile.skillsInput],
  );

  const completenessScore = useMemo(() => {
    let score = 0;
    if (profile.fullName) score += 25;
    if (profile.educationLevel) score += 15;
    if (profile.targetRole) score += 20;
    if (parsedSkills.length) score += 20;
    if (profile.hollandCode) score += 20;
    return score;
  }, [profile, parsedSkills.length]);

  const handleRecommend = async (e) => {
    e?.preventDefault();
    setIsRecommending(true);
    setError('');
    setDashboardJobs([]); // Clear previous jobs

    const payload = {
      skills: parsedSkills,
      holland_code: profile.hollandCode || 'I',
      gad_score: Number(profile.gadScore) || 0,
      phq_score: Number(profile.phqScore) || 0,
    };

    try {
      if (authUser?.id) {
        await supabase.from('profiles').upsert({
          id: authUser.id,
          full_name: profile.fullName || null,
          education_level: profile.educationLevel || null,
          target_role: profile.targetRole || null,
          skills: parsedSkills,
          holland_code: profile.hollandCode || null,
          gad_score: Number(profile.gadScore) || 0,
          phq_score: Number(profile.phqScore) || 0,
        }, { onConflict: 'id' });
      }

      // Fetch AI recommendations and job listings in parallel
      const [recRes, jobsRes] = await Promise.all([
        axios.post(`${BACKEND_BASE_URL}/recommend`, payload),
        axios.post(`${BACKEND_BASE_URL}/search-jobs`, {
          target_role: profile.targetRole || 'Software Engineer',
          skills: parsedSkills,
          location: profile.country || '',
          remote_preference: true
        }).catch(err => {
          console.warn('Job search failed:', err);
          return { data: { jobs: [] } };
        })
      ]);

      setRecommendations(recRes.data || []);

      // Award points for generating AI recommendations
      if (recRes.data && recRes.data.length > 0) {
        awardPoints(25, 'AI Career Analysis');
      }

      // Set job listings if available
      if (jobsRes.data?.jobs) {
        setDashboardJobs(jobsRes.data.jobs);
      }
    } catch (err) {
      console.error(err);
      setError('Unable to reach the AI engine. Ensure your FastAPI backend is running.');
    } finally {
      setIsRecommending(false);
    }
  };

  const handleSendChat = async () => {
    if (!chatInput.trim()) return;
    const message = chatInput.trim();

    setChatMessages((prev) => [...prev, { from: 'user', text: message }]);
    setChatInput('');
    setIsChatting(true);
    setError('');

    try {
      // Calculate severity levels for wellbeing context
      const getGadSeverity = (score) => {
        if (!score && score !== 0) return null;
        if (score <= 4) return 'Minimal';
        if (score <= 9) return 'Mild';
        if (score <= 14) return 'Moderate';
        return 'Significant';
      };

      const getPhqSeverity = (score) => {
        if (!score && score !== 0) return null;
        if (score <= 4) return 'Minimal';
        if (score <= 9) return 'Mild';
        if (score <= 14) return 'Moderate';
        if (score <= 19) return 'Moderately Significant';
        return 'Significant';
      };

      // Try to load the LATEST career assessment from Supabase for comprehensive data
      let assessmentData = null;
      if (authUser?.id) {
        try {
          const { data, error: fetchError } = await supabase
            .from('career_assessments')
            .select('*')
            .eq('user_id', authUser.id)
            .order('completed_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!fetchError && data) {
            assessmentData = data;
            console.log('📥 Loaded latest career assessment from database:', {
              name: data.full_name,
              role: data.target_role,
              country: data.country,
              hollandCode: data.holland_code,
              gadScore: data.gad_total_score,
              phqScore: data.phq_total_score,
              skills: data.skills
            });
          }
        } catch (e) {
          console.log('Could not fetch assessment from database, using profile state');
        }
      }

      // Use assessment data from database if available, otherwise fall back to profile
      const effectiveData = {
        fullName: assessmentData?.full_name || profile.fullName || null,
        targetRole: assessmentData?.target_role || profile.targetRole || null,
        educationLevel: assessmentData?.education_level || profile.educationLevel || null,
        country: assessmentData?.country || profile.country || null,
        skills: assessmentData?.skills || (profile.skillsInput ? profile.skillsInput.split(',').map(s => s.trim()).filter(Boolean) : []),
        hollandCode: assessmentData?.holland_code || profile.hollandCode || null,
        gadScore: assessmentData?.gad_total_score ?? profile.gadScore ?? null,
        phqScore: assessmentData?.phq_total_score ?? profile.phqScore ?? null,
        gadSeverity: assessmentData?.gad_severity || getGadSeverity(assessmentData?.gad_total_score || profile.gadScore),
        phqSeverity: assessmentData?.phq_severity || getPhqSeverity(assessmentData?.phq_total_score || profile.phqScore),
        interests: assessmentData?.interests || (profile.interests ? profile.interests.split(',').map(i => i.trim()).filter(Boolean) : []),
        careerAdvice: assessmentData?.career_advice || null,
      };

      // Check if this is a "more jobs" request - if so, send previously shown job IDs
      const moreJobsIndicators = [
        'more job', 'more jobs', 'more positions', 'more openings', 'more opportunities',
        'additional', 'extra', 'other job', 'next job',
        'share more', 'the more jobs', 'different jobs', 'new jobs',
        'further', 'again', 'share the more', 'can you share more'
      ];
      const isMoreJobsRequest = moreJobsIndicators.some(ind => message.toLowerCase().includes(ind));

      // Build conversation history from current chat messages (last 10 messages)
      const conversationHistory = chatMessages.slice(-10).map(msg => ({
        role: msg.from === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

      // Build comprehensive payload with ALL assessment data
      const payload = {
        message,
        skills: Array.isArray(effectiveData.skills) ? effectiveData.skills : [],
        holland_code: effectiveData.hollandCode,
        gad_score: effectiveData.gadScore ? Number(effectiveData.gadScore) : null,
        phq_score: effectiveData.phqScore ? Number(effectiveData.phqScore) : null,
        // Complete assessment data for full personalization
        full_name: effectiveData.fullName,
        target_role: effectiveData.targetRole,
        education_level: effectiveData.educationLevel,
        country: effectiveData.country,
        interests: effectiveData.interests,
        work_preferences: {},
        gad_severity: effectiveData.gadSeverity,
        phq_severity: effectiveData.phqSeverity,
        career_advice: effectiveData.careerAdvice,
        // Job pagination - send current page for "more jobs" requests
        job_page: jobPage,
        // Send previously shown job IDs to avoid duplicates
        shown_job_ids: isMoreJobsRequest ? shownJobIds : [],
        // Conversation history for context-aware responses
        conversation_history: conversationHistory,
      };

      console.log('📤 Sending chat request:', {
        message: message.substring(0, 50),
        isMoreJobsRequest,
        jobPage,
        shownJobIds: shownJobIds.length,
        sendingShownJobIds: payload.shown_job_ids.length,
        conversationHistoryCount: conversationHistory.length
      });

      console.log('📤 Full assessment context:', {
        name: payload.full_name,
        role: payload.target_role,
        country: payload.country,
        hollandCode: payload.holland_code,
        gadScore: `${payload.gad_score}/21 (${payload.gad_severity})`,
        phqScore: `${payload.phq_score}/27 (${payload.phq_severity})`,
        skills: payload.skills
      });

      const res = await axios.post(`${BACKEND_BASE_URL}/chat`, payload);
      const reply = res?.data?.reply || 'I could not generate a response this time.';

      // Check if the response contains job data and update pagination/tracking
      const jobMatch = reply.match(/---JOBS_DATA---\n([\s\S]*?)\n---END_JOBS_DATA---/);
      if (jobMatch) {
        try {
          const jobData = JSON.parse(jobMatch[1]);
          // If response includes next_page, update the jobPage state
          if (jobData.next_page) {
            setJobPage(jobData.next_page);
            console.log(`[JOB PAGINATION] Updated to page ${jobData.next_page}`);
          }
          // Track the new job IDs to prevent showing them again
          if (jobData.new_job_ids && jobData.new_job_ids.length > 0) {
            setShownJobIds(prev => [...prev, ...jobData.new_job_ids]);
            console.log(`[JOB TRACKING] Added ${jobData.new_job_ids.length} new job IDs, total tracked: ${shownJobIds.length + jobData.new_job_ids.length}`);
          }
        } catch (e) {
          console.log('Could not parse job data for pagination');
        }
      }

      // Check if user is starting a new job search (not asking for more)
      if (!isMoreJobsRequest && message.toLowerCase().includes('job')) {
        // Reset to page 1 and clear shown jobs for new job searches
        setJobPage(1);
        setShownJobIds([]);
        console.log('[JOB PAGINATION] Reset to page 1 and cleared shown jobs for new search');
      }

      setChatMessages((prev) => [...prev, { from: 'bot', text: reply }]);

      // Award points for chatting with AI
      awardPoints(5, 'AI Assistant Chat');
    } catch (err) {
      console.error(err);
      setChatMessages((prev) => [
        ...prev,
        { from: 'bot', text: 'I could not reach the assistant. Please ensure the backend is running.' },
      ]);
    } finally {
      setIsChatting(false);
    }
  };

  const uniqueSkillGaps = useMemo(() => {
    const gaps = new Set();
    recommendations.forEach((rec) => {
      (rec.skill_gaps || []).forEach((gap) => gaps.add(gap));
    });
    return Array.from(gaps);
  }, [recommendations]);

  // NOTE: Profile loading from database is DISABLED for privacy
  // Each login starts with a fresh profile - no previous data is loaded
  // Users need to fill in their profile each session
  /*
  useEffect(() => {
    if (!authUser?.id) return;
  
    let cancelled = false;
    const loadProfile = async () => {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();
  
      if (profileError || !data || cancelled) return;
  
      setProfile((prev) => ({
        ...prev,
        fullName: data.full_name || '',
        educationLevel: data.education_level || '',
        targetRole: data.target_role || '',
        skillsInput: Array.isArray(data.skills) ? data.skills.join(', ') : data.skills || '',
        hollandCode: data.holland_code || '',
        gadScore: typeof data.gad_score === 'number' ? data.gad_score : prev.gadScore,
        phqScore: typeof data.phq_score === 'number' ? data.phq_score : prev.phqScore,
      }));
    };
  
    loadProfile();
    return () => { cancelled = true; };
  }, [authUser]);
  */

  const handleLoginSuccess = (user) => {
    setAuthUser(user);
    navigate('/dashboard');
  };

  const handleSignUpSuccess = (user) => {
    // After signup, user needs to verify email, then login
    navigate('/login');
  };

  const handleLogout = async () => {
    try {
      // Profile data is now preserved in database - users can see their data on next login
      // We only clear local state, not the database

      // Sign out from Supabase with global scope (invalidates all sessions)
      await supabase.auth.signOut({ scope: 'global' });

      // Clear all application state
      setAuthUser(null);
      setProfile(initialProfile);
      setRecommendations([]);
      setChatMessages([{
        from: 'bot',
        text: 'Hi, I\'m your PathFinder Pro assistant. Tell me where you are today and where you\'d like to go, and we will chart a path together.',
      }]);
      setChatInput('');
      setError('');

      // Reset user points (each user has their own achievements)
      setUserPoints(0);

      // Clear sessionStorage completely (our primary auth storage)
      sessionStorage.clear();

      // Clear any Supabase-related data from localStorage (legacy cleanup)
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('supabase') || key.includes('sb-') || key.includes('auth'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));

      // Preserve only theme preference
      const theme = localStorage.getItem('theme');
      if (theme) localStorage.setItem('theme', theme);

    } catch (e) {
      console.error('Error signing out', e);
    } finally {
      navigate('/');
    }
  };

  // Check if on authenticated pages that show sidebar
  const showSidebar = authUser && ['/dashboard', '/assessments', '/assistant', '/onboarding', '/achievements', '/profile', '/history'].some(p =>
    location.pathname.startsWith(p)
  );

  // Show loading while checking auth state
  if (isAuthLoading) {
    return (
      <div className="app-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="logo-mark" style={{ margin: '0 auto 16px', width: '60px', height: '60px', fontSize: '20px' }}>PF</div>
          <p style={{ color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`app-root ${showSidebar ? 'with-sidebar' : ''}`}>
      <ScrollToTop />
      <Navbar authUser={authUser} onLogout={handleLogout} />

      <main className="app-main">
        <Routes>
          <Route path="/" element={<HomePage onPrimaryCta={() => navigate(authUser ? '/dashboard' : '/login')} onSecondaryCta={() => navigate('/features')} />} />
          <Route path="/features" element={<FeaturesPage />} />
          <Route path="/services" element={<ServicesPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route
            path="/dashboard"
            element={authUser ? (
              <DashboardPage
                profile={profile}
                onProfileChange={handleProfileChange}
                recommendations={recommendations}
                onRecommend={handleRecommend}
                isRecommending={isRecommending}
                completenessScore={completenessScore}
                parsedSkills={parsedSkills}
                uniqueSkillGaps={uniqueSkillGaps}
                error={error}
                dashboardJobs={dashboardJobs}
                userPoints={userPoints}
                currentBadge={getCurrentBadge(userPoints)}
                nextBadge={getNextBadge(userPoints)}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/assessments"
            element={authUser ? (
              <AssessmentsPage profile={profile} onProfileChange={handleProfileChange} />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/assistant"
            element={authUser ? (
              <AssistantPage
                chatMessages={chatMessages}
                chatInput={chatInput}
                setChatInput={setChatInput}
                onSendChat={handleSendChat}
                isChatting={isChatting}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route path="/login" element={authUser ? <Navigate to="/dashboard" replace /> : <LoginPage onLoginSuccess={handleLoginSuccess} />} />
          <Route path="/signup" element={<Navigate to="/login" replace />} />
          <Route
            path="/onboarding"
            element={authUser ? (
              <OnboardingPage
                profile={profile}
                onProfileChange={handleProfileChange}
                onComplete={async (data) => {
                  // Save profile to database when onboarding completes
                  if (authUser?.id) {
                    await saveUserProfile(authUser.id, profile);
                    console.log('📝 Profile saved after onboarding completion');
                  }
                  // Trigger recommendations after onboarding
                  await handleRecommend();
                }}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/achievements"
            element={authUser ? (
              <AchievementsPage
                userPoints={userPoints}
                currentBadge={getCurrentBadge(userPoints)}
                nextBadge={getNextBadge(userPoints)}
                badgeTiers={BADGE_TIERS}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/profile"
            element={authUser ? (
              <ProfilePage
                profile={profile}
                onProfileChange={handleProfileChange}
                onSaveProfile={() => saveUserProfile(authUser.id, profile)}
                authUser={authUser}
                userPoints={userPoints}
                currentBadge={getCurrentBadge(userPoints)}
              />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
          <Route
            path="/history"
            element={authUser ? (
              <AssessmentHistoryPage />
            ) : (
              <Navigate to="/login" replace />
            )}
          />
        </Routes>
      </main>

      {!showSidebar && <Footer authUser={authUser} />}

      {/* Reward Notification Popup */}
      {showRewardNotification && (
        <div className="reward-notification">
          <div className="reward-notification-content">
            <span className="reward-icon">🎉</span>
            <div className="reward-text">
              <strong>+{lastEarnedPoints} Points!</strong>
              <span>Keep going to unlock new badges!</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ FEATURE SHOWCASE COMPONENT ============
function FeatureSlider({ onPrimaryCta }) {
  // Platform icons with brand colors
  const platforms = [
    { name: 'LinkedIn', icon: 'in', color: '#0A66C2' },
    { name: 'Indeed', icon: '✓', color: '#2164F3' },
    { name: 'Glassdoor', icon: '◉', color: '#0CAA41' },
    { name: 'Monster', icon: 'M', color: '#6E45A5' },
    { name: 'ZipRecruiter', icon: 'Z', color: '#25BA6F' },
    { name: 'CareerBuilder', icon: 'CB', color: '#F26722' },
  ];

  return (
    <section className="feature-showcase">
      <h2 className="showcase-headline">A better way to navigate<br />your career path</h2>

      <div className="showcase-container">
        <div className="showcase-content">
          <h3>Find your perfect career match</h3>
          <p>
            Scan and analyze your skills, interests, and psychological profile
            to discover career paths that align with your true potential,
            not just your resume.
          </p>
          <button className="showcase-cta" onClick={onPrimaryCta}>
            Explore career matching →
          </button>
        </div>
        <div className="showcase-visual">
          <div className="visual-mock">
            <div className="mock-icon">
              <div className="pf-logo-icon">PF</div>
            </div>
            <div className="mock-connector">
              <svg width="24" height="50" viewBox="0 0 24 50">
                <path d="M12 0 L12 20 M12 30 L12 50" stroke="#9ca3af" strokeWidth="2" strokeDasharray="4 4" />
                <circle cx="12" cy="25" r="4" fill="#6b7280" />
              </svg>
            </div>
            {/* Scrolling Platform Icons */}
            <div className="platforms-marquee">
              <div className="marquee-track">
                {[...platforms, ...platforms].map((platform, idx) => (
                  <div key={idx} className="platform-icon-card">
                    <span className="platform-icon" style={{ background: platform.color }}>
                      {platform.icon}
                    </span>
                    <span className="platform-name">{platform.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ============ HOME PAGE ============
function HomePage({ onPrimaryCta, onSecondaryCta }) {
  const stats = [
    { value: '10K+', label: 'Career Paths Analyzed' },
    { value: '95%', label: 'User Satisfaction' },
    { value: '50+', label: 'Industries Covered' },
    { value: '24/7', label: 'AI Assistant Available' }
  ];

  const partners = [
    { name: 'Google', icon: '🌐' },
    { name: 'Microsoft', icon: '💻' },
    { name: 'Amazon', icon: '📦' },
    { name: 'Spotify', icon: '🎵' },
    { name: 'Slack', icon: '💬' },
    { name: 'Netflix', icon: '🎬' },
    { name: 'Adobe', icon: '🎨' },
    { name: 'Tesla', icon: '⚡' },
  ];

  const testimonials = [
    {
      name: 'Sarah Jenkins',
      role: 'Data Scientist',
      quote: 'PathFinder Pro helped me pivot from Marketing to Data Science in just 6 months. The AI roadmap was spot on!',
      rating: 5,
      avatar: 'SJ'
    },
    {
      name: 'Michael Chen',
      role: 'Product Manager',
      quote: 'The psychological profiling revealed strengths I didn\'t know I had. Truly a game-changer for my career trajectory.',
      rating: 5,
      avatar: 'MC'
    },
    {
      name: 'Emily Davis',
      role: 'UX Designer',
      quote: 'I was stuck in a rut. The AI Assistant gave me specialized advice that career counselors charged thousands for.',
      rating: 5,
      avatar: 'ED'
    }
  ];

  return (
    <>
      <section className="hero-centered-pb">
        <div className="hero-content-centered">
          <h1>
            Navigate your career. <br />
            <span className="text-black">With AI Precision.</span>
          </h1>
          <p className="hero-subtitle-centered">
            PathFinder Pro combines psychological profiling, real-time job market analytics,
            and AI to help you find unique career data you can't get anywhere else.
          </p>

          <div className="hero-input-pill">
            <input type="email" placeholder="Enter your email" className="hero-email-input" />
            <button className="hero-start-btn" onClick={onPrimaryCta}>
              Start free trial
            </button>
          </div>
        </div>
      </section>

      <section className="stats-section">
        {stats.map((stat, index) => (
          <div key={index} className="stat-card">
            <span className="stat-value-large">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </section>

      {/* PARTNERS SECTION */}
      <section className="partners-section">
        <p className="section-label-center">TRUSTED BY PROFESSIONALS FROM</p>
        <div className="partners-grid">
          {partners.map((partner, index) => (
            <div key={index} className="partner-logo">
              <span className="partner-icon">{partner.icon}</span>
              <span className="partner-name">{partner.name}</span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURE SHOWCASE - PhantomBuster Style with Slider */}
      <FeatureSlider onPrimaryCta={onPrimaryCta} />

      <section className="how-it-works">
        <h2>How PathFinder Pro Works</h2>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h3>Complete Your Profile</h3>
            <p>Share your education, skills, and career goals. Take our psychological assessments for deeper insights.</p>
          </div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h3>AI Analysis</h3>
            <p>Our Gemini-powered AI analyzes your profile against real-time job market data and psychological frameworks.</p>
          </div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h3>Get Matched</h3>
            <p>Receive personalized career recommendations with skill gap analysis and actionable roadmaps.</p>
          </div>
          <div className="step-card">
            <div className="step-number">4</div>
            <h3>Track Progress</h3>
            <p>Use our gamified tracker and AI assistant to stay on course and adapt to changing markets.</p>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS SECTION */}
      <section className="testimonials-section">
        <div className="section-header-center">
          <h2>Success Stories</h2>
          <p>Join thousands of professionals who found their path</p>
        </div>
        <div className="testimonials-grid">
          {testimonials.map((t, index) => (
            <div key={index} className="testimonial-card">
              <div className="testimonial-header">
                <div className="testimonial-avatar">{t.avatar}</div>
                <div>
                  <h4 className="testimonial-name">{t.name}</h4>
                  <p className="testimonial-role">{t.role}</p>
                </div>
              </div>
              <div className="testimonial-rating">
                {'★'.repeat(t.rating)}
              </div>
              <p className="testimonial-quote">"{t.quote}"</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ============ ABOUT PAGE ============
function AboutPage() {
  return (
    <>
      {/* Hero Section */}
      <section className="page-hero">
        <div className="page-hero-content">
          <span className="hero-badge">About PathFinder Pro</span>
          <h1>
            Empowering careers through
            <span className="accent-gradient"> AI-driven insights</span>
          </h1>
          <p className="hero-description">
            We're building the future of career guidance—where technology meets human potential
            to create pathways that truly fit who you are.
          </p>
        </div>
      </section>

      {/* Vision Section */}
      <section className="about-vision-section">
        <div className="vision-card">
          <div className="vision-icon">🔮</div>
          <h2>Our Vision</h2>
          <p className="vision-text">
            <strong>To become the world's most trusted AI-powered career companion</strong>,
            transforming how individuals discover, pursue, and thrive in careers that align with
            their unique psychological profiles, skills, and life aspirations.
          </p>
          <p className="vision-text">
            We envision a future where no one settles for a mismatched career. Where every professional
            decision is informed by deep self-understanding, real-time market intelligence, and
            personalized AI guidance. PathFinder Pro exists to bridge the gap between who you are
            and where you belong in the professional world.
          </p>
          <div className="vision-pillars">
            <div className="pillar">
              <span className="pillar-icon">🧠</span>
              <h4>Self-Discovery</h4>
              <p>Understanding your unique psychological makeup, values, and motivations</p>
            </div>
            <div className="pillar">
              <span className="pillar-icon">📊</span>
              <h4>Data-Driven Decisions</h4>
              <p>Real-time labor market insights and trend analysis</p>
            </div>
            <div className="pillar">
              <span className="pillar-icon">🚀</span>
              <h4>Continuous Growth</h4>
              <p>Personalized skill development roadmaps and progress tracking</p>
            </div>
          </div>
        </div>
      </section>

      {/* Mission & Values */}
      <section className="grid-two">
        <div className="card">
          <div className="card-header">
            <h2>🎯 Our Mission</h2>
          </div>
          <div className="card-body">
            <p className="about-text">
              To democratize access to personalized, psychology-informed career guidance by
              combining cutting-edge AI with validated psychological frameworks and real-time
              job market data.
            </p>
            <ul className="about-list">
              <li>✓ Deliver AI-powered career recommendations tailored to individual personalities</li>
              <li>✓ Integrate psychological assessments (Big Five, Holland Codes, MBTI insights)</li>
              <li>✓ Provide real-time job market analytics from multiple sources</li>
              <li>✓ Enable intelligent skill gap detection with learning pathways</li>
              <li>✓ Support mental wellbeing considerations in career planning</li>
              <li>✓ Offer 24/7 AI career assistant for continuous support</li>
            </ul>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>💎 Our Values</h2>
          </div>
          <div className="card-body">
            <div className="values-grid">
              <div className="value-item">
                <strong>🔐 Privacy First</strong>
                <p>Your data belongs to you. We use enterprise-grade security and never sell personal information.</p>
              </div>
              <div className="value-item">
                <strong>🎓 Science-Backed</strong>
                <p>Every assessment and recommendation is grounded in validated psychological research.</p>
              </div>
              <div className="value-item">
                <strong>🌍 Inclusive Access</strong>
                <p>Career guidance should be accessible to everyone, regardless of background or resources.</p>
              </div>
              <div className="value-item">
                <strong>🔄 Continuous Learning</strong>
                <p>Our AI evolves with you, learning from feedback to provide increasingly relevant guidance.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technology Stack */}
      <section className="about-tech-section">
        <h2 className="section-title-center">Powered by Modern Technology</h2>
        <div className="tech-grid">
          <div className="tech-card">
            <span className="tech-icon-large">🤖</span>
            <h3>Gemini AI + LangChain</h3>
            <p>Google's most advanced language model powers our conversational AI assistant and career matching algorithms.</p>
          </div>
          <div className="tech-card">
            <span className="tech-icon-large">🔒</span>
            <h3>Supabase</h3>
            <p>Enterprise-grade authentication and database with Row Level Security for complete data protection.</p>
          </div>
          <div className="tech-card">
            <span className="tech-icon-large">⚛️</span>
            <h3>React + Vite</h3>
            <p>Lightning-fast, modern frontend delivering a seamless, responsive user experience.</p>
          </div>
          <div className="tech-card">
            <span className="tech-icon-large">🐍</span>
            <h3>FastAPI</h3>
            <p>High-performance Python backend enabling real-time AI operations and API integrations.</p>
          </div>
        </div>
      </section>

      {/* Call to Action */}
      <section className="about-cta-section">
        <div className="cta-card">
          <h2>Ready to discover your ideal career path?</h2>
          <p>Join thousands of professionals who have found clarity and direction with PathFinder Pro.</p>
          <a href="/login" className="primary-cta large">
            Get Started Free
            <span className="cta-arrow">→</span>
          </a>
        </div>
      </section>
    </>
  );
}

// ============ DASHBOARD PAGE ============
function DashboardPage({ profile, onProfileChange, recommendations, onRecommend, isRecommending, completenessScore, parsedSkills, uniqueSkillGaps, error, dashboardJobs = [], userPoints = 0, currentBadge, nextBadge }) {
  // Calculate progress to next badge
  const progressToNext = nextBadge
    ? Math.min(100, ((userPoints - currentBadge.minPoints) / (nextBadge.minPoints - currentBadge.minPoints)) * 100)
    : 100;

  return (
    <>
      {/* Badge Display Card */}
      <section className="badge-display-section">
        <div className="badge-card">
          <div className="badge-main">
            <span className="badge-icon-large" style={{ color: currentBadge?.color }}>{currentBadge?.icon}</span>
            <div className="badge-info">
              <span className="badge-tier-name" style={{ color: currentBadge?.color }}>{currentBadge?.name}</span>
              <span className="badge-points">{userPoints} Points</span>
            </div>
          </div>
          {nextBadge && (
            <div className="badge-progress">
              <div className="badge-progress-label">
                <span>Progress to {nextBadge.name}</span>
                <span>{nextBadge.minPoints - userPoints} pts to go</span>
              </div>
              <div className="badge-progress-bar">
                <div className="badge-progress-fill" style={{ width: `${progressToNext}%`, background: `linear-gradient(90deg, ${currentBadge?.color}, ${nextBadge.color})` }}></div>
              </div>
            </div>
          )}
          {!nextBadge && (
            <div className="badge-max-level">
              <span>🏆 Maximum Level Achieved!</span>
            </div>
          )}
        </div>
      </section>

      <section className="dashboard-hero">
        <div className="dashboard-hero-content">
          <h1>Welcome back{profile.fullName ? `, ${profile.fullName.split(' ')[0]}` : ''}!</h1>
          <p>Your personalized career cockpit. Complete your profile and let AI guide your path.</p>
          <button className="primary-cta" type="button" onClick={onRecommend} disabled={isRecommending}>
            {isRecommending ? 'Analyzing...' : 'Generate AI Roadmap'}
          </button>
        </div>
        <div className="dashboard-stats">
          <div className="dash-stat">
            <span className="dash-stat-value">{completenessScore}%</span>
            <span className="dash-stat-label">Profile Complete</span>
          </div>
          <div className="dash-stat">
            <span className="dash-stat-value">{parsedSkills.length}</span>
            <span className="dash-stat-label">Skills Listed</span>
          </div>
          <div className="dash-stat">
            <span className="dash-stat-value">{recommendations.length}</span>
            <span className="dash-stat-label">AI Suggestions</span>
          </div>
        </div>
      </section>

      <section className="grid-two">
        <ProfileForm profile={profile} onChange={onProfileChange} onSubmit={onRecommend} isLoading={isRecommending} />
        <RecommendationsPanel recommendations={recommendations} />
      </section>

      {/* Live Job Listings Section */}
      {dashboardJobs.length > 0 && (
        <section className="dashboard-jobs-section">
          <div className="card">
            <div className="card-header">
              <h2>💼 Live Job Opportunities</h2>
              <p>Real job openings matching your profile and skills</p>
            </div>
            <div className="card-body">
              <div className="job-listings-grid">
                {dashboardJobs.slice(0, 6).map((job, index) => {
                  // Ensure all fields are properly extracted from JSearch API response
                  const jobTitle = job.job_title || job.title || 'Job Opportunity';
                  const companyName = job.company_name || job.employer_name || job.company || 'Company';
                  const jobLocation = job.location || job.job_city || (job.job_is_remote ? 'Remote' : 'Location not specified');
                  const jobType = job.job_type || job.job_employment_type || 'Full Time';
                  const jobSalary = job.salary || (job.job_min_salary && job.job_max_salary
                    ? `${job.job_salary_currency || 'USD'} ${job.job_min_salary} - ${job.job_max_salary} / ${(job.job_salary_period || 'YEAR').toLowerCase()}`
                    : job.job_salary || 'Salary not specified');
                  const jobDescription = job.description || job.job_description || job.job_highlights?.join(' ') || 'No description available';
                  const postedDate = job.posted_date || job.job_posted_at_datetime_utc?.substring(0, 10) || 'Recently';

                  // Ensure apply_link is valid - use job_apply_link, job_google_link, or generate a search link
                  let applyLink = job.apply_link || job.job_apply_link || job.job_google_link;
                  if (!applyLink || applyLink === '') {
                    // Generate a search link if no apply link is provided
                    const searchQuery = encodeURIComponent(jobTitle);
                    const locationQuery = encodeURIComponent(jobLocation);
                    applyLink = `https://www.linkedin.com/jobs/search/?keywords=${searchQuery}&location=${locationQuery}`;
                  }

                  return (
                    <div key={index} className="job-card">
                      <div className="job-card-header">
                        <h4 className="job-title">{jobTitle}</h4>
                        {jobType && <span className="job-type-badge">{jobType.toUpperCase()}</span>}
                      </div>
                      <p className="job-company">🏢 {companyName}</p>
                      <p className="job-location">📍 {jobLocation}</p>
                      {jobSalary && jobSalary !== 'Salary not specified' && (
                        <p className="job-salary">💰 {jobSalary}</p>
                      )}
                      {postedDate && (
                        <p className="job-posted" style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0' }}>
                          📅 Posted: {postedDate}
                        </p>
                      )}
                      {jobDescription && (
                        <p className="job-description">
                          {jobDescription.length > 120 ? `${jobDescription.substring(0, 120)}...` : jobDescription}
                        </p>
                      )}
                      <a
                        href={applyLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="apply-btn"
                        onClick={(e) => {
                          if (!applyLink || applyLink === '') {
                            e.preventDefault();
                            alert('Apply link is not available for this job. Please search for this position on job portals.');
                          }
                        }}
                      >
                        Apply Now →
                      </a>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid-three">
        <SkillGapPanel skillGaps={uniqueSkillGaps} targetRole={profile.targetRole} skills={parsedSkills} />
        <TrendsPanel skills={parsedSkills} targetRole={profile.targetRole} hollandCode={profile.hollandCode} />
        <ProgressPanel completeness={completenessScore} hasRecommendations={!!recommendations.length} />
      </section>

      {error && <div className="error-banner">{error}</div>}
    </>
  );
}

// ============ ASSISTANT PAGE ============
function AssistantPage({ chatMessages, chatInput, setChatInput, onSendChat, isChatting }) {
  return (
    <section className="assistant-section">
      <ChatbotPanel messages={chatMessages} input={chatInput} onInputChange={setChatInput} onSend={onSendChat} isSending={isChatting} />
    </section>
  );
}

// ============ ACHIEVEMENTS PAGE ============
function AchievementsPage({ userPoints, currentBadge, nextBadge, badgeTiers }) {
  // Calculate progress to next badge
  const progressToNext = nextBadge
    ? Math.min(100, ((userPoints - currentBadge.minPoints) / (nextBadge.minPoints - currentBadge.minPoints)) * 100)
    : 100;

  // Define achievements
  const achievements = [
    {
      id: 'first_login',
      title: 'First Steps',
      description: 'Complete your first login',
      icon: '🚀',
      points: 10,
      unlocked: userPoints >= 10
    },
    {
      id: 'profile_complete',
      title: 'Profile Pro',
      description: 'Complete your profile information',
      icon: '📝',
      points: 25,
      unlocked: userPoints >= 35
    },
    {
      id: 'first_assessment',
      title: 'Self Discovery',
      description: 'Complete your first career assessment',
      icon: '🧠',
      points: 50,
      unlocked: userPoints >= 85
    },
    {
      id: 'ai_chat',
      title: 'AI Explorer',
      description: 'Have a conversation with AI Assistant',
      icon: '💬',
      points: 15,
      unlocked: userPoints >= 100
    },
    {
      id: 'career_match',
      title: 'Career Match',
      description: 'Get your first career recommendations',
      icon: '🎯',
      points: 30,
      unlocked: userPoints >= 130
    },
    {
      id: 'skill_gap',
      title: 'Growth Mindset',
      description: 'Identify skill gaps for your target role',
      icon: '📈',
      points: 20,
      unlocked: userPoints >= 150
    },
    {
      id: 'bronze_badge',
      title: 'Bronze Achiever',
      description: 'Reach Bronze badge tier',
      icon: '🥉',
      points: 50,
      unlocked: userPoints >= 50
    },
    {
      id: 'silver_badge',
      title: 'Silver Star',
      description: 'Reach Silver badge tier',
      icon: '🥈',
      points: 100,
      unlocked: userPoints >= 150
    },
    {
      id: 'gold_badge',
      title: 'Gold Champion',
      description: 'Reach Gold badge tier',
      icon: '🥇',
      points: 150,
      unlocked: userPoints >= 300
    },
  ];

  const unlockedCount = achievements.filter(a => a.unlocked).length;

  return (
    <>
      {/* Hero Section */}
      <section className="achievements-hero">
        <div className="achievements-hero-content">
          <h1>🏆 Achievements</h1>
          <p>Track your progress, unlock badges, and celebrate your career journey milestones!</p>
        </div>
      </section>

      {/* Current Badge Display */}
      <section className="current-badge-section">
        <div className="badge-showcase-card">
          <div className="badge-showcase-main">
            <div className="badge-showcase-icon" style={{ color: currentBadge?.color }}>
              {currentBadge?.icon}
            </div>
            <div className="badge-showcase-info">
              <span className="badge-showcase-tier" style={{ color: currentBadge?.color }}>
                {currentBadge?.name}
              </span>
              <span className="badge-showcase-points">{userPoints} Total Points</span>
            </div>
          </div>

          {nextBadge && (
            <div className="badge-showcase-progress">
              <div className="badge-progress-header">
                <span>Progress to {nextBadge.name}</span>
                <span>{nextBadge.minPoints - userPoints} points to go</span>
              </div>
              <div className="badge-progress-bar-large">
                <div
                  className="badge-progress-fill-large"
                  style={{
                    width: `${progressToNext}%`,
                    background: `linear-gradient(90deg, ${currentBadge?.color}, ${nextBadge.color})`
                  }}
                />
              </div>
            </div>
          )}

          {!nextBadge && (
            <div className="badge-max-achieved">
              <span>👑 Maximum Level Achieved! You're a PathFinder Legend!</span>
            </div>
          )}
        </div>
      </section>

      {/* Badge Tiers Overview */}
      <section className="badge-tiers-section">
        <div className="card">
          <div className="card-header">
            <h2>Badge Tiers</h2>
            <p>Climb the ranks as you earn more points</p>
          </div>
          <div className="card-body">
            <div className="badge-tiers-grid">
              {badgeTiers.map((tier, index) => (
                <div
                  key={tier.name}
                  className={`badge-tier-card ${userPoints >= tier.minPoints ? 'unlocked' : 'locked'}`}
                >
                  <div className="badge-tier-icon" style={{ color: tier.color }}>
                    {tier.icon}
                  </div>
                  <div className="badge-tier-name" style={{ color: userPoints >= tier.minPoints ? tier.color : 'var(--text-muted)' }}>
                    {tier.name}
                  </div>
                  <div className="badge-tier-points">
                    {tier.minPoints}+ pts
                  </div>
                  {userPoints >= tier.minPoints && (
                    <div className="badge-tier-check">✓</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Achievements Grid */}
      <section className="achievements-grid-section">
        <div className="card">
          <div className="card-header">
            <h2>🎖️ Achievements ({unlockedCount}/{achievements.length})</h2>
            <p>Complete actions to unlock achievements and earn points</p>
          </div>
          <div className="card-body">
            <div className="achievements-grid">
              {achievements.map((achievement) => (
                <div
                  key={achievement.id}
                  className={`achievement-card ${achievement.unlocked ? 'unlocked' : 'locked'}`}
                >
                  <div className="achievement-icon">
                    {achievement.unlocked ? achievement.icon : '🔒'}
                  </div>
                  <div className="achievement-info">
                    <h4>{achievement.title}</h4>
                    <p>{achievement.description}</p>
                  </div>
                  <div className="achievement-points">
                    +{achievement.points} pts
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How to Earn Points */}
      <section className="earn-points-section">
        <div className="card">
          <div className="card-header">
            <h2>💡 How to Earn Points</h2>
            <p>Ways to boost your score and unlock new badges</p>
          </div>
          <div className="card-body">
            <div className="earn-points-grid">
              <div className="earn-point-item">
                <span className="earn-icon">✅</span>
                <div>
                  <strong>Complete your profile</strong>
                  <p>+25 points</p>
                </div>
              </div>
              <div className="earn-point-item">
                <span className="earn-icon">🎯</span>
                <div>
                  <strong>Get AI career recommendations</strong>
                  <p>+30 points</p>
                </div>
              </div>
              <div className="earn-point-item">
                <span className="earn-icon">💬</span>
                <div>
                  <strong>Chat with AI Assistant</strong>
                  <p>+15 points per session</p>
                </div>
              </div>
              <div className="earn-point-item">
                <span className="earn-icon">📚</span>
                <div>
                  <strong>Complete assessments</strong>
                  <p>+50 points</p>
                </div>
              </div>
              <div className="earn-point-item">
                <span className="earn-icon">🔄</span>
                <div>
                  <strong>Daily login streak</strong>
                  <p>+10 points per day</p>
                </div>
              </div>
              <div className="earn-point-item">
                <span className="earn-icon">🚀</span>
                <div>
                  <strong>First career discovery</strong>
                  <p>+50 points</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

// ============ PROFILE PAGE ============
function ProfilePage({ profile, onProfileChange, onSaveProfile, authUser, userPoints, currentBadge }) {
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [nameWarning, setNameWarning] = useState('');

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSaveProfile();
      setSaveMessage('Profile saved successfully! ✓');
      setTimeout(() => setSaveMessage(''), 3000);
    } catch (e) {
      setSaveMessage('Error saving profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Profile Hero */}
      <section className="profile-hero">
        <div className="profile-hero-content">
          <div className="profile-avatar">
            <span className="avatar-icon">{profile.fullName ? profile.fullName.charAt(0).toUpperCase() : '👤'}</span>
          </div>
          <div className="profile-hero-info">
            <h1>{profile.fullName || 'Your Name'}</h1>
            <p>{profile.email || authUser?.email || 'your@email.com'}</p>
            <div className="profile-badge-display">
              <span className="badge-icon">{currentBadge?.icon}</span>
              <span>{currentBadge?.name} · {userPoints} Points</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Profile Form */}
      <section className="profile-form-section">
        <div className="card">
          <div className="card-header">
            <h2>Personal Information</h2>
            <p>Keep your details up to date for better career recommendations</p>
          </div>
          <div className="card-body">
            <div className="profile-form-grid">
              <div className="field">
                <label>Full Name</label>
                <input
                  type="text"
                  value={profile.fullName}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Check if the value contains any non-alphabet characters
                    if (/[^a-zA-Z\s]/.test(value)) {
                      setNameWarning('Only alphabets are allowed. Numbers and special characters are not permitted.');
                      // Remove any characters that are not letters or spaces
                      const sanitizedValue = value.replace(/[^a-zA-Z\s]/g, '');
                      onProfileChange('fullName', sanitizedValue);
                      // Clear warning after 3 seconds
                      setTimeout(() => setNameWarning(''), 3000);
                    } else {
                      setNameWarning('');
                      onProfileChange('fullName', value);
                    }
                  }}
                  placeholder="Enter your full name"
                />
                {nameWarning && <span className="field-warning">{nameWarning}</span>}
              </div>
              <div className="field">
                <label>Email Address</label>
                <input
                  type="email"
                  value={profile.email || authUser?.email || ''}
                  onChange={(e) => onProfileChange('email', e.target.value)}
                  placeholder="your@email.com"
                />
              </div>
              <div className="field">
                <label>Phone Number</label>
                <div className="phone-input-wrapper">
                  <select
                    className="country-code-select"
                    value={profile.countryCode || '+92'}
                    onChange={(e) => onProfileChange('countryCode', e.target.value)}
                  >
                    <option value="+1">🇺🇸 +1</option>
                    <option value="+44">🇬🇧 +44</option>
                    <option value="+91">🇮🇳 +91</option>
                    <option value="+92">🇵🇰 +92</option>
                    <option value="+971">🇦🇪 +971</option>
                    <option value="+966">🇸🇦 +966</option>
                    <option value="+49">🇩🇪 +49</option>
                    <option value="+33">🇫🇷 +33</option>
                    <option value="+61">🇦🇺 +61</option>
                    <option value="+86">🇨🇳 +86</option>
                    <option value="+81">🇯🇵 +81</option>
                    <option value="+82">🇰🇷 +82</option>
                    <option value="+65">🇸🇬 +65</option>
                    <option value="+60">🇲🇾 +60</option>
                    <option value="+880">🇧🇩 +880</option>
                    <option value="+90">🇹🇷 +90</option>
                    <option value="+31">🇳🇱 +31</option>
                    <option value="+39">🇮🇹 +39</option>
                    <option value="+34">🇪🇸 +34</option>
                    <option value="+55">🇧🇷 +55</option>
                    <option value="+52">🇲🇽 +52</option>
                    <option value="+7">🇷🇺 +7</option>
                    <option value="+27">🇿🇦 +27</option>
                    <option value="+20">🇪🇬 +20</option>
                    <option value="+234">🇳🇬 +234</option>
                  </select>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => {
                      // Only allow numbers in phone field
                      const sanitizedValue = e.target.value.replace(/[^0-9]/g, '');
                      onProfileChange('phone', sanitizedValue);
                    }}
                    placeholder="300 1234567"
                  />
                </div>
              </div>
              <div className="field">
                <label>Location</label>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => onProfileChange('location', e.target.value)}
                  placeholder="City, Country"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Education & Career</h2>
            <p>Tell us about your background and goals</p>
          </div>
          <div className="card-body">
            <div className="profile-form-grid">
              <div className="field">
                <label>Education Level</label>
                <select
                  value={profile.educationLevel}
                  onChange={(e) => onProfileChange('educationLevel', e.target.value)}
                >
                  <option value="">Select level</option>
                  <option value="High School">High School</option>
                  <option value="Undergraduate">Undergraduate</option>
                  <option value="Graduate">Graduate</option>
                  <option value="Postgraduate">Postgraduate</option>
                  <option value="PhD">PhD</option>
                </select>
              </div>
              <div className="field">
                <label>Target Role</label>
                <input
                  type="text"
                  value={profile.targetRole}
                  onChange={(e) => onProfileChange('targetRole', e.target.value)}
                  placeholder="e.g., Software Developer, Data Scientist"
                />
              </div>
              <div className="field">
                <label>Experience</label>
                <select
                  value={profile.experience}
                  onChange={(e) => onProfileChange('experience', e.target.value)}
                >
                  <option value="">Select experience</option>
                  <option value="Student">Student</option>
                  <option value="0-1 years">0-1 years</option>
                  <option value="1-3 years">1-3 years</option>
                  <option value="3-5 years">3-5 years</option>
                  <option value="5-10 years">5-10 years</option>
                  <option value="10+ years">10+ years</option>
                </select>
              </div>
              <div className="field">
                <label>Holland Code</label>
                <input
                  type="text"
                  value={profile.hollandCode}
                  onChange={(e) => onProfileChange('hollandCode', e.target.value)}
                  placeholder="e.g., RIA, SEC"
                />
              </div>
              <div className="field full-width">
                <label>Skills</label>
                <input
                  type="text"
                  value={profile.skillsInput}
                  onChange={(e) => onProfileChange('skillsInput', e.target.value)}
                  placeholder="Python, JavaScript, React, Data Analysis (comma separated)"
                />
              </div>
              <div className="field full-width">
                <label>Interests</label>
                <input
                  type="text"
                  value={profile.interests}
                  onChange={(e) => onProfileChange('interests', e.target.value)}
                  placeholder="AI, Machine Learning, Web Development (comma separated)"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Social Links</h2>
            <p>Connect your professional profiles</p>
          </div>
          <div className="card-body">
            <div className="profile-form-grid">
              <div className="field">
                <label>LinkedIn Profile</label>
                <input
                  type="url"
                  value={profile.linkedin}
                  onChange={(e) => onProfileChange('linkedin', e.target.value)}
                  placeholder="https://linkedin.com/in/yourprofile"
                />
              </div>
              <div className="field">
                <label>GitHub Profile</label>
                <input
                  type="url"
                  value={profile.github}
                  onChange={(e) => onProfileChange('github', e.target.value)}
                  placeholder="https://github.com/yourusername"
                />
              </div>
              <div className="field full-width">
                <label>Bio</label>
                <textarea
                  rows={3}
                  value={profile.bio}
                  onChange={(e) => onProfileChange('bio', e.target.value)}
                  placeholder="Tell us about yourself..."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="profile-save-section">
          <button
            className="primary-cta"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Saving...' : 'Save Profile'}
          </button>
          {saveMessage && <span className="save-message">{saveMessage}</span>}
        </div>
      </section>
    </>
  );
}

// ============ PROFILE FORM ============
function ProfileForm({ profile, onChange, onSubmit, isLoading }) {
  const [nameWarning, setNameWarning] = useState('');
  const [validationErrors, setValidationErrors] = useState({});
  const [showValidation, setShowValidation] = useState(false);

  // Validate all required fields
  const validateForm = () => {
    const errors = {};

    if (!profile.fullName || profile.fullName.trim() === '') {
      errors.fullName = 'Full name is required';
    }
    if (!profile.educationLevel || profile.educationLevel === '') {
      errors.educationLevel = 'Please select your education level';
    }
    if (!profile.targetRole || profile.targetRole.trim() === '') {
      errors.targetRole = 'Target role is required for job recommendations';
    }
    if (!profile.country || profile.country === '') {
      errors.country = 'Please select your country for location-based jobs';
    }
    if (!profile.skillsInput || profile.skillsInput.trim() === '') {
      errors.skillsInput = 'Please add at least one skill';
    }
    if (!profile.hollandCode || profile.hollandCode.trim() === '') {
      errors.hollandCode = 'Holland code is required - complete the assessment first';
    }

    return errors;
  };

  // Handle form submission with validation
  const handleSubmit = (e) => {
    e.preventDefault();
    setShowValidation(true);

    const errors = validateForm();
    setValidationErrors(errors);

    if (Object.keys(errors).length === 0) {
      // All fields valid, proceed with submission
      onSubmit(e);
    } else {
      // Show alert about missing fields
      const missingFields = Object.keys(errors).length;
      alert(`⚠️ Please fill in all required fields (${missingFields} field${missingFields > 1 ? 's' : ''} missing)`);
    }
  };

  // Check field validity as user types
  const handleFieldChange = (field, value) => {
    onChange(field, value);

    // Clear error for this field if it now has a value
    if (showValidation && value && value.trim() !== '') {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // Style for error fields
  const getFieldStyle = (fieldName) => {
    if (showValidation && validationErrors[fieldName]) {
      return { borderColor: '#ef4444', boxShadow: '0 0 0 3px rgba(239, 68, 68, 0.15)' };
    }
    return {};
  };

  return (
    <div className="card">
      <div className="card-header">
        <h2>User Profile & Assessments</h2>
        <p>Capture educational, psychological, and professional signals for the AI engine.</p>
        {showValidation && Object.keys(validationErrors).length > 0 && (
          <div className="validation-alert" style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginTop: '12px',
            color: '#ef4444',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span>⚠️</span>
            <span>Please fill in all required fields marked with <span style={{ color: '#ef4444', fontWeight: 'bold' }}>*</span></span>
          </div>
        )}
      </div>
      <form className="card-body form-grid" onSubmit={handleSubmit}>
        <div className="field">
          <label>Full name <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="text"
            placeholder="Alex Rivera"
            value={profile.fullName}
            style={getFieldStyle('fullName')}
            onChange={(e) => {
              const value = e.target.value;
              // Check if the value contains any non-alphabet characters
              if (/[^a-zA-Z\s]/.test(value)) {
                setNameWarning('Only alphabets are allowed. Numbers and special characters are not permitted.');
                // Remove any characters that are not letters or spaces
                const sanitizedValue = value.replace(/[^a-zA-Z\s]/g, '');
                handleFieldChange('fullName', sanitizedValue);
                // Clear warning after 3 seconds
                setTimeout(() => setNameWarning(''), 3000);
              } else {
                setNameWarning('');
                handleFieldChange('fullName', value);
              }
            }}
          />
          {nameWarning && <span className="field-warning">{nameWarning}</span>}
          {showValidation && validationErrors.fullName && <span className="field-error" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{validationErrors.fullName}</span>}
        </div>
        <div className="field">
          <label>Education level <span style={{ color: '#ef4444' }}>*</span></label>
          <select
            value={profile.educationLevel}
            style={getFieldStyle('educationLevel')}
            onChange={(e) => handleFieldChange('educationLevel', e.target.value)}
          >
            <option value="">Select level</option>
            <option value="Undergraduate">Undergraduate</option>
            <option value="Graduate">Graduate</option>
            <option value="Bootcamp / Certification">Bootcamp / Certification</option>
            <option value="Self-taught">Self-taught</option>
          </select>
          {showValidation && validationErrors.educationLevel && <span className="field-error" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{validationErrors.educationLevel}</span>}
        </div>
        <div className="field">
          <label>Target role <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="text"
            placeholder="e.g. ML Engineer, Product Manager"
            value={profile.targetRole}
            style={getFieldStyle('targetRole')}
            onChange={(e) => handleFieldChange('targetRole', e.target.value)}
          />
          {showValidation && validationErrors.targetRole && <span className="field-error" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{validationErrors.targetRole}</span>}
        </div>
        <div className="field">
          <label>Country <span style={{ color: '#ef4444' }}>*</span></label>
          <select
            value={profile.country}
            style={getFieldStyle('country')}
            onChange={(e) => handleFieldChange('country', e.target.value)}
          >
            <option value="">Select country</option>
            <option value="United States">United States</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Canada">Canada</option>
            <option value="Australia">Australia</option>
            <option value="Germany">Germany</option>
            <option value="France">France</option>
            <option value="Netherlands">Netherlands</option>
            <option value="India">India</option>
            <option value="Pakistan">Pakistan</option>
            <option value="UAE">UAE</option>
            <option value="Saudi Arabia">Saudi Arabia</option>
            <option value="Singapore">Singapore</option>
            <option value="Japan">Japan</option>
            <option value="China">China</option>
            <option value="Remote">Remote (Worldwide)</option>
          </select>
          <span className="field-hint">Used for location-based job recommendations.</span>
          {showValidation && validationErrors.country && <span className="field-error" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{validationErrors.country}</span>}
        </div>
        <div className="field">
          <label>Core skills <span style={{ color: '#ef4444' }}>*</span></label>
          <textarea
            rows={2}
            placeholder="React, Python, SQL, Data Visualization"
            value={profile.skillsInput}
            style={getFieldStyle('skillsInput')}
            onChange={(e) => handleFieldChange('skillsInput', e.target.value)}
          />
          <span className="field-hint">Comma-separated. Used for skill gap and course mapping.</span>
          {showValidation && validationErrors.skillsInput && <span className="field-error" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{validationErrors.skillsInput}</span>}
        </div>
        <div className="field">
          <label>Holland (RIASEC) code <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="text"
            placeholder="e.g. IAS, RIA — primary or full code"
            value={profile.hollandCode}
            style={getFieldStyle('hollandCode')}
            onChange={(e) => handleFieldChange('hollandCode', e.target.value.toUpperCase())}
          />
          <span className="field-hint">Take the assessment in the Assessments page.</span>
          {showValidation && validationErrors.hollandCode && <span className="field-error" style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{validationErrors.hollandCode}</span>}
        </div>
        <div className="field" style={{ padding: '16px', background: 'rgba(34, 197, 94, 0.08)', borderRadius: '12px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span>📋 Mental Health Assessments (GAD-7 & PHQ-9)</span>
            {profile.gadScore > 0 || profile.phqScore > 0 ? (
              <span className="badge accent" style={{ fontSize: '11px' }}>Completed</span>
            ) : (
              <span className="badge subtle" style={{ fontSize: '11px' }}>Not completed</span>
            )}
          </label>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
            Complete the standardized GAD-7 (Anxiety) and PHQ-9 (Depression) assessments to get personalized career recommendations that align with your wellbeing needs.
          </p>
          {profile.gadScore > 0 || profile.phqScore > 0 ? (
            <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
              <div style={{ marginBottom: '4px' }}>GAD-7 Score: <strong>{profile.gadScore}/21</strong></div>
              <div>PHQ-9 Score: <strong>{profile.phqScore}/27</strong></div>
            </div>
          ) : (
            <a href="/assessments" style={{ display: 'inline-block', marginTop: '8px', color: 'var(--accent)', textDecoration: 'none', fontSize: '13px', fontWeight: '600' }}>
              → Complete Assessments →
            </a>
          )}
          <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '12px', fontStyle: 'italic' }}>
            These are internationally validated clinical screening tools. Your responses help match career recommendations to your wellbeing. This is not a clinical diagnosis.
          </p>
        </div>
        <div className="form-footer">
          <button className="primary-cta" type="submit" disabled={isLoading}>
            {isLoading ? 'Generating paths...' : 'Run AI compatibility check'}
          </button>
          <span className="form-footnote">PathFinder Pro does not replace clinical diagnosis.</span>
        </div>
      </form>
    </div>
  );
}

// ============ RECOMMENDATIONS PANEL ============
function RecommendationsPanel({ recommendations }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>AI-Powered Career Recommendations</h2>
        <p>Gemini uses your profile to surface achievable and sustainable careers.</p>
      </div>
      <div className="card-body recommendations">
        {(!recommendations || recommendations.length === 0) && (
          <div className="empty-state">
            <h3>No recommendations yet</h3>
            <p>Complete your profile and run the AI compatibility check to see tailored paths.</p>
          </div>
        )}
        {recommendations.map((job, index) => (
          <div key={index} className="recommendation-card">
            <div className="recommendation-header">
              <div>
                <h3>{job.job_title}</h3>
                <p className="reasoning">{job.reasoning}</p>
              </div>
              <div className="match-chip">
                <span>{job.match_percentage}% match</span>
                <div className="meter small"><div className="meter-fill" style={{ width: `${Math.min(job.match_percentage || 0, 100)}%` }} /></div>
              </div>
            </div>
            {job.skill_gaps && job.skill_gaps.length > 0 && (
              <div className="skill-gaps">
                <span className="section-label">Skill gaps & upskilling focus</span>
                <div className="chips">
                  {job.skill_gaps.map((gap, idx) => (<span key={idx} className="chip chip-warning">{gap}</span>))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ SKILL GAP PANEL (LIVE AI-POWERED) ============
function SkillGapPanel({ skillGaps, targetRole, skills }) {
  const [courses, setCourses] = React.useState([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [learningPath, setLearningPath] = React.useState('');
  const [hasFetched, setHasFetched] = React.useState(false);

  // Fetch AI-powered course recommendations when skill gaps are available
  React.useEffect(() => {
    const fetchCourses = async () => {
      if (!skillGaps || skillGaps.length === 0) {
        setCourses([]);
        setHasFetched(false);
        return;
      }

      // Only fetch if we have new skill gaps
      if (hasFetched) return;

      setIsLoading(true);
      try {
        const response = await fetch('http://localhost:8000/skill-courses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skill_gaps: skillGaps.slice(0, 5), // Limit to 5 skills
            target_role: targetRole || 'Software Professional',
            skills: skills || []
          })
        });

        if (response.ok) {
          const data = await response.json();
          setCourses(data.courses || []);
          setLearningPath(data.learning_path_summary || '');
          setHasFetched(true);
        }
      } catch (error) {
        console.error('Error fetching skill courses:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCourses();
  }, [skillGaps, targetRole, skills, hasFetched]);

  return (
    <div className="card small-card">
      <div className="card-header">
        <h3>🎯 Skill Gap Analyzer</h3>
        <p>AI-recommended courses to close your skill gaps.</p>
      </div>
      <div className="card-body">
        {isLoading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Generating personalized course recommendations...</p>
          </div>
        )}

        {!isLoading && (!skillGaps || skillGaps.length === 0) && (
          <p className="muted">Run a recommendation to see AI-powered course suggestions.</p>
        )}

        {!isLoading && courses.length > 0 && (
          <>
            {learningPath && <p className="learning-path-note">{learningPath}</p>}
            <ul className="list skill-course-list">
              {courses.slice(0, 4).map((course, idx) => (
                <li key={idx} className="list-item skill-course-item">
                  <div className="course-info">
                    <div className="list-title">{course.skill}</div>
                    <div className="list-subtitle">
                      {course.course_name} • {course.platform}
                      {course.duration && <span className="course-duration"> • {course.duration}</span>}
                    </div>
                    {course.why_learn && <p className="course-reason">{course.why_learn}</p>}
                  </div>
                  <a
                    href={course.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="badge accent course-link"
                  >
                    Start Learning →
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}

        {/* Fallback to old display if no courses but have skill gaps */}
        {!isLoading && courses.length === 0 && skillGaps && skillGaps.length > 0 && !hasFetched && (
          <ul className="list">
            {skillGaps.map((gap) => (
              <li key={gap} className="list-item">
                <div><div className="list-title">{gap}</div><div className="list-subtitle">Fundamentals → Projects → Capstone</div></div>
                <span className="badge accent">Courses</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ============ TRENDS PANEL (LIVE AI-POWERED) ============
function TrendsPanel({ skills, targetRole, hollandCode }) {
  const [trends, setTrends] = React.useState([]);
  const [insight, setInsight] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasFetched, setHasFetched] = React.useState(false);

  // Default trends to show before personalization
  const defaultTrends = [
    { label: 'AI & ML', demand: 94, salary: 'High', growth: '+28% YoY' },
    { label: 'Data Analytics', demand: 88, salary: 'High', growth: '+22% YoY' },
    { label: 'Cybersecurity', demand: 81, salary: 'High', growth: '+15% YoY' },
    { label: 'Cloud Computing', demand: 76, salary: 'Medium-High', growth: '+18% YoY' },
  ];

  // Fetch AI-powered market trends when profile has data
  React.useEffect(() => {
    const fetchTrends = async () => {
      // Only fetch if we have skills or target role
      if ((!skills || skills.length === 0) && !targetRole) {
        setTrends(defaultTrends);
        return;
      }

      // Only fetch once to avoid too many API calls
      if (hasFetched) return;

      setIsLoading(true);
      try {
        const response = await fetch('http://localhost:8000/market-trends', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            skills: skills || [],
            target_role: targetRole || '',
            holland_code: hollandCode || ''
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.trends && data.trends.length > 0) {
            setTrends(data.trends);
            setInsight(data.insight || '');
            setHasFetched(true);
          } else {
            setTrends(defaultTrends);
          }
        } else {
          setTrends(defaultTrends);
        }
      } catch (error) {
        console.error('Error fetching market trends:', error);
        setTrends(defaultTrends);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTrends();
  }, [skills, targetRole, hollandCode, hasFetched]);

  return (
    <div className="card small-card">
      <div className="card-header">
        <h3>📈 Market Trends</h3>
        <p>{insight || 'Personalized career paths based on your profile.'}</p>
      </div>
      <div className="card-body trends">
        {isLoading && (
          <div className="loading-state">
            <div className="loading-spinner"></div>
            <p>Analyzing market trends for your profile...</p>
          </div>
        )}

        {!isLoading && trends.map((item, idx) => (
          <div key={item.label || idx} className="trend-row">
            <div className="trend-label">
              <span>{item.label}</span>
              <span className="trend-salary">{item.salary}</span>
            </div>
            <div className="meter xsmall"><div className="meter-fill" style={{ width: `${item.demand}%` }} /></div>
            <div className="trend-meta">
              <span className="trend-demand">{item.demand}% demand</span>
              {item.growth && <span className="trend-growth">{item.growth}</span>}
            </div>
            {item.relevance && <p className="trend-relevance">{item.relevance}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ PROGRESS PANEL ============
function ProgressPanel({ completeness, hasRecommendations }) {
  const milestones = [
    { label: 'Profile completeness', value: Math.min(completeness, 100) },
    { label: 'Skill coverage', value: completeness > 40 ? 60 : 35 },
  ];

  return (
    <div className="card small-card">
      <div className="card-header">
        <h3>Progress Tracker</h3>
        <p>Gamified journey with levels and milestones.</p>
      </div>
      <div className="card-body progress">
        <div className="badge-row">
          <span className="badge accent">Level 1 · Explorer</span>
          <span className="badge subtle">{hasRecommendations ? 'Roadmap active' : 'Awaiting plan'}</span>
        </div>
        {milestones.map((m) => (
          <div key={m.label} className="milestone">
            <div className="milestone-header"><span>{m.label}</span><span>{m.value}%</span></div>
            <div className="meter xsmall"><div className="meter-fill" style={{ width: `${m.value}%` }} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ CHATBOT PANEL ============
function ChatbotPanel({ messages, input, onInputChange, onSend, isSending }) {
  const chatWindowRef = React.useRef(null);
  const lastMessageRef = React.useRef(null);

  // Auto-scroll to show the start of the last message when messages change
  React.useEffect(() => {
    if (lastMessageRef.current) {
      lastMessageRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'start' // Show from the start of the message
      });
    }
  }, [messages]);

  // Handle keyboard events: Enter to send, Shift+Enter for new line
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault(); // Prevent new line
      if (!isSending && input.trim()) {
        onSend();
      }
    }
    // Shift+Enter will naturally add a new line (default behavior)
  };

  // Parse message to extract job data and text content
  const parseMessage = (text) => {
    const jobDataMatch = text.match(/---JOBS_DATA---\n([\s\S]*?)\n---END_JOBS_DATA---/);

    if (jobDataMatch) {
      try {
        const parsedData = JSON.parse(jobDataMatch[1]);
        // Handle both old format (array) and new format (object with jobs array)
        const jobs = Array.isArray(parsedData) ? parsedData : (parsedData.jobs || []);
        const textContent = text.replace(/---JOBS_DATA---[\s\S]*?---END_JOBS_DATA---/, '').trim();
        return { textContent, jobs };
      } catch (e) {
        return { textContent: text, jobs: [] };
      }
    }

    return { textContent: text, jobs: [] };
  };

  // Render a single message
  const renderMessage = (msg, idx) => {
    const { textContent, jobs } = msg.from === 'bot' ? parseMessage(msg.text) : { textContent: msg.text, jobs: [] };

    return (
      <div
        key={idx}
        className={`chat-bubble ${msg.from === 'user' ? 'chat-user' : 'chat-bot'}`}
        ref={idx === messages.length - 1 ? lastMessageRef : null}
      >
        <div className="chat-label">{msg.from === 'user' ? 'You' : 'PathFinder Bot'}</div>
        <div className="chat-text">{textContent}</div>

        {/* Render job cards if present */}
        {jobs.length > 0 && (
          <div className="chat-jobs-container">
            <div className="chat-jobs-header">
              <span className="chat-jobs-icon">💼</span>
              <span>Job Openings ({jobs.length})</span>
            </div>
            <div className="chat-jobs-grid">
              {jobs.map((job, jobIdx) => (
                <div key={jobIdx} className="chat-job-card">
                  {/* Match Score Badge */}
                  {job.match_score && (
                    <div
                      className="chat-job-match-badge"
                      style={{
                        backgroundColor: job.match_score >= 80 ? '#10b981' :
                          job.match_score >= 60 ? '#f59e0b' : '#6b7280',
                        color: 'white',
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: '600',
                        position: 'absolute',
                        top: '8px',
                        right: '8px',
                      }}
                    >
                      {job.match_score}% Match
                    </div>
                  )}

                  <div className="chat-job-info">
                    {/* Company Logo */}
                    {job.company_logo && (
                      <img
                        src={job.company_logo}
                        alt={job.company_name}
                        style={{ width: '40px', height: '40px', objectFit: 'contain', marginBottom: '8px', borderRadius: '4px' }}
                        onError={(e) => e.target.style.display = 'none'}
                      />
                    )}

                    <h4 className="chat-job-title">{job.job_title || job.title}</h4>
                    <p className="chat-job-company">{job.company_name || job.company}</p>

                    {/* Location with Remote Badge */}
                    {job.location && (
                      <p className="chat-job-location">
                        📍 {job.location}
                        {job.is_remote && (
                          <span style={{
                            marginLeft: '6px',
                            backgroundColor: '#8b5cf6',
                            color: 'white',
                            padding: '1px 6px',
                            borderRadius: '8px',
                            fontSize: '10px'
                          }}>
                            🏠 Remote
                          </span>
                        )}
                      </p>
                    )}

                    {job.salary && (
                      <p className="chat-job-salary" style={{ fontSize: '11px', color: '#10b981', fontWeight: '600' }}>
                        💰 {job.salary}
                      </p>
                    )}

                    {/* Job Type */}
                    {job.job_type && (
                      <p style={{ fontSize: '10px', color: '#6b7280', marginTop: '4px' }}>
                        🕐 {job.job_type}
                      </p>
                    )}

                    {/* Match Reason from Gemini */}
                    {job.match_reason && (
                      <p style={{
                        fontSize: '10px',
                        color: '#374151',
                        marginTop: '6px',
                        fontStyle: 'italic',
                        backgroundColor: '#f3f4f6',
                        padding: '4px 6px',
                        borderRadius: '4px'
                      }}>
                        💡 {job.match_reason}
                      </p>
                    )}

                    {/* Wellbeing Fit Indicator */}
                    {job.wellbeing_fit && (
                      <span style={{
                        fontSize: '10px',
                        marginTop: '4px',
                        display: 'inline-block'
                      }}>
                        {job.wellbeing_fit === 'good' && '💚 Good fit for you'}
                        {job.wellbeing_fit === 'moderate' && '💛 Moderate fit'}
                        {job.wellbeing_fit === 'caution' && '🧡 Consider carefully'}
                      </span>
                    )}
                  </div>

                  <a
                    href={job.apply_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chat-job-apply-btn"
                  >
                    Apply Now →
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="card assistant-card">
      <div className="card-header">
        <h2>AI Career Assistant</h2>
        <p>Powered by Gemini. Ask about career paths, skills, or get personalized advice.</p>
      </div>
      <div className="card-body assistant-body">
        <div className="chat-window" ref={chatWindowRef}>
          {messages.map((msg, idx) => renderMessage(msg, idx))}
        </div>
        <div className="chat-input-row">
          <textarea
            rows={2}
            placeholder="Ask about careers, skills, or get advice... (Enter to send, Shift+Enter for new line)"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="primary-cta" type="button" onClick={onSend} disabled={isSending || !input.trim()}>
            {isSending ? '...' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ JOB STREAM PANEL ============
function JobStreamPanel() {
  const sampleJobs = [
    { source: 'LinkedIn', title: 'Junior Data Analyst', company: 'Northbridge Analytics', location: 'Hybrid · Berlin' },
    { source: 'Indeed', title: 'Product Manager Intern', company: 'Aurora Labs', location: 'Remote' },
    { source: 'LinkedIn', title: 'ML Engineer', company: 'Helix AI', location: 'On-site · London' },
  ];

  return (
    <div className="card assistant-card">
      <div className="card-header">
        <h2>Live Job Feed</h2>
        <p>Real-time opportunities from LinkedIn and Indeed APIs.</p>
      </div>
      <div className="card-body">
        <ul className="list">
          {sampleJobs.map((job) => (
            <li key={`${job.source}-${job.title}`} className="list-item">
              <div><div className="list-title">{job.title}</div><div className="list-subtitle">{job.company} · {job.location}</div></div>
              <span className="badge subtle">{job.source}</span>
            </li>
          ))}
        </ul>
        <p className="muted small-note">Connect to your backend for real-time postings.</p>
      </div>
    </div>
  );
}