import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Mona - AI Companion",
  description: "Your personal AI companion with personality and emotion",
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    viewportFit: "cover",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Eruda mobile debugging console - only loads when ?debug=true or localStorage has mona_debug */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var params = new URLSearchParams(window.location.search);
                var debugEnabled = params.get('debug') === 'true' || localStorage.getItem('mona_debug') === 'true';

                // Save debug mode to localStorage if enabled via URL
                if (params.get('debug') === 'true') {
                  localStorage.setItem('mona_debug', 'true');
                }

                if (debugEnabled) {
                  var script = document.createElement('script');
                  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
                  script.onload = function() {
                    eruda.init();
                    console.log('📱 Eruda mobile console initialized');
                  };
                  document.head.appendChild(script);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
