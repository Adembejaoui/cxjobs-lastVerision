"use client";

import { onCLS, onFCP, onLCP, onTTFB, onINP, Metric } from "web-vitals";

function sendToAnalytics(metric: Metric) {
  if (process.env.NODE_ENV === "development") {
    console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric.rating);
  } else {
    const body = JSON.stringify({
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      page: window.location.pathname,
      timestamp: Date.now(),
    });

    const url = "/api/analytics/web-vitals";

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, body);
    } else {
      fetch(url, { method: "POST", body, keepalive: true }).catch(() => {});
    }
  }
}

export function WebVitalsReporter() {
  if (typeof window === "undefined") {
    return null;
  }

  onCLS(sendToAnalytics);
  onFCP(sendToAnalytics);
  onLCP(sendToAnalytics);
  onTTFB(sendToAnalytics);
  onINP(sendToAnalytics);

  return null;
}