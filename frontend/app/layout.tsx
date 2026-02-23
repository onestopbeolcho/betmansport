import type { Metadata } from "next";
import { Inter, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import { CartProvider } from "../context/CartContext";
import { AuthProvider } from "./context/AuthContext";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-kr",
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
});

export const metadata: Metadata = {
  title: "Scorenix | AI Sports Data Analytics",
  description: "AI-powered sports data analytics platform — scorenix.com",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.variable} ${geistMono.variable} ${notoSansKr.variable} antialiased bg-[#06060a] text-[#eaeaf0]`}>
        <AuthProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
