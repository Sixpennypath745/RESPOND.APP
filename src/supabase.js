import { createClient } from '@supabase/supabase-js'

// Anon key is intentionally public — safe to hardcode for PWA resilience
export const supabase = createClient(
  'https://rfeaalvnvqsxhlzbixan.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZWFhbHZudnFzeGhsemJpeGFuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA3Njg4NDQsImV4cCI6MjA5NjM0NDg0NH0.N9ew566ax6c4hVrFxcARVBLocuhP-4LzEFONsJbr2JQ'
)
