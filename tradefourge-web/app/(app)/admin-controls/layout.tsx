"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isOwner } from "@/lib/config/owner";
import { fetchUserProfile } from "@/lib/supabase/profile";
import { ShieldAlert, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function AdminControlsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const profile = await fetchUserProfile(user.id);
          if (isOwner({ role: profile?.role, email: user.email })) {
            setIsAuthorized(true);
          } else {
            setIsAuthorized(false);
          }
        } else {
          setIsAuthorized(false);
        }
      } catch {
        setIsAuthorized(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 font-mono text-xs text-gray-400">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        <span>Authenticating Owner Workspace Authority...</span>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center font-mono space-y-6 max-w-md mx-auto">
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
          <ShieldAlert className="w-12 h-12" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">403 Unauthorized Access</h1>
          <p className="text-xs text-gray-400 leading-relaxed">
            The Admin Controls Hub is restricted exclusively to the designated owner account (`NEXT_PUBLIC_OWNER_EMAIL`).
          </p>
        </div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-glow text-xs"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  return <>{children}</>;
}
