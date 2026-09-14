import { createClient } from "@supabase/supabase-js";

/** Cliente Supabase com a service_role — SÓ pode ser usado no servidor
 *  (Route Handlers). Ignora RLS e permite a Admin API (criar usuários).
 *  Nunca importar isto em componentes client. */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY (ou URL) não configurada no servidor."
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
