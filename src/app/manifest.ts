import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Trading Intelligence Platform",
    short_name: "TradeIntel",
    description: "Private trading research, signal proof, and paper-trade command center.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080a0d",
    theme_color: "#6ee7b7",
    orientation: "portrait",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
