import { useMemo, useState } from 'react';
import {
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Flame,
  Lock,
  Moon,
  Shield,
  Sparkles,
  Star,
  Target,
  Trophy,
  X,
  Zap,
} from 'lucide-react';
import {
  type BadgeCategory,
  type BadgeTier,
  type EvaluatedBadge,
  evaluateBadges,
  type UserStatsSnapshot,
} from '@/lib/badges';
import { sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface HallOfFameModalProps {
  stats: UserStatsSnapshot;
  onClose: () => void;
}

const tierConfig: Record<
  BadgeTier,
  { label: string; badgeClass: string; borderClass: string; glowClass: string }
> = {
  bronze: {
    label: 'Bronze',
    badgeClass: 'bg-amber-900/10 text-amber-800 border-amber-800/30',
    borderClass: 'border-amber-700/40 hover:border-amber-600/70',
    glowClass: 'shadow-[0_0_15px_rgba(180,83,9,0.15)]',
  },
  silver: {
    label: 'Silver',
    badgeClass: 'bg-slate-200/40 text-slate-700 border-slate-400/40',
    borderClass: 'border-slate-400/50 hover:border-slate-400',
    glowClass: 'shadow-[0_0_15px_rgba(148,163,184,0.2)]',
  },
  gold: {
    label: 'Gold',
    badgeClass: 'bg-yellow-400/15 text-yellow-800 border-yellow-500/40',
    borderClass: 'border-yellow-500/50 hover:border-yellow-400',
    glowClass: 'shadow-[0_0_20px_rgba(234,179,8,0.25)]',
  },
  diamond: {
    label: 'Diamond',
    badgeClass: 'bg-cyan-400/15 text-cyan-800 border-cyan-400/50',
    borderClass: 'border-cyan-400/60 hover:border-cyan-300',
    glowClass: 'shadow-[0_0_25px_rgba(6,182,212,0.3)]',
  },
};

export function HallOfFameModal({ stats, onClose }: HallOfFameModalProps) {
  const { toast } = useToast();
  const badges = useMemo(() => evaluateBadges(stats), [stats]);

  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [selectedBadge, setSelectedBadge] = useState<EvaluatedBadge>(
    badges.find((b) => b.unlocked) || badges[0],
  );

  const unlockedCount = badges.filter((b) => b.unlocked).length;
  const unlockPercentage = Math.round((unlockedCount / badges.length) * 100);

  const filteredBadges = useMemo(() => {
    if (activeCategory === 'all') return badges;
    if (activeCategory === 'unlocked') return badges.filter((b) => b.unlocked);
    return badges.filter((b) => b.category === activeCategory);
  }, [badges, activeCategory]);

  const handleSelectBadge = (b: EvaluatedBadge) => {
    sound.playClick();
    setSelectedBadge(b);
  };

  const handleCopyBadge = (b: EvaluatedBadge) => {
    sound.playClick();
    const md = `🏆 **LifeOS Achievement Unlocked: ${b.icon} ${b.title}** (${tierConfig[b.tier].label} Tier)
> "${b.quote}"
- **Requirement**: ${b.description}
- **Status**: ${b.unlocked ? `Unlocked on ${b.unlockedAt ? new Date(b.unlockedAt).toLocaleDateString() : 'Active'}` : `${b.currentProgress} / ${b.maxProgress}`}
`;
    void navigator.clipboard.writeText(md);
    toast({
      title: 'Achievement Copied! 📋',
      description: `Copied ${b.title} trophy card to clipboard.`,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border/80 bg-card shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-muted/20 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-amber-400/15 text-amber-600">
              <Trophy className="size-5" />
            </div>
            <div>
              <div className="mono-label text-muted-foreground">Achievement Showcase</div>
              <h2 className="text-xl font-black text-sidebar">Hall of Milestones</h2>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-right">
              <div className="text-xs font-bold text-sidebar">
                {unlockedCount} of {badges.length} Trophies ({unlockPercentage}%)
              </div>
              <div className="mt-1 h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-amber-500 transition-all"
                  style={{ width: `${unlockPercentage}%` }}
                />
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/40 px-6 py-3 sm:px-8 bg-card/60">
          {[
            { id: 'all', label: 'All Trophies' },
            { id: 'unlocked', label: `Unlocked (${unlockedCount})` },
            { id: 'streak', label: 'Streaks 🔥' },
            { id: 'focus', label: 'Focus 🧘' },
            { id: 'mastery', label: 'Mastery 🥇' },
            { id: 'discipline', label: 'Discipline ⚖️' },
            { id: 'mind', label: 'Mindset 🌙' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                sound.playClick();
                setActiveCategory(cat.id);
              }}
              className={cn(
                'focus-ring rounded-full px-3 py-1 text-xs font-semibold transition-all active:scale-95',
                activeCategory === cat.id
                  ? 'bg-sidebar text-sidebar-foreground shadow-xs'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* 2-Column Content: Badge Grid & Selected Badge Detail */}
        <div className="grid flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-12">
          {/* Badge Grid */}
          <div className="p-6 sm:p-8 lg:col-span-7 space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredBadges.map((b) => {
                const isSelected = selectedBadge.id === b.id;
                const tier = tierConfig[b.tier];
                const progressPct = Math.min(100, Math.round((b.currentProgress / b.maxProgress) * 100));

                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleSelectBadge(b)}
                    className={cn(
                      'group relative flex items-start gap-3 rounded-2xl border p-4 text-left transition-all active:scale-95',
                      b.unlocked
                        ? cn('bg-card hover:bg-card/80', tier.borderClass, tier.glowClass)
                        : 'border-border/70 bg-muted/20 opacity-70 hover:opacity-100 hover:border-border',
                      isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    )}
                  >
                    <div
                      className={cn(
                        'grid size-12 shrink-0 place-items-center rounded-2xl text-2xl transition-transform group-hover:scale-110',
                        b.unlocked ? 'bg-muted/40 shadow-xs' : 'bg-muted/30 grayscale',
                      )}
                    >
                      {b.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-extrabold text-xs text-sidebar truncate">
                          {b.title}
                        </span>
                        {b.unlocked ? (
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[9px] font-extrabold border',
                              tier.badgeClass,
                            )}
                          >
                            {tier.label}
                          </span>
                        ) : (
                          <Lock className="size-3 text-muted-foreground/60 shrink-0" />
                        )}
                      </div>

                      <p className="mt-1 text-[11px] leading-tight text-muted-foreground line-clamp-2">
                        {b.description}
                      </p>

                      {/* Mini progress bar if locked */}
                      {!b.unlocked && (
                        <div className="mt-2.5">
                          <div className="flex justify-between text-[9px] font-mono text-muted-foreground">
                            <span>Progress</span>
                            <span>
                              {b.currentProgress} / {b.maxProgress}
                            </span>
                          </div>
                          <div className="mt-0.5 h-1 w-full rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Badge Spotlight Inspector */}
          <div className="border-t border-border/80 bg-muted/20 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:col-span-5 flex flex-col justify-between">
            <div className="space-y-5">
              <div className="text-center">
                <div
                  className={cn(
                    'mx-auto grid size-20 place-items-center rounded-3xl text-4xl shadow-md transition-transform hover:scale-105',
                    selectedBadge.unlocked ? 'bg-card' : 'bg-muted/40 grayscale',
                  )}
                >
                  {selectedBadge.icon}
                </div>

                <div className="mt-3">
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border',
                      tierConfig[selectedBadge.tier].badgeClass,
                    )}
                  >
                    {tierConfig[selectedBadge.tier].label} Tier · {selectedBadge.category.toUpperCase()}
                  </span>
                  <h3 className="mt-2 text-xl font-black text-sidebar">
                    {selectedBadge.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground font-medium">
                    {selectedBadge.description}
                  </p>
                </div>
              </div>

              {/* Status Box */}
              <div className="rounded-2xl border border-border/80 bg-card p-4 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-sidebar">Milestone Status:</span>
                  {selectedBadge.unlocked ? (
                    <span className="inline-flex items-center gap-1 font-bold text-primary">
                      <CheckCircle2 className="size-3.5" /> Unlocked
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 font-bold text-muted-foreground">
                      <Lock className="size-3.5" /> In Progress
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[11px] font-mono text-muted-foreground">
                    <span>Current Metric</span>
                    <span className="font-bold text-foreground">
                      {selectedBadge.currentProgress} / {selectedBadge.maxProgress}
                    </span>
                  </div>
                  <div className="mt-1 h-2 w-full rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        selectedBadge.unlocked ? 'bg-primary' : 'bg-primary/70',
                      )}
                      style={{
                        width: `${Math.min(100, Math.round((selectedBadge.currentProgress / selectedBadge.maxProgress) * 100))}%`,
                      }}
                    />
                  </div>
                </div>

                {selectedBadge.unlockedAt && (
                  <div className="text-[10px] text-muted-foreground border-t border-border/60 pt-2 flex items-center gap-1">
                    <Clock className="size-3" />
                    <span>
                      Achieved on {new Date(selectedBadge.unlockedAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Quote */}
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs italic text-sidebar leading-relaxed">
                "{selectedBadge.quote}"
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-2 border-t border-border/60 pt-4">
              <button
                type="button"
                onClick={() => handleCopyBadge(selectedBadge)}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-foreground hover:bg-muted"
              >
                <Copy className="size-3.5" />
                <span>Copy Card</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="focus-ring rounded-full bg-sidebar px-5 py-2 text-xs font-extrabold text-sidebar-foreground hover:bg-sidebar/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
