/**
 * Legacy re-export — prefer importing from '@/lib/supabase/client' directly.
 * Kept so that existing code that imports from '@/lib/supabase' continues to work.
 */
import { createClient } from './supabase/client';

export const supabase = createClient();
export default supabase;
