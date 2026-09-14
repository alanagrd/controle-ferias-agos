"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ColaboradorLogout() {
  const router = useRouter();
  async function sair() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/colaborador/login");
    router.refresh();
  }
  return (
    <button
      onClick={sair}
      className="text-sm text-white/70 hover:text-white border border-white/20 rounded-md px-3 py-1.5"
    >
      Sair
    </button>
  );
}
