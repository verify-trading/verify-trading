import { ImageResponse } from "next/og";

import { brandColors } from "@/lib/brand";
import { getAppName } from "@/lib/site-config";

export const alt = `${getAppName()} — Verify before you trade.`;
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  // Split the app name on its first "." so the dot renders in the coral brand
  // accent (e.g. "verify" + "." + "trading"); falls back to the whole name.
  const appName = getAppName();
  const dotIndex = appName.indexOf(".");
  const head = dotIndex === -1 ? appName : appName.slice(0, dotIndex);
  const tail = dotIndex === -1 ? "" : appName.slice(dotIndex + 1);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: brandColors.navy,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontSize: 112,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            color: "#ffffff",
          }}
        >
          <span>{head}</span>
          {tail ? <span style={{ color: brandColors.coral }}>.</span> : null}
          <span>{tail}</span>
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 32,
            fontSize: 34,
            color: "rgba(255, 255, 255, 0.62)",
            letterSpacing: "-0.01em",
          }}
        >
          Verify before you trade.
        </div>
      </div>
    ),
    size,
  );
}
