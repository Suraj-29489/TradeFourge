"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AnnouncementsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin-controls?tab=announcements");
  }, [router]);
  return null;
}
