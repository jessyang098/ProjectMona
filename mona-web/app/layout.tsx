import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Project Mona - AI Companion",
  description: "Your personal AI companion with personality and emotion",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Eruda mobile debugging console - only loads on mobile devices */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Only load Eruda on mobile devices
                var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                if (isMobile) {
                  var script = document.createElement('script');
                  script.src = 'https://cdn.jsdelivr.net/npm/eruda';
                  script.onload = function() {
                    eruda.init();
                    console.log('📱 Eruda mobile console initialized - tap the green icon to open');
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
