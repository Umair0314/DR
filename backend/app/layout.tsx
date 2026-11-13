import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SEO SERP Metrics API",
  description: "Secure Ahrefs Domain Rating API for the SEO SERP Metrics extension.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
