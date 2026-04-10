import "./globals.css";

export const metadata = {
  title: "Treasure Hunt — Dashboard",
  description: "Management console for Treasure Hunt survey data",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
