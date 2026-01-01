// app/layout.js
import "../styles/globals.css";
import Footer from "./components/Footer";

export default function RootLayout({ children }) {
  return (
    <html lang="en">
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
