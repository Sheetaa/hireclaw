import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

export const metadata = {
  title: "HireClaw",
  description: "AI Agent Marketplace",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
