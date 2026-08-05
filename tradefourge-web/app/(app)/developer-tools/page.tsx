"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DeveloperToolsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin-controls?tab=developer-tools");
  }, [router]);
  return null;
}
