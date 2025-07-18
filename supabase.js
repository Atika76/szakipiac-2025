// supabase.js
const SUPABASE_URL = "https://cvcxdeunzlhcrayutuew.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2Y3hkZXVuemxoY3JheXV0dWV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIxNjgyMTQsImV4cCI6MjA2Nzc0NDIxNH0.mmp-rbNPxoPJmotz5NY5XLAwdhHBkvoDKQxY6V1iSbo";

// A változó nevét 'supabase'-ről 'supaClient'-re cseréljük a hiba elkerülése érdekében.
const supaClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
