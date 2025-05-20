import type { Metadata } from 'next';
import { Geist } from 'next/font/google'; // Using Geist Sans as primary
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

// Geist Mono can be removed if not explicitly used, but keeping for now.
const geistMono = Geist({ // Corrected from Geist_Mono
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500', '700'], // Example weights
});


export const metadata: Metadata = {
  title: 'RhythmAssist: CPR Coach',
  description: 'A CPR compression coach providing real-time feedback and metronome guidance.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
