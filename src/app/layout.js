import { Outfit, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata = {
  title: "Eletro-Stock · Eletromall",
  description: "Gestão de estoque individual do Outlet Eletromall",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark")t="dark";var e=document.documentElement;e.classList.remove("light","dark");e.classList.add(t);e.style.colorScheme=t;}catch(e){}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR" className={`${outfit.variable} ${jetbrains.variable} h-full dark`} suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
