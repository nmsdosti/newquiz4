import { createClient } from "@supabase/supabase-js";

// Use environment variables with fallback to hardcoded values
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://xxlwvrjhaqqzpcbtepex.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4bHd2cmpoYXFxenBjYnRlcGV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA4MjU5OTEsImV4cCI6MjA2NjQwMTk5MX0.raavEBd4IGWyvwiGRi_2PsArGQ_C2C1p4RJC3rYKsaE";

console.log(
  "Initializing Supabase client with URL:",
  supabaseUrl.substring(0, 15) + "...",
);

// Create Supabase client with additional options to handle CORS issues
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: "pkce",
  },
});
