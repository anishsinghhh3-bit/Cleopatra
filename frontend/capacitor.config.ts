import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cleopatra.chess",
  appName: "Cleopatra",
  webDir: "dist",
  backgroundColor: "#12181A",
  server: {
    androidScheme: "http",
  },
  plugins: {
    SystemBars: {
      insetsHandling: "css",
      style: "DARK",
    },
  },
};

export default config;
