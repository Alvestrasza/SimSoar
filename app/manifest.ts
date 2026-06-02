import type {MetadataRoute} from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SimSoar – Virtual Gliding Community",
    short_name: "SimSoar",
    description:
      "Multi-user platform for virtual gliding flights from MSFS, Condor and X-Plane.",
    start_url: "/de",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5f7fb",
    theme_color: "#1f6feb",
    categories: ["sports", "simulation", "navigation", "utilities"],
    lang: "de",
    icons: [
    {
        src: "/icons/simsoar.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any"
    },
    {
        src: "/icons/simsoar.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable"
    }
    ]
  };
}
