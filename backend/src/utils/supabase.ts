import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'placeholder';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || 'placeholder';

if (!process.env.SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
  console.error('[CRITICAL] Missing SUPABASE_URL in Railway environment variables!');
}
if (!process.env.SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY) {
  console.error('[CRITICAL] Missing SUPABASE_ANON_KEY in Railway environment variables!');
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('[CRITICAL] Missing SUPABASE_SERVICE_ROLE_KEY in Railway environment variables!');
}

// Client for normal transactions or user identity checks
export const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

// Admin client with full bypass of RLS, used only in server-side operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});
