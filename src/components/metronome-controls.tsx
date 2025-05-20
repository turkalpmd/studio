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
  const synthRef = useRef<Tone.MembraneSynth | null>(null);
  const loopRef = useRef<Tone.Loop | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);


  useEffect(() => {
    // Initialize synth on component mount
    synthRef.current = new Tone.MembraneSynth({
      pitchDecay: 0.01,
      octaves: 6,
      envelope: {
        attack: 0.001,
        decay: 0.2,
        sustain: 0.01,
        release: 0.1,
        attackCurve: "exponential",
      },
    }).toDestination();
    
    return () => {
      // Cleanup on component unmount
      loopRef.current?.dispose();
      synthRef.current?.dispose();
      Tone.Transport.stop();
      Tone.Transport.cancel();
    };
  }, []);

  useEffect(() => {
    if (!synthRef.current) return;

    Tone.Transport.bpm.value = bpm;

    if (loopRef.current) {
      loopRef.current.dispose(); // Dispose old loop if bpm changes
    }

    loopRef.current = new Tone.Loop((time) => {
      synthRef.current?.triggerAttackRelease('C2', '8n', time);
    }, '4n').start(0);

    if (isPlaying && isAudioReady) {
      Tone.Transport.start();
    } else {
      Tone.Transport.pause(); // Use pause instead of stop to maintain position
    }
  }, [bpm, isAudioReady]); // Re-create loop if bpm changes or audio becomes ready

  useEffect(() => {
     if (!isAudioReady) return;

    if (isPlaying) {
        Tone.Transport.start();
    } else {
        Tone.Transport.pause();
    }
  }, [isPlaying, isAudioReady]);


  useEffect(() => {
    if (synthRef.current) {
      synthRef.current.volume.value = isMuted ? -Infinity : 0;
    }
  }, [isMuted]);

  const handleTogglePlayInternal = async () => {
    if (!isAudioReady) {
      await Tone.start();
      setIsAudioReady(true);
      console.log("Audio Context started by user interaction.");
    }
    onTogglePlay();
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
