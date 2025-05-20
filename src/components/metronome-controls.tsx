
"use client";

import type { FC } from 'react';
import React, { useState, useEffect, useRef } from 'react';
import * as Tone from 'tone';
import { Button } from '@/components/ui/button';
import { Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface MetronomeControlsProps {
  bpm: number;
  isPlaying: boolean;
  onTogglePlay: () => void;
}

const MetronomeControls: FC<MetronomeControlsProps> = ({ bpm, isPlaying, onTogglePlay }) => {
  const synthRef = useRef<Tone.Synth | null>(null);
  const loopRef = useRef<Tone.Loop | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false); // Tracks if Tone.start() has been called

  useEffect(() => {
    // Initialize synth on component mount
    synthRef.current = new Tone.Synth({
      oscillator: {
        type: 'triangle',
      },
      envelope: {
        attack: 0.005,
        decay: 0.05,
        sustain: 0,
        release: 0.1,
      },
    }).toDestination();
    
    return () => {
      // Cleanup on component unmount
      loopRef.current?.dispose();
      synthRef.current?.dispose();
      // If Transport was started, pause it. Avoid broad stop/cancel for global Tone.Transport.
      if (Tone.Transport.state === "started") {
        Tone.Transport.pause();
      }
    };
  }, []);

  // Effect to manage BPM, loop, and transport state
  useEffect(() => {
    if (!synthRef.current || !isAudioReady) {
      // Don't proceed with Tone.js operations if synth isn't ready or audio context hasn't started
      return;
    }

    Tone.Transport.bpm.value = bpm;

    // Re-create loop if it doesn't exist or if BPM might have changed its fundamental timing
    // (though for '4n' this is less critical than if interval was directly derived from bpm)
    if (loopRef.current) {
      loopRef.current.dispose();
    }
    loopRef.current = new Tone.Loop((time) => {
      synthRef.current?.triggerAttackRelease('C5', '16n', time); 
    }, '4n').start(0); // .start(0) schedules it to start with Tone.Transport

    if (isPlaying) {
      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }
    } else {
      if (Tone.Transport.state === 'started') {
        Tone.Transport.pause();
      }
    }
  }, [bpm, isPlaying, isAudioReady]); // Re-run if these critical states change

  // Effect to attempt starting AudioContext when parent signals to play (isPlaying becomes true)
  useEffect(() => {
    const attemptAudioStartOnPlay = async () => {
      if (isPlaying && !isAudioReady && typeof window !== 'undefined') {
        try {
          await Tone.start();
          setIsAudioReady(true);
          console.log("Audio Context started: Media playback allowed.");
        } catch (error) {
          console.error("Error starting Audio Context on play: ", error);
          // Optionally, inform user via toast that interaction with metronome button might be needed
        }
      }
    };
    attemptAudioStartOnPlay();
  }, [isPlaying, isAudioReady]); // Run when isPlaying or isAudioReady changes

  // Handle Mute
  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.volume.value = isMuted ? -Infinity : 0;
    }
  }, [isMuted]);

  // Handler for this component's own Play/Pause button
  const handleTogglePlayInternal = async () => {
    if (!isAudioReady && typeof window !== 'undefined') {
      try {
        await Tone.start();
        setIsAudioReady(true);
        console.log("Audio Context started by metronome button interaction.");
      } catch (e) {
        console.error("Error starting Audio Context via button:", e);
        // If Tone.start() fails, we might not want to call onTogglePlay,
        // or we could call it and hope the main effect handles it.
        // For now, we'll still call onTogglePlay.
      }
    }
    onTogglePlay(); // Propagate to parent (CPRSimulator to toggle session)
  };
  
  const handleToggleMute = () => {
    setIsMuted(prev => !prev);
  };

  return (
    <div className="flex items-center justify-center space-x-2">
      <Button onClick={handleTogglePlayInternal} variant="outline" size="icon" aria-label={isPlaying ? "Pause Metronome" : "Play Metronome"}>
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </Button>
      <Button onClick={handleToggleMute} variant="outline" size="icon" aria-label={isMuted ? "Unmute Metronome" : "Mute Metronome"}>
        {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </Button>
    </div>
  );
};

export default MetronomeControls;
