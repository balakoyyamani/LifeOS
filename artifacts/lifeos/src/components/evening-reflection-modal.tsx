import { useState } from 'react';
import {
  BatteryCharging,
  Check,
  CheckCircle2,
  Copy,
  Heart,
  Moon,
  Sparkles,
  Trophy,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { sound } from '@/lib/sound';
import {
  type DailyReflection,
  ENERGY_LEVELS,
  SUGGESTED_MOODS,
  getReflectionForDate,
  getTodayDateKey,
  saveReflection,
} from '@/lib/reflections';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ModalPortal } from '@/components/modal-portal';

interface EveningReflectionModalProps {
  onClose: () => void;
  onSaved?: (reflection: DailyReflection) => void;
  dailyScore?: number;
  streak?: number;
}

export function EveningReflectionModal({
  onClose,
  onSaved,
  dailyScore = 0,
  streak = 0,
}: EveningReflectionModalProps) {
  const { toast } = useToast();
  const dateKey = getTodayDateKey();
  const existing = getReflectionForDate(dateKey);

  const [energyLevel, setEnergyLevel] = useState<number>(existing?.energyLevel ?? 3);
  const [selectedMoods, setSelectedMoods] = useState<string[]>(
    existing?.moodTags ?? ['Peaceful 🌿'],
  );
  const [win1, setWin1] = useState(existing?.wins[0] ?? '');
  const [win2, setWin2] = useState(existing?.wins[1] ?? '');
  const [win3, setWin3] = useState(existing?.wins[2] ?? '');
  const [lesson, setLesson] = useState(existing?.lesson ?? '');
  const [gratitude, setGratitude] = useState(existing?.gratitude ?? '');

  const [isCompleted, setIsCompleted] = useState(false);
  const [soundMuted, setSoundMuted] = useState(!sound.isEnabled());

  const toggleSound = () => {
    const next = !sound.isEnabled();
    sound.setEnabled(next);
    setSoundMuted(!next);
  };

  const toggleMood = (tag: string) => {
    sound.playClick();
    setSelectedMoods((prev) =>
      prev.includes(tag) ? prev.filter((m) => m !== tag) : [...prev, tag],
    );
  };

  const handleSelectEnergy = (lvl: number) => {
    sound.playClick();
    setEnergyLevel(lvl);
  };

  const handleSave = () => {
    const reflection: DailyReflection = {
      date: dateKey,
      energyLevel,
      moodTags: selectedMoods,
      wins: [win1.trim(), win2.trim(), win3.trim()],
      lesson: lesson.trim(),
      gratitude: gratitude.trim(),
      completedAt: new Date().toISOString(),
    };

    saveReflection(reflection);
    sound.playEveningBell();
    setIsCompleted(true);
    if (onSaved) onSaved(reflection);

    toast({
      title: 'Day closed with intention 🌙',
      description: 'Your evening reflection is saved to your personal history.',
    });
  };

  const handleCopyMarkdown = () => {
    const energyObj = ENERGY_LEVELS.find((e) => e.level === energyLevel);
    const md = `### 🌙 LifeOS Daily Closing — ${dateKey}
- **Score**: ${Math.round(dailyScore)}% · **Streak**: ${streak} days
- **Energy**: ${energyObj?.icon} ${energyObj?.label} (${energyLevel}/5)
- **Mood**: ${selectedMoods.join(', ')}

#### 🏆 3 Daily Wins
1. ${win1 || 'Showed up with consistency'}
2. ${win2 || 'Honored commitments'}
3. ${win3 || 'Made continuous progress'}

#### 💡 Lesson / Friction
${lesson || 'Embrace the process without rushing results.'}

#### 🙏 Gratitude
${gratitude || 'Grateful for another day of learning and growth.'}
`;
    void navigator.clipboard.writeText(md);
    sound.playClick();
    toast({
      title: 'Copied to clipboard',
      description: 'Daily reflection markdown copied.',
    });
  };

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 sm:p-6 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      >
        <div
          className="relative max-h-[85vh] sm:max-h-[88vh] w-full max-w-2xl overflow-y-auto modal-scroll rounded-3xl border border-border/80 bg-card p-6 shadow-2xl transition-all sm:p-8"
          onClick={(e) => e.stopPropagation()}
        >
        {/* Top Controls */}
        <div className="flex items-center justify-between border-b border-border/60 pb-5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Moon className="size-5" />
            </div>
            <div>
              <div className="mono-label text-muted-foreground">Evening Wind-Down</div>
              <h2 className="text-xl font-black tracking-tight text-sidebar">Daily Closing Ritual</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleSound}
              className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title={soundMuted ? 'Unmute chimes' : 'Mute chimes'}
            >
              {soundMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Close modal"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {!isCompleted ? (
          <div className="mt-6 space-y-6">
            {/* Philosophical Prompt */}
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs font-medium text-sidebar">
              <span className="font-bold text-primary">Mindset: </span>
              Release what wasn't finished. Honor the honest steps you took today.
            </div>

            {/* Energy Level Selector */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="mono-label text-muted-foreground">Evening Energy State</span>
                <span className="font-bold text-primary">
                  {ENERGY_LEVELS.find((e) => e.level === energyLevel)?.label}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {ENERGY_LEVELS.map((e) => {
                  const active = e.level === energyLevel;
                  return (
                    <button
                      key={e.level}
                      type="button"
                      onClick={() => handleSelectEnergy(e.level)}
                      className={cn(
                        'focus-ring flex flex-col items-center justify-center gap-1 rounded-2xl border p-2.5 text-center transition-all active:scale-95',
                        active
                          ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/40'
                          : 'border-border/80 bg-muted/30 text-muted-foreground hover:border-border hover:bg-muted/60 hover:text-foreground',
                      )}
                      title={e.desc}
                    >
                      <span className="text-xl sm:text-2xl">{e.icon}</span>
                      <span className="text-[11px] font-bold leading-tight">{e.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mood Tags */}
            <div className="space-y-2">
              <span className="mono-label text-muted-foreground">Day Sentiment</span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_MOODS.map((tag) => {
                  const selected = selectedMoods.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => toggleMood(tag)}
                      className={cn(
                        'focus-ring rounded-full px-3 py-1 text-xs font-semibold transition-all active:scale-95',
                        selected
                          ? 'border border-primary/40 bg-sidebar text-sidebar-foreground shadow-xs'
                          : 'border border-border/70 bg-card text-muted-foreground hover:border-border hover:bg-muted',
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3 Daily Wins */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-sidebar">
                  <Trophy className="size-4 text-accent" />
                  <span>3 Daily Wins (Big or Small)</span>
                </div>
                <span className="text-[11px] text-muted-foreground">Celebrate progress</span>
              </div>

              <div className="space-y-2">
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs font-bold text-muted-foreground">
                    1.
                  </span>
                  <input
                    type="text"
                    value={win1}
                    onChange={(e) => setWin1(e.target.value)}
                    placeholder="e.g. Deep work on core feature without checking notifications"
                    className="focus-ring w-full rounded-xl border border-border/80 bg-muted/20 py-2.5 pl-8 pr-4 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 hover:bg-muted/40"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs font-bold text-muted-foreground">
                    2.
                  </span>
                  <input
                    type="text"
                    value={win2}
                    onChange={(e) => setWin2(e.target.value)}
                    placeholder="e.g. Completed evening run and hydration goal"
                    className="focus-ring w-full rounded-xl border border-border/80 bg-muted/20 py-2.5 pl-8 pr-4 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 hover:bg-muted/40"
                  />
                </div>
                <div className="relative">
                  <span className="absolute left-3.5 top-3 text-xs font-bold text-muted-foreground">
                    3.
                  </span>
                  <input
                    type="text"
                    value={win3}
                    onChange={(e) => setWin3(e.target.value)}
                    placeholder="e.g. Spent quality mindful time with family"
                    className="focus-ring w-full rounded-xl border border-border/80 bg-muted/20 py-2.5 pl-8 pr-4 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 hover:bg-muted/40"
                  />
                </div>
              </div>
            </div>

            {/* Lesson / Friction Note */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-sidebar">
                <Zap className="size-3.5 text-primary" />
                <span>1 Friction or Lesson Learned</span>
              </label>
              <textarea
                rows={2}
                value={lesson}
                onChange={(e) => setLesson(e.target.value)}
                placeholder="What caused resistance today, or what would you adjust tomorrow?"
                className="focus-ring w-full resize-none rounded-xl border border-border/80 bg-muted/20 p-3 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 hover:bg-muted/40"
              />
            </div>

            {/* Gratitude Note */}
            <div className="space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-sidebar">
                <Heart className="size-3.5 text-rose-500" />
                <span>Gratitude Note</span>
              </label>
              <input
                type="text"
                value={gratitude}
                onChange={(e) => setGratitude(e.target.value)}
                placeholder="One person, moment, or comfort I appreciate today..."
                className="focus-ring w-full rounded-xl border border-border/80 bg-muted/20 px-3.5 py-2.5 text-xs font-medium text-foreground placeholder:text-muted-foreground/60 hover:bg-muted/40"
              />
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between border-t border-border/80 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="focus-ring rounded-full px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="focus-ring inline-flex items-center gap-2 rounded-full bg-sidebar px-6 py-2.5 text-xs font-extrabold text-sidebar-foreground shadow-sm transition-transform hover:bg-sidebar/90 active:scale-95"
              >
                <Sparkles className="size-3.5 text-accent" />
                <span>Close Day & Save Reflection</span>
              </button>
            </div>
          </div>
        ) : (
          /* Completion & Peaceful Closing Card */
          <div className="mt-8 space-y-6 text-center animate-fade-in">
            <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-primary/10 text-primary">
              <CheckCircle2 className="size-8" />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-2xl font-black text-sidebar">Day Closed With Grace</h3>
              <p className="text-xs text-muted-foreground">
                Your effort today is recorded. Unplug with peace of mind.
              </p>
            </div>

            {/* Summary card */}
            <div className="rounded-2xl border border-border/80 bg-muted/30 p-5 text-left text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
                <span className="font-bold text-sidebar">Date: {dateKey}</span>
                <span className="font-bold text-primary">
                  {ENERGY_LEVELS.find((e) => e.level === energyLevel)?.icon}{' '}
                  {ENERGY_LEVELS.find((e) => e.level === energyLevel)?.label}
                </span>
              </div>

              {(win1 || win2 || win3) && (
                <div>
                  <span className="mono-label text-muted-foreground">Wins:</span>
                  <ul className="mt-1 list-inside list-disc space-y-1 font-medium text-foreground">
                    {win1 && <li>{win1}</li>}
                    {win2 && <li>{win2}</li>}
                    {win3 && <li>{win3}</li>}
                  </ul>
                </div>
              )}

              {gratitude && (
                <div>
                  <span className="mono-label text-muted-foreground">Gratitude:</span>
                  <p className="mt-0.5 italic text-muted-foreground font-medium">"{gratitude}"</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCopyMarkdown}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted"
              >
                <Copy className="size-3.5" />
                <span>Copy Summary</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="focus-ring rounded-full bg-primary px-6 py-2 text-xs font-extrabold text-primary-foreground shadow-sm hover:opacity-90 active:scale-95"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    </ModalPortal>
  );
}
