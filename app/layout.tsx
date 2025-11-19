import type { ReactNode } from "react";

export const metadata = {
  title: "CristalCar ERP",
  description: "ERP financeiro CristalCar rodando em Next.js + Turso",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
