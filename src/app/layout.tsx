import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Settle: pay the band before the van pulls out",
  description:
    "Settle is an AI settlement agent for independent concerts. It reads the deal memo, reconciles PayPal ticket orders, applies the deal in code, and pays every act and crew member in one PayPal Payouts batch, inside guardrails.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
