import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";

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
        {/* Eruda mobile debugging console - loads when ?debug=true, /debug path, or localStorage has mona_debug */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                var params = new URLSearchParams(window.location.search);
                var path = window.location.pathname;

                // Check multiple debug triggers:
                // 1. ?debug=true query param
                // 2. /debug path
                // 3. localStorage mona_debug
                var debugFromQuery = params.get('debug') === 'true';
                var debugFromPath = path === '/debug' || path.startsWith('/debug');
                var debugFromStorage = localStorage.getItem('mona_debug') === 'true';
                var debugEnabled = debugFromQuery || debugFromPath || debugFromStorage;

                // Save debug mode to localStorage if enabled via URL
                if (debugFromQuery || debugFromPath) {
                  localStorage.setItem('mona_debug', 'true');
                }

                if (debugEnabled) {
                  var script = document.createElement('script');
                  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
                  script.onload = function() {
                    eruda.init();
                  };
                  document.head.appendChild(script);
                }
              })();
            `,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
