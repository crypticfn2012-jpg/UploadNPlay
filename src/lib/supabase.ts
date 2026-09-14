import { createClient } from '@supabase/supabase-js';

// The Supabase anon key is safe to use in browser code. Keeping these fallbacks
// makes the GitHub Pages build work even when Actions environment variables are
// not configured.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rldidvwcylirjyfktvtg.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsZGlkdndjeWxpcmp5Zmt0dnRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyMjM0OTAsImV4cCI6MjEwMTc5OTQ5MH0.YO5zeu5uL3siDDPVfs9c9v_VCETHixTWXjzotVOEp0U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
