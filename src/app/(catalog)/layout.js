import { Bebas_Neue, Roboto } from "next/font/google";

const roboto = Roboto({
  weight: ["400", "500", "700", "900"],
  subsets: ["latin"],
  variable: "--font-catalog",
});

const bebas = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-catalog-display",
});

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Catálogo · Eletromall Outlet",
  description: "Produtos disponíveis para consulta e retirada nas lojas Eletromall Outlet.",
};

export default function CatalogLayout({ children }) {
  return <div className={`${roboto.variable} ${bebas.variable}`}>{children}</div>;
}
