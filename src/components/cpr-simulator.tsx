
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle, Zap, Info, Music2, SmartphoneNfc } from 'lucide-react';
import MetronomeControls from './metronome-controls';
import VisualPacer from './visual-pacer';
import { getCompressionFeedback } from '@/ai/flows/compression-feedback';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

const TARGET_MIN_CPM = 100;
const TARGET_MAX_CPM = 120;
const MIN_BPM = 60;
const MAX_BPM = 150;
const DEFAULT_BPM = 100;
const CPM_CALCULATION_WINDOW_SECONDS = 10;
const AI_FEEDBACK_DEBOUNCE_MS = 1500;
const MOTION_EVENT_DEBOUNCE_MS = 250; // Min time between motion-detected compressions (limits to 240 CPM max theoretical from motion)
const ACCELERATION_THRESHOLD = 18; // m/s^2 - Gravity is ~9.8. This threshold tries to catch sharp movements.

const CPRSimulator: React.FC = () => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [compressionTimestamps, setCompressionTimestamps] = useState<number[]>([]);
  const [currentCPM, setCurrentCPM] = useState(0);
  const [aiFeedback, setAiFeedback] = useState<string>("Start a session to get feedback.");
  const [isLoadingAiFeedback, setIsLoadingAiFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'neutral' | 'good' | 'warning'>('neutral');
  const [metronomeBpm, setMetronomeBpm] = useState<number>(DEFAULT_BPM);
  const [motionStatus, setMotionStatus] = useState<string>("Motion detection inactive.");

  const aiFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastMotionCompressionTimeRef = useRef<number>(0);
  const { toast } = useToast();

  const handleCompression = useCallback(() => {
    // This function is now primarily called by motion detection
    if (!isSessionActive) return;
    
    const now = Date.now();
    // Keep a rolling window of timestamps for CPM calculation
    const windowStartTime = now - (CPM_CALCULATION_WINDOW_SECONDS + 5) * 1000; // Keep a bit more for robustness
    
    setCompressionTimestamps(prev => [...prev.filter(ts => ts > windowStartTime), now]);
  }, [isSessionActive]);

  const calculateCPM = useCallback(() => {
    const now = Date.now();
    const windowStartTime = now - CPM_CALCULATION_WINDOW_SECONDS * 1000;
    
    const recentCompressions = compressionTimestamps.filter(ts => ts > windowStartTime);
    
    if (recentCompressions.length < 2) { // Need at least 2 compressions to calculate a rate over a window
      setCurrentCPM(0);
      return 0;
    }
    
    // Calculate CPM based on the number of compressions in the defined window
    const cpm = Math.round((recentCompressions.length / CPM_CALCULATION_WINDOW_SECONDS) * 60);
    setCurrentCPM(cpm);
    return cpm;
  }, [compressionTimestamps]);

  const fetchAiFeedback = useCallback(async (cpm: number) => {
    if (!isSessionActive) {
        setAiFeedback("Start a session to get feedback.");
        setFeedbackType('neutral');
        return;
    }
    if (cpm === 0 && compressionTimestamps.length < 2) { // Require at least 2 compressions to start feedback
        setAiFeedback("Awaiting sufficient compressions...");
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
      setAiFeedback("Error fetching feedback.");
      setFeedbackType('warning');
      toast({
        title: "AI Feedback Error",
        description: "Could not retrieve feedback from the AI.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingAiFeedback(false);
    }
  }, [toast, isSessionActive, compressionTimestamps.length]);

  useEffect(() => {
    if (!isSessionActive) {
        setCurrentCPM(0);
        setAiFeedback("Start a session and activate metronome.");
        setFeedbackType('neutral');
        setMotionStatus("Motion detection inactive.");
        if (aiFeedbackTimeoutRef.current) {
          clearTimeout(aiFeedbackTimeoutRef.current);
        }
        return;
    }

    // Calculate CPM
    const cpm = calculateCPM();

    // Debounce AI feedback
    if (aiFeedbackTimeoutRef.current) {
      clearTimeout(aiFeedbackTimeoutRef.current);
    }
    if (compressionTimestamps.length > 0) { // Only fetch AI feedback if there are compressions
        aiFeedbackTimeoutRef.current = setTimeout(() => {
            fetchAiFeedback(cpm);
        }, AI_FEEDBACK_DEBOUNCE_MS);
    } else {
        setAiFeedback("Awaiting compressions...");
        setFeedbackType('neutral');
    }
    
    return () => {
      if (aiFeedbackTimeoutRef.current) {
        clearTimeout(aiFeedbackTimeoutRef.current);
      }
    };
  }, [compressionTimestamps, isSessionActive, calculateCPM, fetchAiFeedback]);


  // Motion detection effect
  useEffect(() => {
    if (!isSessionActive) {
      setMotionStatus("Motion detection inactive.");
      return;
    }

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();
      if (now - lastMotionCompressionTimeRef.current < MOTION_EVENT_DEBOUNCE_MS) {
        return; // Debounce
      }

      const acceleration = event.accelerationIncludingGravity;
      if (acceleration && acceleration.y) {
        // Simple detection: significant change in Y-axis acceleration
        // This assumes the phone is relatively flat, screen up, moving up/down.
        // This is a VERY basic heuristic and may need significant tuning.
        if (Math.abs(acceleration.y) > ACCELERATION_THRESHOLD) {
          handleCompression();
          lastMotionCompressionTimeRef.current = now;
        }
      }
    };

    if (typeof window.DeviceMotionEvent !== 'undefined') {
      // @ts-ignore Non-standard permission API for iOS 13+
      if (typeof DeviceMotionEvent.requestPermission === 'function') {
        // @ts-ignore
        DeviceMotionEvent.requestPermission()
          .then((permissionState: string) => {
            if (permissionState === 'granted') {
              window.addEventListener('devicemotion', handleDeviceMotion);
              setMotionStatus("Motion detection active.");
            } else {
              setMotionStatus("Permission for motion detection denied.");
              toast({ title: "Motion Permission Denied", description: "Please enable motion sensor access in your browser settings.", variant: "destructive" });
            }
          })
          .catch((error: any) => {
             console.error("Error requesting motion permission:", error);
             setMotionStatus("Error requesting motion permission.");
             toast({ title: "Motion Permission Error", description: "Could not request motion sensor access.", variant: "destructive" });
          });
      } else {
        // For browsers that don't require explicit permission (e.g., Android Chrome)
        window.addEventListener('devicemotion', handleDeviceMotion);
        setMotionStatus("Motion detection active (standard).");
      }
    } else {
      setMotionStatus("Motion detection not supported on this device/browser.");
      toast({ title: "Motion Not Supported", description: "Your device or browser does not support motion detection.", variant: "destructive" });
    }

    return () => {
      window.removeEventListener('devicemotion', handleDeviceMotion);
      setMotionStatus("Motion detection inactive.");
    };
  }, [isSessionActive, handleCompression, toast]);


  const toggleSession = () => {
    setIsSessionActive(prev => {
      const newSessionState = !prev;
      if (newSessionState) {
        setCompressionTimestamps([]);
        setCurrentCPM(0);
        setAiFeedback("Awaiting compressions...");
        setFeedbackType('neutral');
        lastMotionCompressionTimeRef.current = 0; // Reset debounce timer for motion
        toast({ title: "Session Started", description: `Metronome at ${metronomeBpm} BPM.` });
      } else {
        toast({ title: "Session Ended" });
        if (aiFeedbackTimeoutRef.current) {
          clearTimeout(aiFeedbackTimeoutRef.current);
        }
      }
      return newSessionState;
    });
  };
  
  const getFeedbackIcon = () => {
    if (isLoadingAiFeedback && isSessionActive) return <Zap className="h-6 w-6 animate-pulse text-muted-foreground" />;
    switch (feedbackType) {
      case 'good': return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'warning': return <AlertCircle className="h-6 w-6 text-accent" />;
      default: return <Info className="h-6 w-6 text-primary" />;
    }
  };

  const handleBpmChange = (value: number[]) => {
    setMetronomeBpm(value[0]);
  };

  return (
    <Card className="w-full max-w-lg shadow-2xl rounded-xl">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">CPR Rhythm Training</CardTitle>
        <CardDescription>Maintain a steady compression rate of {TARGET_MIN_CPM}-{TARGET_MAX_CPM} CPM. Compressions will be detected via phone movement.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 p-6">
        <div className="flex flex-col items-center space-y-4">
          <Button 
            onClick={toggleSession} 
            size="lg" 
            className={cn(
              "w-full text-lg font-semibold transition-all duration-300",
              isSessionActive ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
            )}
          >
            {isSessionActive ? 'Stop Session' : 'Start Session & Metronome'}
          </Button>
          <MetronomeControls bpm={metronomeBpm} isPlaying={isSessionActive} onTogglePlay={toggleSession} />
        </div>

        <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex justify-between items-center">
                <Label htmlFor="bpm-slider" className="flex items-center text-muted-foreground">
                    <Music2 className="h-5 w-5 mr-2 text-primary"/> Metronome Speed:
                </Label>
                <span className="font-semibold text-primary">{metronomeBpm} BPM</span>
            </div>
            <Slider
                id="bpm-slider"
                min={MIN_BPM}
                max={MAX_BPM}
                step={1}
                value={[metronomeBpm]}
                onValueChange={handleBpmChange}
                disabled={isSessionActive}
                className={cn(isSessionActive && "opacity-50 cursor-not-allowed")}
            />
        </div>
        
        <div className={cn(
            "text-center p-3 my-2 border border-dashed rounded-lg",
            motionStatus.includes("active") ? "border-green-500/50 bg-green-500/5" :
            motionStatus.includes("Error") || motionStatus.includes("denied") || motionStatus.includes("not supported") ? "border-destructive/50 bg-destructive/5" :
            "border-primary/50 bg-primary/5"
          )}>
            <p className={cn(
                "text-sm flex items-center justify-center",
                 motionStatus.includes("active") ? "text-green-700" :
                 motionStatus.includes("Error") || motionStatus.includes("denied") || motionStatus.includes("not supported") ? "text-destructive-foreground" :
                 "text-primary"
            )}>
                <SmartphoneNfc className="h-4 w-4 mr-2"/> {motionStatus}
            </p>
            {isSessionActive && !motionStatus.includes("active") && (
                <p className="text-xs text-muted-foreground mt-1">If prompted, please allow motion sensor access.</p>
            )}
             {isSessionActive && motionStatus.includes("active") && (
                <p className="text-xs text-muted-foreground mt-1">Try to keep phone relatively flat on chest for best results (Y-axis detection).</p>
            )}
        </div>
        
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
                feedbackType === 'warning' ? 'text-accent-foreground' : 
                'text-primary'
            )}>AI Coach</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className={cn("text-lg text-center font-medium min-h-[2.5em]", 
                feedbackType === 'good' ? 'text-green-600' : 
                feedbackType === 'warning' ? 'text-accent-foreground' :
                'text-foreground'
            )}>
              {isLoadingAiFeedback && isSessionActive && compressionTimestamps.length > 0 ? "Analyzing..." : aiFeedback}
            </p>
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter className="text-center p-4">
        <p className="text-xs text-muted-foreground">
          This is a simulator for CPR compression rate practice. Motion-based compression detection is experimental.
          Always follow official CPR guidelines. Not for use in real emergencies.
        </p>
      </CardFooter>
    </Card>
  );
};

export default CPRSimulator;

    