import { ImageResponse } from "next/og";

// PNG version of the cursor mark (app/icon.svg) for Apple home-screen and
// browsers that don't take SVG icons.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#0a0a0a" }}>
        <svg width="180" height="180" viewBox="0 0 32 32">
          <path d="M11.5 7.5 V23 L15.2 19.6 L17.8 25 L20.4 23.8 L17.8 18.4 L22.8 18.2 Z" fill="#ffffff" />
        </svg>
      </div>
    ),
    size,
  );
}
