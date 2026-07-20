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
      className="text-xs text-slate-500 hover:text-slate-900 border border-slate-200 rounded-md px-2.5 py-1.5 hover:bg-slate-100 transition"
    >
      Sair
    </button>
  );
}
