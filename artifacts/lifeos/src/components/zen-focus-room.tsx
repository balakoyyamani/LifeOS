import { useEffect, useState } from 'react';
import {
  Check,
  Coffee,
  Headphones,
  Maximize2,
  Minimize2,
  Minus,
  Moon,
  Pause,
  Play,
  Plus,
  Radio,
  RotateCcw,
  Sparkles,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import type { DailyGoal, GoalStatus } from '@workspace/api-client-react';
import { sound } from '@/lib/sound';
import { type SoundscapeType, soundscapes } from '@/lib/soundscapes';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import { ModalPortal } from '@/components/modal-portal';

interface ZenFocusRoomProps {
  goals: DailyGoal[];
  initialGoal?: DailyGoal;
  onClose: () => void;
  onLogProgress: (goal: DailyGoal, minutes: number) => void;
}

export function ZenFocusRoom({
  goals,
  initialGoal,
  onClose,
  onLogProgress,
}: ZenFocusRoomProps) {
  const [selectedGoalId, setSelectedGoalId] = useState<number>(
    initialGoal?.id || goals[0]?.id || 0,
  );
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [secondsRemaining, setSecondsRemaining] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  // Soundscape state
  const [activeSoundscape, setActiveSoundscape] = useState<SoundscapeType>('rain');
  const [volume, setVolume] = useState(soundscapes.getVolume());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const activeGoal = goals.find((g) => g.id === selectedGoalId) || goals[0];

  // Initialize soundscape on open
  useEffect(() => {
    soundscapes.play(activeSoundscape);
    return () => {
      soundscapes.stop();
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && secondsRemaining > 0) {
      interval = setInterval(() => {
        setSecondsRemaining((prev) => {
          if (prev <= 1) {
            setIsRunning(false);
            sound.playCelebration();
            return 0;
          }
          return prev - 1;
        });
        setElapsedMinutes((prev) => prev + 1 / 60);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, secondsRemaining]);

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const handleSelectSoundscape = (type: SoundscapeType) => {
    setActiveSoundscape(type);
    soundscapes.play(type);
  };

  const handleVolumeChange = (newVal: number) => {
    setVolume(newVal);
    soundscapes.setVolume(newVal);
  };

  const setPreset = (mins: number) => {
    setIsRunning(false);
    setDurationMinutes(mins);
    setSecondsRemaining(mins * 60);
    setElapsedMinutes(0);
    sound.playClick();
  };

  const handleFinishAndLog = () => {
    const logged = Math.max(1, Math.round(elapsedMinutes));
    if (activeGoal) {
      onLogProgress(activeGoal, logged);
      sound.playComplete();
    }
    onClose();
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        setIsRunning((prev) => !prev);
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = Math.min(
    100,
    Math.round(((durationMinutes * 60 - secondsRemaining) / (durationMinutes * 60)) * 100),
  );

  return (
    <ModalPortal>
      <div className="fixed inset-0 z-50 flex flex-col justify-between bg-[#0b101b] p-6 text-white backdrop-blur-xl sm:p-10 select-none">
      {/* Background ambient radial glow */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden opacity-30">
        <div
          className={cn(
            'size-[540px] rounded-full bg-primary/20 blur-[120px] transition-all duration-1000',
            isRunning && 'scale-125 opacity-70',
          )}
        />
      </div>

      {/* Top Header Bar */}
      <header className="relative z-10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-primary/20 text-primary">
            <Moon className="size-4" />
          </div>
          <div>
            <div className="mono-label text-[10px] text-white/50">ZEN FOCUS ROOM</div>
            {goals.length > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/70">Focusing on:</span>
                <select
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(Number(e.target.value))}
                  className="focus-ring rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white outline-none"
                >
                  {goals.map((g) => (
                    <option key={g.id} value={g.id} className="bg-sidebar text-white">
                      {g.name} ({g.targetValue} {g.unit})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-xs font-bold text-white/80">Deep Work Session</div>
            )}
          </div>
        </div>

        {/* Fullscreen & Close */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="focus-ring rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
            title="Toggle full screen (F)"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full border border-white/10 bg-white/5 p-2 text-white/70 hover:bg-white/10 hover:text-white"
            title="Exit Zen Room (Esc)"
          >
            <X className="size-4" />
          </button>
        </div>
      </header>

      {/* Main Breathing Clock Canvas */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center my-auto py-8">
        {/* Pulsing breathing ring */}
        <div className="relative mb-8 grid place-items-center">
          <div
            className={cn(
              'absolute size-72 rounded-full border border-primary/20 transition-all duration-1000',
              isRunning ? 'scale-110 opacity-70 animate-pulse' : 'scale-100 opacity-30',
            )}
          />
          <div
            className={cn(
              'absolute size-88 rounded-full border border-primary/10 transition-all duration-1000',
              isRunning ? 'scale-115 opacity-40' : 'scale-95 opacity-20',
            )}
          />

          {/* Time digits */}
          <div className="font-mono text-7xl font-black tracking-tight text-white sm:text-8xl md:text-9xl drop-shadow-md">
            {formatTime(secondsRemaining)}
          </div>
        </div>

        {/* Active commitment quote & progress info */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <p className="text-sm font-semibold text-white/60">
            {isRunning
              ? 'Stay with the breath. Single-tasking in motion.'
              : 'Press Space or Play to begin your uninterrupted flow.'}
          </p>
          {elapsedMinutes > 0 && (
            <div className="rounded-full bg-white/10 px-3 py-1 font-mono text-xs font-bold text-primary">
              {Math.max(1, Math.round(elapsedMinutes))} minutes logged this session
            </div>
          )}
        </div>

        {/* Play / Pause / Stepper Controls */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setPreset(durationMinutes)}
            className="focus-ring grid size-12 place-items-center rounded-full border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white"
            title="Reset timer"
          >
            <RotateCcw className="size-5" />
          </button>

          <button
            type="button"
            onClick={() => setIsRunning(!isRunning)}
            className="focus-ring flex h-16 items-center gap-3 rounded-full bg-primary px-9 font-mono text-lg font-black text-sidebar shadow-lg transition-transform hover:opacity-90 active:scale-95"
          >
            {isRunning ? <Pause className="size-6" /> : <Play className="size-6 fill-current" />}
            <span>{isRunning ? 'PAUSE' : 'START FOCUS'}</span>
          </button>

          <button
            type="button"
            onClick={handleFinishAndLog}
            className="focus-ring grid size-12 place-items-center rounded-full border border-primary/40 bg-primary/20 text-primary hover:bg-primary/30"
            title="Finish and log elapsed minutes"
          >
            <Check className="size-5" strokeWidth={3} />
          </button>
        </div>

        {/* Duration Preset Chips */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[15, 25, 45, 60, 90].map((mins) => (
            <button
              key={mins}
              type="button"
              onClick={() => setPreset(mins)}
              className={cn(
                'focus-ring rounded-full px-4 py-1.5 text-xs font-bold transition-all',
                durationMinutes === mins
                  ? 'bg-white text-sidebar font-extrabold shadow-sm'
                  : 'border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white',
              )}
            >
              {mins}m {mins === 25 ? '🍅' : ''}
            </button>
          ))}
        </div>
      </main>

      {/* Bottom Soundscape Dock */}
      <footer className="relative z-10 flex flex-col items-center justify-between gap-4 border-t border-white/10 pt-5 sm:flex-row">
        {/* Soundscape Type Picker */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs font-bold">
          <span className="mr-1 text-[11px] text-white/50">Ambient Audio:</span>
          {[
            { id: 'rain', label: '🌧️ Rain' },
            { id: 'noise', label: '📻 White Noise' },
            { id: 'cafe', label: '☕ Cafe Hum' },
            { id: 'binaural', label: '🧘 Binaural Alpha' },
            { id: 'none', label: '🔇 Silent' },
          ].map((sc) => (
            <button
              key={sc.id}
              type="button"
              onClick={() => handleSelectSoundscape(sc.id as SoundscapeType)}
              className={cn(
                'focus-ring rounded-full px-3 py-1.5 transition-all',
                activeSoundscape === sc.id
                  ? 'bg-primary text-sidebar font-extrabold shadow-xs'
                  : 'bg-white/5 text-white/70 hover:bg-white/10 hover:text-white',
              )}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* Sound Volume Slider */}
        {activeSoundscape !== 'none' && (
          <div className="flex items-center gap-3 w-44">
            <Volume2 className="size-4 text-white/60 shrink-0" />
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={[volume]}
              onValueChange={(vals) => handleVolumeChange(vals[0])}
              className="cursor-pointer"
            />
            <span className="font-mono text-[10px] text-white/50 w-7 text-right">
              {Math.round(volume * 100)}%
            </span>
          </div>
        )}
      </footer>
    </div>
    </ModalPortal>
  );
}
