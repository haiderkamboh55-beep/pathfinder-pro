import { createClient } from '@supabase/supabase-js';

// Configure these in a `.env` file at `Frontend/frontend/.env`:
// VITE_SUPABASE_URL=your-project-url
// VITE_SUPABASE_ANON_KEY=your-anon-key

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if credentials are actually configured (not just placeholder text)
const isConfigured = supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('your_') &&
  !supabaseUrl.includes('your-') &&
  supabaseUrl.startsWith('http');

if (!isConfigured) {
  console.warn(
    '[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not properly configured. Auth calls will fail until configured.',
  );
}

// Create the Supabase client
// Explicitly using localStorage to ensure PKCE code verifier persists for password reset
export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // Explicitly use localStorage (not sessionStorage or custom)
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      // Required for PKCE password reset to work
      // The code_verifier must persist between requesting reset and clicking the link
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      // PKCE flow for security
      flowType: 'pkce',
      // Store auth token with this prefix
      storageKey: 'sb-pathfinder-auth-token',
    },
  })
  : {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      getUser: () => Promise.resolve({ data: null, error: null }),
      signInWithPassword: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      signUp: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
      signOut: () => Promise.resolve({ error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
      resetPasswordForEmail: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
      updateUser: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
      exchangeCodeForSession: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }),
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null, error: null }) }) }),
      upsert: () => Promise.resolve({ error: null }),
    }),
  };

// Note: We removed the localStorage cleanup code that was here.
// The previous code was clearing Supabase's PKCE code_verifier from localStorage,
// which broke password reset functionality.

