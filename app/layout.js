// app/layout.js
import "../styles/globals.css";
import Footer from "./components/Footer";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* ✅ Ezoic Privacy Scripts (must be first) */}
        <script
          data-cfasync="false"
          src="https://cmp.gatekeeperconsent.com/min.js"
        ></script>
        <script
          data-cfasync="false"
          src="https://the.gatekeeper.com/cmp.min.js"
        ></script>

        {/* ✅ Ezoic Header Script (initializes ad system) */}
        <script async src="https://www.ezojs.com/ezoic/sa.min.js"></script>
        <script>
          {`
            window.ezstandalone = window.ezstandalone || {};
            ezstandalone.cmd = ezstandalone.cmd || [];
          `}
        </script>

        {/* ✅ Ezoic Analytics */}
        <script src="https://ezoicanalytics.com/analytics.js"></script>
      </head>
      <body style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#0f172a",
        color: "#e6eef8",
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
