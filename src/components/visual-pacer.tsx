
"use client";

import type { FC } from 'react';
import React from 'react';
import { cn } from '@/lib/utils';

interface VisualPacerProps {
  currentRate: number;
  metronomeBpm: number;
  maxDisplayRate?: number;
}

const VisualPacer: FC<VisualPacerProps> = ({
  currentRate,
  metronomeBpm,
  maxDisplayRate = 150, // Max rate for the progress bar scale
}) => {
  const progressValue = Math.min((currentRate / maxDisplayRate) * 100, 100);
  const displayProgressValue = currentRate > 0 && progressValue < 2 ? 2 : progressValue;

  const lowerIdealBound = metronomeBpm * 0.9;
  const upperIdealBound = metronomeBpm * 1.1;
  const lowerWarnBound = metronomeBpm * 0.8;
  const upperWarnBound = metronomeBpm * 1.2;

  let textColorClass = 'text-foreground'; // Default text color

  if (currentRate > 0) {
    if (currentRate >= lowerIdealBound && currentRate <= upperIdealBound) {
      textColorClass = 'text-green-700 dark:text-green-300'; // Good zone text
    } else if ((currentRate >= lowerWarnBound && currentRate < lowerIdealBound) || (currentRate > upperIdealBound && currentRate <= upperWarnBound)) {
      textColorClass = 'text-yellow-700 dark:text-yellow-400'; // Warning zone text (using a generic yellow)
    } else {
      textColorClass = 'text-red-700 dark:text-red-400'; // Bad zone text (using a generic red)
    }
  }


  return (
    <div className={cn(
        "w-full space-y-3 p-4 rounded-lg shadow-inner bg-card/90 backdrop-blur-sm transition-colors duration-300"
      )}
    >
      <div className="relative h-6 rounded-full bg-secondary/60 dark:bg-secondary/40 overflow-hidden border border-muted">
        <div
          className="absolute top-0 left-0 h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${displayProgressValue}%` }}
        />
        <div
          className="absolute top-0 h-full border-x-2 border-foreground/40 opacity-75"
          style={{
            left: `${Math.max(0, (lowerIdealBound / maxDisplayRate) * 100)}%`,
            width: `${Math.min(100, ((upperIdealBound - lowerIdealBound) / maxDisplayRate) * 100)}%`,
          }}
          title={`Ideal range: ${Math.round(lowerIdealBound)}-${Math.round(upperIdealBound)} CPM`}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span className={cn("font-semibold text-base", textColorClass)}>
          {currentRate} <span className="font-normal text-xs">CPM</span>
        </span>
        <span>{maxDisplayRate}</span>
      </div>
      <p className={cn("text-center text-sm font-semibold", textColorClass)}>
        Metronome: {metronomeBpm} BPM
      </p>
      <p className={cn("text-center text-xs text-muted-foreground/80", textColorClass)}>
         (Target: {Math.round(lowerIdealBound)}-{Math.round(upperIdealBound)} CPM)
      </p>
    </div>
  );
};

export default VisualPacer;
