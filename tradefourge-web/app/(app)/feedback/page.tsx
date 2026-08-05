"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FeedbackRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin-controls?tab=feedback");
  }, [router]);
  return null;
}
