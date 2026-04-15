import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HeatShield: AI-Powered Urban Heat Monitoring",
  description: "ML-powered heat vulnerability model with 3D visualization",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta property="og:title" content="HeatShield AI" />
        <meta property="og:description" content="Explore Chennai's heat vulnerability hotspots through interactive 3D mapping and data visualization!" />
        <meta property="og:image" content="/HeatShieldai.png" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://heatshield-ai.vercel.app/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="HeatShield AI" />
        <meta name="twitter:description" content="Explore Chennai's heat vulnerability hotspots through interactive 3D mapping and data visualization!" />
        <meta name="twitter:image" content="/HeatShieldai.png" />
      </head>
      <body
        className="antialiased"
        style={
          {
            "--font-geist-sans":
              'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            "--font-geist-mono":
              '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
          } as React.CSSProperties
        }
      >
        {children}
      </body>
    </html>
  );
}
