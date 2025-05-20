
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
  // Ensure a minimum visible progress if rate is very low but not zero
  const displayProgressValue = currentRate > 0 && progressValue < 2 ? 2 : progressValue;

  const lowerIdealBound = metronomeBpm * 0.9;
  const upperIdealBound = metronomeBpm * 1.1;

  const lowerWarnBound = metronomeBpm * 0.8; // 20% deviation (outside 10% but within 20%)
  const upperWarnBound = metronomeBpm * 1.2; // 20% deviation

  let dynamicBgClass = 'bg-card'; // Default background
  let textColorClass = 'text-foreground';

  if (currentRate > 0) { // Only apply dynamic colors if compressions are happening
    if (currentRate >= lowerIdealBound && currentRate <= upperIdealBound) {
      dynamicBgClass = 'bg-green-500/20'; // Good zone
      textColorClass = 'text-green-700 dark:text-green-400';
    } else if (currentRate >= lowerWarnBound && currentRate < lowerIdealBound || currentRate > upperIdealBound && currentRate <= upperWarnBound) {
      dynamicBgClass = 'bg-accent/20'; // Warning zone (using accent color - orange)
      textColorClass = 'text-accent-foreground dark:text-accent'; // Needs good contrast with accent
    } else {
      dynamicBgClass = 'bg-destructive/20'; // Bad zone (too far off)
      textColorClass = 'text-destructive-foreground dark:text-destructive';
    }
  }

  return (
    <div className={cn(
        "w-full space-y-3 p-4 rounded-lg shadow-inner transition-colors duration-300",
        dynamicBgClass
      )}
    >
      <div className="relative h-6 rounded-full bg-secondary/60 dark:bg-secondary/40 overflow-hidden border border-muted">
        {/* Progress bar showing current CPM */}
        <div
          className="absolute top-0 left-0 h-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${displayProgressValue}%` }}
        />
        {/* Target range indicator based on metronomeBpm +/- 10% */}
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
      <p className={cn("text-center text-sm", textColorClass)}>
        Metronome: {metronomeBpm} BPM
      </p>
      <p className={cn("text-center text-xs text-muted-foreground/80", textColorClass)}>
         (Target: {Math.round(lowerIdealBound)}-{Math.round(upperIdealBound)} CPM)
      </p>
    </div>
  );
};

export default VisualPacer;
