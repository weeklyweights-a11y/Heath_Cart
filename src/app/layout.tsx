import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { HealthCartProvider } from "@/context/HealthCartContext";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "HealthCart",
  description: "Your Family's Wellness Starts Here",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-body">
        <HealthCartProvider>
          <AppShell>{children}</AppShell>
        </HealthCartProvider>
      </body>
    </html>
  );
}
