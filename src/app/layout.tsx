import type { ReactNode } from "react";

export const metadata = {
  title: "IT Support",
  description: "Multi-tenant IT support platform",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
