import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PR Navigator',
  description: 'Navigate GitHub issues and pull requests on a visual board',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="h-screen overflow-hidden bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        {children}
      </body>
    </html>
  );
}
