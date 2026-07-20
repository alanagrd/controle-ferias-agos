"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="text-xs text-white/70 hover:text-white border border-white/20 rounded-md px-2.5 py-1.5 hover:bg-white/10 transition"
    >
      Sair
    </button>
  );
}
