
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Music2, SmartphoneNfc } from 'lucide-react';
import MetronomeControls from './metronome-controls';
import VisualPacer from './visual-pacer';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';

const MIN_BPM = 60;
const MAX_BPM = 150;
const DEFAULT_BPM = 100;
const CPM_CALCULATION_WINDOW_SECONDS = 10;
const MOTION_EVENT_DEBOUNCE_MS = 250;
const ACCELERATION_THRESHOLD = 12; // Lowered threshold for better sensitivity

interface CPRSimulatorProps {
  onPerformanceChange: (bgClass: string) => void;
}

const CPRSimulator: React.FC<CPRSimulatorProps> = ({ onPerformanceChange }) => {
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [compressionTimestamps, setCompressionTimestamps] = useState<number[]>([]);
  const [currentCPM, setCurrentCPM] = useState(0);
  const [metronomeBpm, setMetronomeBpm] = useState<number>(DEFAULT_BPM);
  const [motionStatus, setMotionStatus] = useState<string>("Motion detection inactive.");

  const lastMotionCompressionTimeRef = useRef<number>(0);
  const { toast } = useToast();

  const defaultBackground = "bg-gradient-to-br from-background to-secondary/30";
  const goodBackground = "bg-green-300/50 dark:bg-green-700/40";
  const warnBackground = "bg-yellow-300/50 dark:bg-yellow-600/40";
  const badBackground = "bg-red-400/50 dark:bg-red-800/40";


  const handleCompression = useCallback(() => {
    if (!isSessionActive) return;
    
    const now = Date.now();
    // Keep timestamps for a bit longer than the calculation window to ensure smooth averaging
    const retentionWindowStartTime = now - (CPM_CALCULATION_WINDOW_SECONDS + 5) * 1000; 
    
    setCompressionTimestamps(prev => [...prev.filter(ts => ts > retentionWindowStartTime), now]);
  }, [isSessionActive]);

  const calculateCPM = useCallback(() => {
    const now = Date.now();
    const windowStartTime = now - CPM_CALCULATION_WINDOW_SECONDS * 1000;
    
    const recentCompressions = compressionTimestamps.filter(ts => ts > windowStartTime);
    
    if (recentCompressions.length < 1) {
      setCurrentCPM(0);
      return 0;
    }
    
    // Calculate CPM: (compressions / window_seconds) * 60
    const cpm = Math.round((recentCompressions.length / CPM_CALCULATION_WINDOW_SECONDS) * 60);
    setCurrentCPM(cpm);
    return cpm;
  }, [compressionTimestamps]); // Depends on compressionTimestamps to use the latest

  useEffect(() => {
    if (!isSessionActive) {
      setCurrentCPM(0);
      onPerformanceChange(defaultBackground);
      return;
    }
    
    // Interval to calculate CPM every second
    const cpmCalculationInterval = setInterval(calculateCPM, 1000); 
    
    return () => clearInterval(cpmCalculationInterval);
    
  }, [isSessionActive, calculateCPM, onPerformanceChange, defaultBackground]); // calculateCPM is stable if its own dependencies are stable or if it's memoized correctly


  useEffect(() => {
    // If session is not active OR if CPM is 0 AND there are no compressions at all, reset background
    if (!isSessionActive || (currentCPM === 0 && compressionTimestamps.length === 0)) {
      onPerformanceChange(defaultBackground);
      return;
    }

    const lowerIdealBound = metronomeBpm * 0.9; // 90% of metronome BPM
    const upperIdealBound = metronomeBpm * 1.1; // 110% of metronome BPM
    const lowerWarnBound = metronomeBpm * 0.8;  // 80% of metronome BPM (lower warning threshold)
    const upperWarnBound = metronomeBpm * 1.2;  // 120% of metronome BPM (upper warning threshold)

    let bgClass = defaultBackground;

    if (currentCPM > 0) { // Only color background if there are active compressions
        if (currentCPM >= lowerIdealBound && currentCPM <= upperIdealBound) {
            bgClass = goodBackground;
        } else if ((currentCPM >= lowerWarnBound && currentCPM < lowerIdealBound) || (currentCPM > upperIdealBound && currentCPM <= upperWarnBound)) {
            // Between 80-90% or 110-120%
            bgClass = warnBackground;
        } else {
            // Below 80% or above 120%
            bgClass = badBackground;
        }
    }
    onPerformanceChange(bgClass);

  }, [currentCPM, metronomeBpm, isSessionActive, onPerformanceChange, defaultBackground, goodBackground, warnBackground, badBackground, compressionTimestamps.length]);


  // Motion detection effect
  useEffect(() => {
    if (!isSessionActive) {
      setMotionStatus("Motion detection inactive.");
      return () => {
        // Ensure cleanup of any listeners if the component unmounts or session stops
      };
    }

    const handleDeviceMotion = (event: DeviceMotionEvent) => {
      const now = Date.now();
      if (now - lastMotionCompressionTimeRef.current < MOTION_EVENT_DEBOUNCE_MS) {
        return; // Debounce: ignore events too close to the last registered compression
      }

      const acceleration = event.accelerationIncludingGravity;
      if (acceleration && acceleration.y) {
        // Check for significant change in Y-axis acceleration
        if (Math.abs(acceleration.y) > ACCELERATION_THRESHOLD) {
          handleCompression();
          lastMotionCompressionTimeRef.current = now;
        }
      }
    };

    let motionListenerAttached = false;

    if (typeof window.DeviceMotionEvent !== 'undefined') {
      // For iOS 13+
      if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
        (DeviceMotionEvent as any).requestPermission()
          .then((permissionState: string) => {
            if (permissionState === 'granted') {
              window.addEventListener('devicemotion', handleDeviceMotion);
              motionListenerAttached = true;
              setMotionStatus("Motion detection active.");
            } else {
              setMotionStatus("Permission for motion detection denied.");
              setTimeout(() => { // Defer toast to avoid render-in-render warning
                toast({ title: "Motion Permission Denied", description: "Please enable motion sensor access in your browser settings for automatic compression detection.", variant: "destructive" });
              }, 0);
            }
          })
          .catch((error: any) => {
             console.error("Error requesting motion permission:", error);
             setMotionStatus("Error requesting motion permission.");
             setTimeout(() => { // Defer toast
                toast({ title: "Motion Permission Error", description: "Could not request motion sensor access. Automatic compression detection may not work.", variant: "destructive" });
             }, 0);
          });
      } else {
        // For other browsers or older iOS
        window.addEventListener('devicemotion', handleDeviceMotion);
        motionListenerAttached = true;
        setMotionStatus("Motion detection active (standard).");
      }
    } else {
      setMotionStatus("Motion detection not supported on this device/browser.");
      setTimeout(() => { // Defer toast
        toast({ title: "Motion Not Supported", description: "Your device or browser does not support motion detection for automatic compressions.", variant: "destructive" });
      }, 0);
    }

    return () => {
      if (motionListenerAttached) {
        window.removeEventListener('devicemotion', handleDeviceMotion);
      }
      // setMotionStatus("Motion detection inactive."); // Set status on cleanup if session stops
    };
  }, [isSessionActive, handleCompression]); // Removed toast from dependencies


  const toggleSession = () => {
    setIsSessionActive(prev => {
      const newSessionState = !prev;
      if (newSessionState) {
        // Resetting for a new session
        setCompressionTimestamps([]); 
        setCurrentCPM(0); 
        lastMotionCompressionTimeRef.current = 0; // Reset debounce timer
        onPerformanceChange(defaultBackground); // Reset background
        // Defer toast to avoid potential render-in-render warning
        setTimeout(() => {
          toast({ title: "Session Started", description: `Metronome at ${metronomeBpm} BPM. Try to match the rhythm.` });
        }, 0);
      } else {
        // Ending the session
        onPerformanceChange(defaultBackground); // Reset background
        setMotionStatus("Motion detection inactive."); // Explicitly set inactive on stop
        setTimeout(() => {
          toast({ title: "Session Ended" });
        }, 0);
      }
      return newSessionState;
    });
  };
  
  const handleBpmChange = (value: number[]) => {
    setMetronomeBpm(value[0]);
  };

  return (
    <Card className="w-full max-w-lg shadow-2xl rounded-xl bg-card/90 backdrop-blur-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-3xl font-bold">CPR Rhythm Training</CardTitle>
        <CardDescription>Adjust metronome. Match pace. Compressions detected by phone movement.</CardDescription>
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

        <div className="space-y-3 pt-4 border-t border-border/50">
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
            motionStatus.includes("active") ? "border-green-500/70 bg-green-500/10" :
            motionStatus.includes("Error") || motionStatus.includes("denied") || motionStatus.includes("not supported") ? "border-destructive/70 bg-destructive/10" :
            "border-primary/70 bg-primary/10" // Default for "inactive"
          )}>
            <p className={cn(
                "text-sm flex items-center justify-center",
                 motionStatus.includes("active") ? "text-green-700 dark:text-green-400" :
                 motionStatus.includes("Error") || motionStatus.includes("denied") || motionStatus.includes("not supported") ? "text-destructive dark:text-destructive-foreground" :
                 "text-primary" // Default for "inactive"
            )}>
                <SmartphoneNfc className="h-4 w-4 mr-2"/> {motionStatus}
            </p>
            {isSessionActive && !motionStatus.includes("active") && !motionStatus.includes("Error") && !motionStatus.includes("denied") && !motionStatus.includes("not supported") && (
                <p className="text-xs text-muted-foreground mt-1">If prompted, please allow motion sensor access. Motion detection may take a moment to initialize.</p>
            )}
             {isSessionActive && motionStatus.includes("active") && (
                <p className="text-xs text-muted-foreground mt-1">Place phone flat for best Y-axis detection.</p>
            )}
        </div>
        
        <VisualPacer 
          currentRate={currentCPM}
          metronomeBpm={metronomeBpm}
        />

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

