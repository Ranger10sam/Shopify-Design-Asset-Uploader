import type { Metadata } from "next";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Design Asset Uploader",
  description: "Validate asset folders, generate zip files, and upload them to S3.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
