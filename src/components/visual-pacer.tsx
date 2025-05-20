"use client";

import type { FC } from 'react';
import React from 'react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface VisualPacerProps {
  currentRate: number;
  targetMinRate: number;
  targetMaxRate: number;
  maxDisplayRate?: number;
}

const VisualPacer: FC<VisualPacerProps> = ({
  currentRate,
  targetMinRate,
  targetMaxRate,
  maxDisplayRate = 150,
}) => {
  const progressValue = Math.min((currentRate / maxDisplayRate) * 100, 100);

  let pacerColorClass = 'bg-primary'; // Default: good pace (blue)
  if (currentRate > 0 && currentRate < targetMinRate) {
    pacerColorClass = 'bg-accent'; // Too slow (orange)
  } else if (currentRate > targetMaxRate) {
    pacerColorClass = 'bg-accent'; // Too fast (orange)
  }

  // Ensure a minimum visible progress if rate is very low but not zero
  const displayProgressValue = currentRate > 0 && progressValue < 2 ? 2 : progressValue;

  return (
    <div className="w-full space-y-2">
      <div className="relative h-6 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            "absolute top-0 left-0 h-full transition-all duration-300 ease-out",
            pacerColorClass
          )}
          style={{ width: `${displayProgressValue}%` }}
        />
        {/* Target range indicator */}
        <div
          className="absolute top-0 h-full border-x-2 border-card opacity-50"
          style={{
            left: `${(targetMinRate / maxDisplayRate) * 100}%`,
            width: `${((targetMaxRate - targetMinRate) / maxDisplayRate) * 100}%`,
          }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span className="font-semibold text-foreground">{currentRate} <span className="font-normal">CPM</span></span>
        <span>{maxDisplayRate}</span>
      </div>
      <p className="text-center text-sm text-muted-foreground">Target: {targetMinRate}-{targetMaxRate} CPM</p>
    </div>
  );
};

export default VisualPacer;
