"use client";

import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";

export function Providers({ children }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      {children}
      <Toaster
        theme="system"
        position="top-right"
        toastOptions={{
          className: "card !bg-[var(--surface)] !text-[var(--text)] !border-[var(--border)]",
        }}
      />
    </ThemeProvider>
  );
}
