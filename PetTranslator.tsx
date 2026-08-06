'use client';

import React, { useState, useRef, useEffect } from 'react';

type PetType = 'dog' | 'cat';

export default function PetTranslator() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [petType, setPetType] = useState<PetType>('dog');
  const [status, setStatus] = useState('Idle');

  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioBuffersRef = useRef<Record<PetType, AudioBuffer | null>>({ dog: null, cat: null });
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // 1. Initialize AudioContext on user client side
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtxRef.current = new AudioContextClass();
    }

    // 2. Load and decode audio buffers (or create synthetic fallback buffers)
    preloadAudioBuffers();

    // 3. Initialize Web Speech API
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setStatus('Listening to human speech...');
      };

      recognition.onresult = (event: any) => {
        const spokenText = event.results[0][0].transcript;
        setTranscript(spokenText);
        setStatus(`Captured: "${spokenText}"`);
        playPetTranslation(spokenText);
      };

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setStatus(`Error: ${event.error}`);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.ref = recognition;
      recognitionRef.current = recognition;
    } else {
      setStatus('Web Speech API is not supported in this browser.');
    }
  }, []);

  // Preloads real audio or generates synthetic fallback sound buffers
  const preloadAudioBuffers = async () => {
    if (!audioCtxRef.current) return;

    const sampleUrls: Record<PetType, string> = {
      dog: 'https://actions.google.com/sounds/v1/animals/dog_barking.ogg',
      cat: 'https://actions.google.com/sounds/v1/animals/cat_meow.ogg',
    };

    for (const type of ['dog', 'cat'] as PetType[]) {
      try {
        const response = await fetch(sampleUrls[type]);
        const arrayBuffer = await response.arrayBuffer();
        const decodedData = await audioCtxRef.current.decodeAudioData(arrayBuffer);
        audioBuffersRef.current[type] = decodedData;
      } catch (err) {
        console.warn(`Could not load real audio for ${type}. Generating synthetic buffer as fallback.`, err);
        audioBuffersRef.current[type] = createSyntheticPetBuffer(audioCtxRef.current, type);
      }
    }
  };

  // Helper to trigger voice recording
  const handleToggleListen = () => {
    if (!recognitionRef.current) return;

    // Resume AudioContext if suspended by browser autoplay policy
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }

    if (isListening) {
      recognitionRef.current.stop();
    } else {
      setTranscript('');
      recognitionRef.current.start();
    }
  };

  // Calculates pitch shift based on sentence length and plays buffer
  const playPetTranslation = (text: string) => {
    const ctx = audioCtxRef.current;
    const buffer = audioBuffersRef.current[petType];
    if (!ctx || !buffer) return;

    // 1. Calculate pitch shift based on sentence length
    // Short sentences = Higher pitch (excited bark/meow)
    // Long sentences = Lower pitch (deeper/authoritative bark/meow)
    const wordCount = text.trim().split(/\s+/).length;
    
    // Map word count (1 to 20 words) to semitone shift range (-6 to +8 semitones)
    const semitones = Math.max(-6, Math.min(8, 8 - (wordCount - 1) * 0.75));

    // 2. Web Audio Source Setup
    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // 3. Apply pitch shift using detune (in cents: 100 cents = 1 semitone)
    // Or playbackRate multiplier: source.playbackRate.value = Math.pow(2, semitones / 12);
    source.detune.value = semitones * 100;

    source.connect(ctx.destination);
    source.start(0);

    setStatus(`Translated! (Word count: ${wordCount} → Pitch Shift: ${semitones.toFixed(1)} semitones)`);
  };

  // Fallback sound generator using AudioBuffer
  const createSyntheticPetBuffer = (ctx: AudioContext, type: PetType): AudioBuffer => {
    const duration = type === 'dog' ? 0.3 : 0.6;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < channel.length; i++) {
      const t = i / sampleRate;
      if (type === 'dog') {
        channel[i] = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-15 * t);
      } else {
        channel[i] = Math.sin(2 * Math.PI * 440 * t + Math.sin(2 * Math.PI * 8 * t) * 5) * (1 - t / duration);
      }
    }
    return buffer;
  };

  return (
    <div style={{ maxWidth: '420px', margin: '2rem auto', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: '12px', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h2>🐾 Human to Pet Voice Translator</h2>
      
      <div style={{ marginBottom: '1rem' }}>
        <label style={{ marginRight: '1rem' }}>
          <input
            type="radio"
            value="dog"
            checked={petType === 'dog'}
            onChange={() => setPetType('dog')}
          /> Dog 🐶
        </label>
        <label>
          <input
            type="radio"
            value="cat"
            checked={petType === 'cat'}
            onChange={() => setPetType('cat')}
          /> Cat 🐱
        </label>
      </div>

      <button
        onClick={handleToggleListen}
        style={{
          padding: '0.75rem 1.5rem',
          borderRadius: '24px',
          border: 'none',
          backgroundColor: isListening ? '#ef4444' : '#3b82f6',
          color: '#ffffff',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}
      >
        {isListening ? '🛑 Stop Listening' : '🎤 Speak to Translate'}
      </button>

      <p style={{ marginTop: '1rem', fontStyle: 'italic', color: '#4b5563' }}>
        {status}
      </p>

      {transcript && (
        <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
          <strong>Captured English:</strong> "{transcript}"
        </div>
      )}
    </div>
  );
}
