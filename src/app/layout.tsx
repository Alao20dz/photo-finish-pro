import type { Metadata, Viewport } from "next";
import { Cairo, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { I18nProvider } from "@/lib/i18n";
import { Toaster } from "@/components/ui/toaster";

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "فتو فينيش برو — منصة إدارة تظاهرات ألعاب القوى",
  description:
    "منصة واحدة للرابطات والأندية والحكام: تسجيل العدائين، التوقيت بمسح شريطي بدقة الملي ثانية، نقاط المراقبة، والنتائج الرسمية — تعمل حتى دون إنترنت.",
  keywords: ["ألعاب القوى", "توقيت إلكتروني", "Photo Finish", "عدو ريفي", "رابطات", "أندية"],
  openGraph: {
    title: "فتو فينيش برو — كل خط نهاية يستحق حكماً رقمياً",
    description: "إدارة كاملة للتظاهرات: من التسجيل إلى النتائج الرسمية، بمزامنة لحظية وعمل دون إنترنت.",
    type: "website",
    locale: "ar_DZ",
  },
};

export const viewport: Viewport = {
  themeColor: "#e63917",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} ${plexMono.variable} antialiased bg-background text-foreground`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} themes={["light", "dark", "sunlight"]}>
          <I18nProvider>{children}</I18nProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
