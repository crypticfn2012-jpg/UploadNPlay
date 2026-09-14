import { createClient } from '@supabase/supabase-js';

// The Supabase anon key is public browser configuration. The fallbacks ensure
// the app still works on GitHub Pages when Actions secrets are unavailable.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rldidvwcylirjyfktvtg.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJybGRpZHZ3Y3lsaXJqeWZrdHZ0ZyIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzg2MjIzNDkwLCJleHAiOjIxMDE3OTk0OTB9.YO5zeu5uL3siDDPVfs9c9v_VCETHixTWXjzotVOEp0U';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
