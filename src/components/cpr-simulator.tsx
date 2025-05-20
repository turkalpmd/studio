"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Zap, Repeat, Info } from 'lucide-react';
import MetronomeControls from './metronome-controls';
import VisualPacer from './visual-pacer';
import { getCompressionFeedback } from '@/ai/flows/compression-feedback';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const TARGET_MIN_CPM = 100;
const TARGET_MAX_CPM = 120;
const METRONOME_BPM = 100;
const CPM_CALCULATION_WINDOW_SECONDS = 10; // Calculate CPM over the last 10 seconds
const AI_FEEDBACK_DEBOUNCE_MS = 1500; // Call AI at most every 1.5 seconds

const CPRSimulator: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [compressionTimestamps, setCompressionTimestamps] = useState<number[]>([]);
  const [currentCPM, setCurrentCPM] = useState(0);
  const [aiFeedback, setAiFeedback] = useState<string>("Start compressions to get feedback.");
  const [isLoadingAiFeedback, setIsLoadingAiFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'neutral' | 'good' | 'warning'>('neutral');

  const aiFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const calculateCPM = useCallback(() => {
    const now = Date.now();
    const windowStartTime = now - CPM_CALCULATION_WINDOW_SECONDS * 1000;
    
    const recentCompressions = compressionTimestamps.filter(ts => ts > windowStartTime);
    
    if (recentCompressions.length === 0) {
      setCurrentCPM(0);
      return 0;
    }
    
    // More robust calculation for varying numbers of compressions
    const durationSeconds = (now - recentCompressions[0]) / 1000;
    if (durationSeconds < 1) { // Avoid division by zero or too short intervals
        setCurrentCPM(0); // Or based on a single click if desired
        return 0;
    }

    const cpm = Math.round((recentCompressions.length / (CPM_CALCULATION_WINDOW_SECONDS)) * 60);
    setCurrentCPM(cpm);
    return cpm;
  }, [compressionTimestamps]);

  const fetchAiFeedback = useCallback(async (cpm: number) => {
    if (cpm === 0 && compressionTimestamps.length > 0) { // if cpm is 0 but there were recent presses, it might be too slow
        // this case is handled by the cpm logic itself, let's pass 0 if it's truly 0.
    } else if (cpm === 0 && compressionTimestamps.length === 0) {
        setAiFeedback("Start compressions to get feedback.");
        setFeedbackType('neutral');
        return;
    }


    setIsLoadingAiFeedback(true);
    try {
      const result = await getCompressionFeedback({ compressionRate: cpm });
      setAiFeedback(result.feedback);
      if (result.feedback.toLowerCase().includes("good")) {
        setFeedbackType('good');
      } else if (result.feedback.toLowerCase().includes("faster") || result.feedback.toLowerCase().includes("slower")) {
        setFeedbackType('warning');
      } else {
        setFeedbackType('neutral');
      }
    } catch (error) {
      console.error("Error fetching AI feedback:", error);
      setAiFeedback("Error fetching feedback. Please try again.");
      setFeedbackType('warning');
      toast({
        title: "AI Feedback Error",
        description: "Could not retrieve feedback from the AI.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAiFeedback(false);
    }
  }, [toast, compressionTimestamps.length]); // Add compressionTimestamps.length to re-evaluate initial message

  useEffect(() => {
    if (!isSessionActive) {
        setCurrentCPM(0);
        setAiFeedback("Start a session and begin compressions.");
        setFeedbackType('neutral');
        return;
    }

    const cpm = calculateCPM();

    if (aiFeedbackTimeoutRef.current) {
      clearTimeout(aiFeedbackTimeoutRef.current);
    }

    // Only fetch feedback if there are compressions or if it's the start of a session with 0 cpm
    if (compressionTimestamps.length > 0 || cpm === 0 ) {
        aiFeedbackTimeoutRef.current = setTimeout(() => {
            fetchAiFeedback(cpm);
        }, AI_FEEDBACK_DEBOUNCE_MS);
    } else {
        setAiFeedback("Start compressions to get feedback.");
        setFeedbackType('neutral');
    }
    
    return () => {
      if (aiFeedbackTimeoutRef.current) {
        clearTimeout(aiFeedbackTimeoutRef.current);
      }
    };
  }, [compressionTimestamps, isSessionActive, calculateCPM, fetchAiFeedback]);

  const handleCompression = () => {
    if (!isSessionActive) return;
    
    const now = Date.now();
    // Keep timestamps within the calculation window + a small buffer
    const windowStartTime = now - (CPM_CALCULATION_WINDOW_SECONDS + 2) * 1000; 
    
    setCompressionTimestamps(prev => [...prev.filter(ts => ts > windowStartTime), now]);
    // CPM calculation and AI feedback will be triggered by useEffect watching compressionTimestamps
  };

  const toggleSession = () => {
    setIsSessionActive(prev => {
      const newSessionState = !prev;
      if (newSessionState) {
        setCompressionTimestamps([]);
        setCurrentCPM(0);
        setAiFeedback("Start compressions to get feedback.");
        setFeedbackType('neutral');
        toast({ title: "Session Started", description: `Metronome at ${METRONOME_BPM} BPM.` });
      } else {
        toast({ title: "Session Ended" });
        if (aiFeedbackTimeoutRef.current) {
          clearTimeout(aiFeedbackTimeoutRef.current);
        }
        // Keep currentCPM and aiFeedback as is or reset:
        // setCurrentCPM(0); 
        // setAiFeedback("Session ended.");
        // setFeedbackType('neutral');
      }
      return newSessionState;
    });
  };
  
  const getFeedbackIcon = () => {
    if (isLoadingAiFeedback) return <Zap className="h-6 w-6 animate-pulse text-muted-foreground" />;
    switch (feedbackType) {
      case 'good': return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'warning': return <AlertCircle className="h-6 w-6 text-accent" />;
      default: return <Info className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <Card className="w-full max-w-lg shadow-2xl rounded-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">CPR Rhythm Training</CardTitle>
        <CardDescription>Maintain a steady compression rate of {TARGET_MIN_CPM}-{TARGET_MAX_CPM} CPM.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-8 p-6">
        <div className="flex flex-col items-center space-y-4">
          <Button 
            onClick={toggleSession} 
            size="lg" 
            className={cn(
              "w-full text-lg font-semibold transition-all duration-300",
              isSessionActive ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
            )}
          >
            {isSessionActive ? 'Stop Session' : 'Start Session'}
          </Button>
          <MetronomeControls bpm={METRONOME_BPM} isPlaying={isSessionActive} onTogglePlay={toggleSession} />
        </div>

        <Button
          onClick={handleCompression}
          disabled={!isSessionActive}
          className="w-full h-48 text-2xl font-bold rounded-lg shadow-lg bg-primary/10 text-primary border-2 border-primary hover:bg-primary/20 active:bg-primary/30 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center justify-center"
          aria-label="Simulate Chest Compression"
        >
          <Repeat className="h-12 w-12 mb-2"/>
          Press for Compression
        </Button>

        <VisualPacer 
          currentRate={currentCPM} 
          targetMinRate={TARGET_MIN_CPM} 
          targetMaxRate={TARGET_MAX_CPM} 
        />

        <Card className={cn("transition-all duration-300", 
            feedbackType === 'good' ? 'border-green-500 bg-green-500/10' : 
            feedbackType === 'warning' ? 'border-accent bg-accent/10' :
            'border-primary bg-primary/10'
        )}>
          <CardHeader className="flex flex-row items-center space-x-3 p-4">
            {getFeedbackIcon()}
            <CardTitle className={cn("text-xl",
                feedbackType === 'good' ? 'text-green-700' : 
                feedbackType === 'warning' ? 'text-accent-foreground' : // Assuming accent-foreground defined in theme
                'text-primary'
            )}>AI Coach</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className={cn("text-lg text-center font-medium min-h-[2.5em]", 
                feedbackType === 'good' ? 'text-green-600' : 
                feedbackType === 'warning' ? 'text-accent-foreground' :
                'text-foreground'
            )}>
              {isLoadingAiFeedback && compressionTimestamps.length > 0 ? "Analyzing..." : aiFeedback}
            </p>
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter className="text-center p-4">
        <p className="text-xs text-muted-foreground">
          This is a simulator for CPR compression rate practice. It does not measure compression depth.
          Always follow official CPR guidelines. Not for use in real emergencies.
        </p>
      </CardFooter>
    </Card>
  );
};

export default CPRSimulator;
