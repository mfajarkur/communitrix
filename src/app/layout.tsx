import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

const nexa = localFont({
  src: [
    {
      path: "./fonts/Nexa-ExtraLight.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "./fonts/Nexa-ExtraLight.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "./fonts/Nexa-ExtraLight.ttf",
      weight: "500",
      style: "normal",
    },
    {
      path: "./fonts/Nexa-Heavy.ttf",
      weight: "600",
      style: "normal",
    },
    {
      path: "./fonts/Nexa-Heavy.ttf",
      weight: "700",
      style: "normal",
    },
    {
      path: "./fonts/Nexa-Heavy.ttf",
      weight: "800",
      style: "normal",
    },
    {
      path: "./fonts/Nexa-Heavy.ttf",
      weight: "900",
      style: "normal",
    },
  ],
  variable: "--font-nexa",
});

export const metadata: Metadata = {
  title: "Communitrix",
  description: "Elevate your community through intelligent matrix. Matchmaking, ELO ratings, and active player rosters for sports clubs.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

// viewportFit: 'cover' lets the page extend under the iPhone home-indicator
// area and makes env(safe-area-inset-bottom) resolve to a real value instead
// of 0 — without it, the bottom nav's label can sit under/behind the home
// indicator on notched iPhones.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nexa.variable} h-full antialiased`}
    >
      <body className="min-h-screen w-full overflow-y-auto bg-zinc-950 text-[#111827]">
        <div className="w-full min-h-screen flex flex-col relative font-sans">
          {children}
        </div>
      </body>
    </html>
  );
}
