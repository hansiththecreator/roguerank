// app/layout.js
import "../styles/globals.css";
import Script from "next/script";
import Footer from "./components/Footer";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* ✅ Ezoic Privacy Scripts (must be first) */}
        <Script
          data-cfasync="false"
          src="https://cmp.gatekeeperconsent.com/min.js"
          strategy="afterInteractive"
        />
        <Script
          data-cfasync="false"
          src="https://the.gatekeeper.com/cmp.min.js"
          strategy="afterInteractive"
        />

        {/* ✅ Ezoic Header Script (initializes ad system) */}
        <Script src="https://www.ezojs.com/ezoic/sa.min.js" strategy="afterInteractive" />
        <Script
          id="ezoic-standalone-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html:
              "window.ezstandalone=window.ezstandalone||{};window.ezstandalone.cmd=window.ezstandalone.cmd||[];",
          }}
        />

        {/* ✅ Ezoic Analytics */}
        <Script src="https://ezoicanalytics.com/analytics.js" strategy="afterInteractive" />
      </head>
      <body style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
        color: "var(--color-text)",
        margin: 0,
        fontFamily: "Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial"
      }}>
        <main style={{ flex: 1 }}>
          {children}
        </main>

        <Footer />
      </body>
    </html>
  );
}
export const metadata = {
  title: "Rogue Rank",
  icons: {
    icon: "/RogueRank.jpeg",
  },
};
