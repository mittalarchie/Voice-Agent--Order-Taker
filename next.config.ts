import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The realtime voice session will need to reach the browser's mic (client-side)
  // and our own API routes (server-side). No special config needed yet —
  // this file exists as the single place to add it (e.g. headers for
  // microphone permissions policy) once the voice pipeline lands in M4.
};

export default nextConfig;
