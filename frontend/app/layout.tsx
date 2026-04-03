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

const SITE_URL = "https://scorenix.com";

export const metadata: Metadata = {
  title: {
    default: "Scorenix | AI Sports Data Analytics",
    template: "%s | Scorenix",
  },
  description:
    "AI-powered sports data analytics platform — real-time odds analysis, match prediction, and portfolio optimization with LightGBM machine learning.",
  keywords: [
    "sports analytics",
    "AI prediction",
    "odds analysis",
    "match prediction",
    "sports data",
    "LightGBM",
    "value analysis",
    "스포츠 분석",
    "AI 예측",
    "데이터 분석",
  ],
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
    languages: {
      ko: "/ko",
      en: "/en",
      ja: "/ja",
      zh: "/zh",
      es: "/es",
      fr: "/fr",
      de: "/de",
      pt: "/pt",
    },
  },
  openGraph: {
    type: "website",
    locale: "ko_KR",
    url: SITE_URL,
    siteName: "Scorenix",
    title: "Scorenix — AI Sports Data Analytics",
    description:
      "AI가 글로벌 스포츠 데이터를 실시간 분석합니다. 데이터 효율, 경기 확률 분석, 조합 최적화까지.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Scorenix AI Sports Data Analytics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scorenix — AI Sports Data Analytics",
    description:
      "AI-powered real-time sports analytics: odds efficiency, match prediction & portfolio optimization.",
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/icon-512.png",
  },
  manifest: "/manifest.json",
  verification: {
    // Google Search Console — 발급 후 실제 값으로 교체
    // google: "your-google-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="canonical" href={SITE_URL} />
        <meta name="theme-color" content="#00d4ff" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        {/* Structured Data — Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Scorenix",
              url: SITE_URL,
              description:
                "AI-powered sports data analytics platform with real-time odds analysis and match prediction.",
              applicationCategory: "SportsApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                description: "Free tier available",
              },
              creator: {
                "@type": "Organization",
                name: "DesignBiz (Scorenix)",
                url: SITE_URL,
                email: "scorenix@gmail.com",
              },
            }),
          }}
        />

        {/* ── Google Analytics 4 (G-1DPQS8LHSC) ── */}
        <script
          async
          src="https://www.googletagmanager.com/gtag/js?id=G-1DPQS8LHSC"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-1DPQS8LHSC');
            `,
          }}
        />

        {/* ── Naver Search Advisor ── */}
        <meta
          name="naver-site-verification"
          content="dcef3f6ea8d6841b3c25bd69f3d9b6183d4f4fd4"
        />
      </head>
      <body
        className={`${inter.variable} ${geistMono.variable} ${notoSansKr.variable} antialiased bg-[#06060a] text-[#eaeaf0]`}
      >
        <AuthProvider>
          <CartProvider>{children}</CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
