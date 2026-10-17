import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dish-Market Fit Advisor",
  description:
    "Test the market fit of a dish or menu concept before you launch it: real candidate venues, their actual audience affinity, and a pilot plan — grounded in Qloo's live taste graph, not guesswork.",
  openGraph: {
    title: "Dish-Market Fit Advisor",
    description:
      "Qloo-grounded pilot package generator for chefs and food operators: real venues, audience affinity, and a launch plan from a dish concept and a city.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
