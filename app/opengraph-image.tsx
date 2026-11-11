import { ImageResponse } from "next/og";

// Default Open Graph image for every page that does not set its own
// (launch plan U3). Static: rendered at build time, no data access.
export const alt = "CXJobs: customer experience jobs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(135deg, #071738 0%, #162f67 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 96, fontWeight: 800, letterSpacing: "-0.04em" }}>
          <span style={{ color: "#47d79d" }}>CX</span>
          <span>Jobs</span>
        </div>
        <div style={{ marginTop: 24, fontSize: 44, fontWeight: 600, maxWidth: 900 }}>
          Customer experience jobs: call centers, multilingual roles and flexible shifts.
        </div>
      </div>
    ),
    size
  );
}
