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
      <body className="min-h-screen flex justify-center items-start overflow-y-auto bg-[#f3f4f6]">
        <div className="w-full max-w-full md:max-w-4xl lg:max-w-5xl min-h-screen bg-white text-[#111827] shadow-sm flex flex-col relative font-sans">
          {children}
        </div>
      </body>
    </html>
  );
}
