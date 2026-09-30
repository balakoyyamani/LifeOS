import { useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Coffee,
  Heart,
  Plane,
  RotateCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Thermometer,
  X,
  Zap,
} from 'lucide-react';
import {
  SHIELD_REASONS,
  STREAK_TIERS,
  activateShield,
  deactivateShield,
  getShieldDeploymentForDate,
  getShieldVaultState,
  getStreakTier,
} from '@/lib/shields';
import { sound } from '@/lib/sound';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface ResilienceShieldModalProps {
  dateKey: string;
  currentStreak: number;
  onClose: () => void;
  onShieldChanged?: () => void;
}

export function ResilienceShieldModal({
  dateKey,
  currentStreak,
  onClose,
  onShieldChanged,
}: ResilienceShieldModalProps) {
  const { toast } = useToast();
  const [vault, setVault] = useState(() => getShieldVaultState());
  const deployment = getShieldDeploymentForDate(dateKey);
  const isShieldActiveToday = Boolean(deployment);

  const [selectedReason, setSelectedReason] = useState<
    'illness' | 'travel' | 'emergency' | 'rest'
  >(deployment?.reasonCategory ?? 'rest');
  const [customNote, setCustomNote] = useState('');

  const streakTier = getStreakTier(currentStreak);

  const refreshVault = () => {
    setVault(getShieldVaultState());
    onShieldChanged?.();
  };

  const handleActivate = () => {
    sound.playShieldActivate();
    const ok = activateShield(dateKey, selectedReason, customNote);
    if (ok) {
      refreshVault();
      toast({
        title: 'Resilience Shield Activated! 🛡️',
        description: `Your ${currentStreak}-day streak is guarded for today. Rest and recover guilt-free.`,
      });
      onClose();
    } else {
      toast({
        title: 'Vault Empty',
        description: 'You have no available shields in your bank. Build a 5-day score streak to earn more!',
        variant: 'destructive',
      });
    }
  };

  const handleDeactivate = () => {
    sound.playClick();
    const ok = deactivateShield(dateKey);
    if (ok) {
      refreshVault();
      toast({
        title: 'Shield Returned to Vault 🛡️',
        description: 'Your Grace Day shield was refunded to your bank. Active runway tracking resumed.',
      });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sidebar/60 p-4 backdrop-blur-sm sm:p-6">
      <div
        className="w-full max-w-[520px] rounded-[32px] border border-border bg-background p-6 shadow-2xl sm:p-8 animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        data-testid="dialog-resilience-shield"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-primary/20 text-sidebar shadow-xs">
              <ShieldCheck className="size-6 text-primary" />
            </div>
            <div>
              <div className="mono-label text-accent">Streak Defense System</div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-sidebar">
                Resilience Vault
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="focus-ring rounded-full p-2 text-muted-foreground hover:bg-muted"
            data-testid="button-close-shield-modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Current Inventory Banner */}
        <div className="mt-6 rounded-2xl border border-border/80 bg-sidebar p-5 text-sidebar-foreground">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-sidebar-foreground/60 uppercase tracking-wider">
                Shield Bank
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-3xl font-black text-primary">
                  {vault.availableShields}
                </span>
                <span className="text-sm font-semibold text-sidebar-foreground/70">
                  of {vault.maxShields} Available
                </span>
              </div>
            </div>

            {/* Token Orbs */}
            <div className="flex items-center gap-2">
              {Array.from({ length: vault.maxShields }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'grid size-8 place-items-center rounded-xl text-xs transition-all',
                    i < vault.availableShields
                      ? 'border border-primary/40 bg-primary/20 text-primary shadow-xs'
                      : 'border border-sidebar-accent/50 bg-sidebar-accent/20 text-sidebar-foreground/30',
                  )}
                  title={i < vault.availableShields ? 'Ready to deploy' : 'Empty slot'}
                >
                  <Shield className="size-4 fill-current" />
                </div>
              ))}
            </div>
          </div>

          {/* Progress to next shield */}
          <div className="mt-4 border-t border-sidebar-accent/40 pt-3">
            <div className="flex items-center justify-between text-xs text-sidebar-foreground/60 font-medium">
              <span>Next Shield Reward:</span>
              <span className="text-primary font-bold">
                {5 - vault.daysNeededForNextShield}/5 consistent days (Score ≥70)
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sidebar-accent/30">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{
                  width: `${((5 - vault.daysNeededForNextShield) / 5) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Active Freeze Status OR Deploy Selector */}
        {isShieldActiveToday ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-primary/40 bg-primary/[0.06] p-5">
              <div className="flex items-start gap-3">
                <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-2.5 py-0.5 text-[11px] font-black text-sidebar">
                    <Check className="size-3" strokeWidth={3} />
                    SHIELD ACTIVE TODAY
                  </div>
                  <h3 className="mt-1 text-base font-extrabold text-sidebar">
                    Streak Protected ({currentStreak} Days)
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    Reason: <strong className="text-foreground">{deployment?.reason}</strong>. No penalty will occur if habits are incomplete today.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <p className="text-[11px] text-muted-foreground">
                Feel up to executing habits today? You can revoke this shield.
              </p>
              <button
                type="button"
                onClick={handleDeactivate}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
              >
                <RotateCcw className="size-3.5" />
                <span>Revoke & Refund</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-sidebar">
                  Select Grace Day Reason
                </label>
                <span className="text-[11px] text-muted-foreground">Guards current streak</span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-2">
                {SHIELD_REASONS.map((reason) => (
                  <button
                    key={reason.category}
                    type="button"
                    onClick={() => {
                      sound.playClick();
                      setSelectedReason(reason.category);
                    }}
                    className={cn(
                      'flex flex-col text-left rounded-2xl border p-3 transition-all',
                      selectedReason === reason.category
                        ? 'border-primary bg-primary/10 shadow-xs'
                        : 'border-border/80 bg-card hover:bg-muted/40',
                    )}
                  >
                    <span className="text-xl mb-1">{reason.icon}</span>
                    <span className="text-xs font-extrabold text-sidebar line-clamp-1">
                      {reason.label}
                    </span>
                    <span className="mt-0.5 text-[10px] text-muted-foreground line-clamp-2 leading-tight">
                      {reason.description}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Optional Personal Note */}
            <div>
              <label className="text-xs font-bold text-sidebar">
                Optional note <span className="text-muted-foreground font-normal">(for reflection logs)</span>
              </label>
              <input
                type="text"
                value={customNote}
                onChange={(e) => setCustomNote(e.target.value)}
                placeholder="e.g. Taking time off for flight and family dinner..."
                className="focus-ring mt-1.5 w-full rounded-xl border border-input bg-card px-3.5 py-2.5 text-xs font-semibold outline-none focus:border-primary"
              />
            </div>

            {/* Streak Safety Guarantee */}
            <div className="rounded-xl border border-border/70 bg-muted/40 p-3.5 text-xs text-muted-foreground leading-relaxed flex items-start gap-2.5">
              <Sparkles className="size-4 shrink-0 text-accent mt-0.5" />
              <span>
                Deploying a Grace Shield preserves your <strong>{currentStreak}-day {streakTier.name}</strong> streak. You may still log any bonus habits you like today without pressure.
              </span>
            </div>

            {/* Deploy Button */}
            <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
              <button
                type="button"
                onClick={onClose}
                className="focus-ring rounded-full px-4 py-2.5 text-xs font-bold text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleActivate}
                disabled={vault.availableShields <= 0}
                className="focus-ring inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-xs font-black text-primary-foreground shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-40"
                data-testid="button-deploy-shield"
              >
                <ShieldCheck className="size-4" />
                <span>Deploy Grace Shield (1 Token)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
