"use client";

/**
 * Last-resort boundary for errors thrown in the root layout itself. It
 * replaces the whole document, so it must render <html>/<body> and cannot rely
 * on the app's global CSS being loaded (inline styles only).
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f8fafc",
          color: "#0f172a",
          padding: "16px",
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 28, margin: "0 0 12px" }}>CXJobs is temporarily unavailable</h1>
        <p style={{ margin: "0 0 24px", color: "#475569" }}>Please try again in a moment.</p>
        {error.digest && <p style={{ fontSize: 12, color: "#94a3b8" }}>Reference: {error.digest}</p>}
        <button
          type="button"
          onClick={reset}
          style={{
            border: 0,
            borderRadius: 16,
            background: "#45c68d",
            color: "#fff",
            fontWeight: 700,
            padding: "12px 20px",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
