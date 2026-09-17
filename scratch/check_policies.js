import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkPolicies() {
  const { data, error } = await supabase.rpc('query_policies');
  if (error) {
    console.error("RPC failed, trying raw query...", error.message);
    // fallback if no rpc exists
  } else {
    console.log(data);
  }
}
checkPolicies();
