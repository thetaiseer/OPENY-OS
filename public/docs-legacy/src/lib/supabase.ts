import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL      = 'https://wbykthocbhubycdqpoat.supabase.co';
// Replace with your actual anon key from:
//   Supabase Dashboard → Project Settings → API → Project API keys → anon public
const SUPABASE_ANON_KEY = 'PUT_YOUR_REAL_ANON_KEY_HERE';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
