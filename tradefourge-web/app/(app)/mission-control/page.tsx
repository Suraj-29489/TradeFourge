"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MissionControlLegacyRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/admin-controls");
  }, [router]);

  return null;
}
