"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MonitoringRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin-controls?tab=monitoring");
  }, [router]);
  return null;
}
