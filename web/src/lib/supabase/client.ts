// Supabase-Client (optional). Ist keine Env gesetzt, läuft die App mit
// LocalStorage-Persistenz weiter — so bootet das Scaffold ohne Setup.
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseEnabled = Boolean(url && key);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(url as string, key as string)
  : null;
