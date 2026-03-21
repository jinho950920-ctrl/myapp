import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ERP Automation Dashboard",
  description: "Advanced Corporate 8-Pillar ERP Architecture",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen font-sans`}>
        <TooltipProvider>
          <SidebarProvider>
            <AppSidebar />
            <main className="flex-1 w-full min-h-screen bg-muted/20 relative">
              <SidebarTrigger className="absolute top-4 left-4 z-50 md:hidden" />
              <div className="p-4 md:p-8 pt-16 md:pt-8 h-full">
                {children}
              </div>
            </main>
          </SidebarProvider>
          <Toaster position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
