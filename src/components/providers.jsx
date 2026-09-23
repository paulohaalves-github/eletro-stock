"use client";

import { ThemeProvider, useTheme } from "@/components/theme-provider";
import { Toaster } from "sonner";

function AppToaster() {
  const { theme, ready } = useTheme();
  return (
    <Toaster
      theme={ready && theme === "light" ? "light" : "dark"}
      position="top-right"
      toastOptions={{
        className: "card !bg-[var(--surface)] !text-[var(--text)] !border-[var(--border)]",
      }}
    />
  );
}

export function Providers({ children }) {
  return (
    <ThemeProvider defaultTheme="dark">
      {children}
      <AppToaster />
    </ThemeProvider>
  );
}
