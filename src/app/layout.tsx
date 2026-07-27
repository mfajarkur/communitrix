import type { Metadata } from "next";
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

import Footer from "./footer";

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
      <body className="min-h-screen w-full overflow-y-auto bg-white text-[#111827]">
        <div className="w-full min-h-screen flex flex-col justify-between relative font-sans">
          <div className="flex-1 flex flex-col">
            {children}
          </div>
          <Footer />
        </div>
      </body>
    </html>
  );
}
