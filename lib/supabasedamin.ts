import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error(
    "La variable NEXT_PUBLIC_SUPABASE_URL no está definida. Revisa tu archivo de entorno."
  );
}

if (!supabaseServiceRoleKey) {
  throw new Error(
    "La variable SUPABASE_SERVICE_ROLE_KEY no está definida. Revisa tu archivo de entorno."
  );
}

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);
