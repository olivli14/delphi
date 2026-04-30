import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Delphi Prediction",
  description:
    "Day-ahead battery scheduling for the Greek electricity market — probabilistic price forecasting, thermal-aware MILP optimization.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
