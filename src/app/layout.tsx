import type { Metadata, Viewport } from "next";
import { DM_Sans, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-ibm-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "AlpNav",
  description: "Unified Zillertal ski navigation shell app.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${ibmPlexMono.variable} antialiased`}>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              document.addEventListener('touchmove', function(e) {
                if (e.touches.length > 1) {
                  var t = e.target;
                  while (t && t !== document.body) {
                    if (t.tagName === 'CANVAS') return;
                    t = t.parentElement;
                  }
                  e.preventDefault();
                }
              }, { passive: false });
            `,
          }}
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
