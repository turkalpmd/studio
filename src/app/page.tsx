
"use client"; // Required for useState and event handlers

import React, { useState } from 'react';
import CPRSimulator from '@/components/cpr-simulator';
import { cn } from '@/lib/utils';

export default function Home() {
  const defaultBackground = "bg-gradient-to-br from-background to-secondary/30";
  const [pageBackgroundClass, setPageBackgroundClass] = useState<string>(defaultBackground);

  const handlePerformanceChange = (newBgClass: string) => {
    setPageBackgroundClass(newBgClass || defaultBackground);
  };

  return (
    <div className={cn("flex flex-col min-h-screen transition-colors duration-500", pageBackgroundClass)}>
      <header className="py-6 px-4 md:px-6 border-b border-border/50">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            <h1 className="text-2xl font-bold text-primary">RhythmAssist</h1>
          </div>
        </div>
      </header>

      <main className="flex-grow container mx-auto px-4 py-8 md:py-12 flex flex-col items-center justify-center">
        <CPRSimulator onPerformanceChange={handlePerformanceChange} />
      </main>

      <footer className="py-6 px-4 md:px-6 border-t border-border/50">
        <div className="container mx-auto text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} RhythmAssist. For training purposes only.</p>
        </div>
      </footer>
    </div>
  );
}
