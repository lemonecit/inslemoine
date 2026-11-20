import { ImageResponse } from "next/og";
import { SITE_NAME } from "@/lib/site";

export const alt = `${SITE_NAME} : pour un monde numérique sans barrières`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
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
          background: "#0a1a33",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            letterSpacing: 4,
            color: "#b8ccf2",
            textTransform: "uppercase",
          }}
        >
          Association loi 1901 · Paris
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 88,
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          {SITE_NAME}
        </div>
        <div style={{ display: "flex", marginTop: 32, fontSize: 40, color: "#b8ccf2" }}>
          Pour un monde numérique sans barrières.
        </div>
      </div>
    ),
    size,
  );
}
