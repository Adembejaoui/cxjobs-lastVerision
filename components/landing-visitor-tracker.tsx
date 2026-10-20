"use client";

import { useEffect } from "react";

export function LandingVisitorTracker() {
  useEffect(() => {
    fetch("/api/analytics/landing-visitor", { method: "POST" }).catch(() => {});
  }, []);

  return null;
}