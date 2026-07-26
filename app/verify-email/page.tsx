"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyEmailPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/login");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0B0F17] text-gray-400 font-mono text-xs">
      Redirecting to Sign In...
    </div>
  );
}
