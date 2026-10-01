import { useEffect, useState } from 'react';
import {
  ArrowRight,
  Bell,
  CalendarRange,
  Check,
  ChevronRight,
  Clock3,
  Moon,
  Palette,
  Radio,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Sun,
  UserRound,
  Volume2,
} from 'lucide-react';
import { useClerk, useUser } from '@clerk/react';
import { useHealthCheck } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { AppShell, ProfileChip } from '@/components/app-shell';
import { sound } from '@/lib/sound';
import { useNotifications } from '@/context/notification-context';
import { formatTime12h } from '@/lib/reminders';
import { cn } from '@/lib/utils';



export default function Settings() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const health = useHealthCheck();

  const [quiet, setQuiet] = useState(() => localStorage.getItem('lifeos-quiet') === 'true');
  const [compact, setCompact] = useState(() => localStorage.getItem('lifeos-compact') === 'true');
  const [soundActive, setSoundActive] = useState(() => sound.isEnabled());

  useEffect(() => {
    localStorage.setItem('lifeos-quiet', String(quiet));
  }, [quiet]);

  useEffect(() => {
    localStorage.setItem('lifeos-compact', String(compact));
  }, [compact]);

  const handleSoundToggle = (enabled: boolean) => {
    setSoundActive(enabled);
    sound.setEnabled(enabled);
    if (enabled) {
      sound.playClick();
    }
  };

  return (
    <AppShell>
      <div className="animate-rise-in pb-16">
        <div className="mb-9 flex items-start justify-between gap-4">
          <div>
            <div className="mono-label text-muted-foreground">Your workspace</div>
            <h1 className="mt-3 text-4xl font-extrabold tracking-[-.07em] text-sidebar sm:text-5xl">
              Settings<span className="text-accent">.</span>
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Small choices for a workspace that feels attuned to your rhythm.
            </p>
          </div>
          <ProfileChip />
        </div>

        <div className="max-w-[760px] space-y-5">
          {/* Profile Section */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-primary/25 text-primary-foreground">
                <UserRound className="size-4 text-primary" />
              </div>
              <div>
                <h2 className="font-extrabold text-sidebar">Profile</h2>
                <p className="text-xs text-muted-foreground">
                  Your identity & authentication are securely verified.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 p-4">
              <div className="flex items-center gap-3.5">
                <div className="grid size-11 place-items-center rounded-full bg-sidebar text-base font-bold text-sidebar-foreground shadow-sm">
                  {(user?.firstName || user?.username || 'Y').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-sidebar">
                    {user?.fullName || user?.username || 'LifeOS Pilot'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {user?.primaryEmailAddress?.emailAddress || 'Local Active Session'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-3.5" />
                <span>Protected</span>
              </div>
            </div>
          </section>

          {/* Preferences Section */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-accent/25 text-accent-foreground">
                <Palette className="size-4 text-accent" />
              </div>
              <div>
                <h2 className="font-extrabold text-sidebar">Sensory & Workspace Experience</h2>
                <p className="text-xs text-muted-foreground">
                  Configure auditory feedback and layout density.
                </p>
              </div>
            </div>

            <div className="divide-y divide-border/60">
              <ToggleRow
                icon={Volume2}
                label="Tactile Audio Feedback"
                description="Synthesized chime on goal completion, streak shields, and steppers."
                value={soundActive}
                onChange={handleSoundToggle}
                testId="toggle-tactile-sound"
              />
              <ToggleRow
                icon={Bell}
                label="Quiet Nudges"
                description="Suppress audio and intrusive alerts during deep focus."
                value={quiet}
                onChange={setQuiet}
                testId="toggle-quiet-nudges"
              />
              <ToggleRow
                icon={Moon}
                label="Compact Goal Cards"
                description="Fit more daily commitments into the screen without extra scrolling."
                value={compact}
                onChange={setCompact}
                testId="toggle-compact-cards"
              />
            </div>
          </section>

          {/* Notifications & Closed-App Push Section */}
          <NotificationSettingsSection />


          {/* Weekly Rhythms & Reflection Portal */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-primary/20 text-primary">
                  <CalendarRange className="size-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-extrabold text-sidebar">Weekly Review & Objectives</h2>
                    <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                      Active
                    </span>
                  </div>
                  <p className="mt-1 max-w-[440px] text-xs leading-5 text-muted-foreground">
                    Review your 7-day compounding trajectory, review reflections, and set overarching weekly targets.
                  </p>
                </div>
              </div>
              <Link
                href="/weekly"
                className="focus-ring inline-flex items-center justify-center gap-2 rounded-xl bg-sidebar px-4 py-2.5 text-xs font-bold text-sidebar-foreground transition hover:opacity-90"
                data-testid="link-open-weekly"
              >
                <span>Open Weekly</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </section>

          {/* System & Health Status */}
          <section className="rounded-2xl border border-border/80 bg-card/60 p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-sidebar">
                <span
                  className={`size-2.5 rounded-full transition-all ${
                    health.isError
                      ? 'bg-destructive ring-4 ring-destructive/20'
                      : 'bg-emerald-500 ring-4 ring-emerald-500/20'
                  }`}
                />
                <span data-testid="status-health-check">
                  {health.isLoading
                    ? 'Checking LifeOS systems…'
                    : health.isError
                      ? 'System check needs attention'
                      : `Backend API & Database: ${health.data?.status === 'ok' ? 'Connected & Operational' : health.data?.status || 'Online'}`}
                </span>
              </div>
              <span className="mono-label text-[10px] text-muted-foreground">Phase 1 Engine</span>
            </div>
          </section>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || '/' })}
            className="focus-ring flex w-full items-center justify-between rounded-2xl border border-border bg-card px-5 py-4 text-left text-sm font-bold text-muted-foreground transition hover:border-destructive/40 hover:text-destructive shadow-sm"
            data-testid="button-settings-sign-out"
          >
            <span>Sign out of LifeOS</span>
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function ToggleRow({
  icon: Icon,
  label,
  description,
  value,
  onChange,
  testId,
}: {
  icon: typeof Bell;
  label: string;
  description: string;
  value: boolean;
  onChange: (value: boolean) => void;
  testId: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 first:pt-1 last:pb-1">
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 size-4 text-muted-foreground" />
        <div>
          <div className="text-sm font-bold text-sidebar">{label}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
      <button
        type="button"
        aria-pressed={value}
        onClick={() => onChange(!value)}
        className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors ${
          value ? 'bg-primary' : 'bg-muted'
        }`}
        data-testid={testId}
      >
        <span
          className={`absolute top-1 size-4 rounded-full bg-background shadow-sm transition-transform flex items-center justify-center ${
            value ? 'translate-x-6' : 'translate-x-1'
          }`}
        >
          {value && <Check className="size-2.5 text-primary stroke-[3]" />}
        </span>
      </button>
    </div>
  );
}

function NotificationSettingsSection() {
  const {
    isPushActive,
    pushSupported,
    permission,
    routineConfig,
    updateRoutineConfig,
    enableClosedAppPush,
    disableClosedAppPush,
    triggerTestAlert,
    triggerTestClosedAppPush,
  } = useNotifications();

  const [loadingPush, setLoadingPush] = useState(false);
  const [testingPush, setTestingPush] = useState(false);
  const [testPushStatus, setTestPushStatus] = useState<string | null>(null);

  const handleTogglePush = async (enable: boolean) => {
    setLoadingPush(true);
    try {
      if (enable) {
        await enableClosedAppPush();
      } else {
        await disableClosedAppPush();
      }
    } finally {
      setLoadingPush(false);
    }
  };

  const handleTestClosedApp = async () => {
    setTestingPush(true);
    setTestPushStatus('Scheduled! Close this tab now — alert will fire in 5 seconds.');
    try {
      await triggerTestClosedAppPush(5);
    } catch {
      setTestPushStatus('Failed to schedule test.');
    } finally {
      setTimeout(() => {
        setTestingPush(false);
        setTestPushStatus(null);
      }, 7000);
    }
  };

  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6 shadow-sm space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-accent/25 text-accent-foreground">
            <Bell className="size-4 text-accent" />
          </div>
          <div>
            <h2 className="font-extrabold text-sidebar">Notifications & Daily Rhythm</h2>
            <p className="text-xs text-muted-foreground">
              Timed reminders, routine alerts, and closed-app Web Push delivery.
            </p>
          </div>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-0.5 text-[11px] font-bold border',
            isPushActive
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : permission === 'denied'
                ? 'border-destructive/30 bg-destructive/10 text-destructive'
                : 'border-border bg-muted/50 text-muted-foreground',
          )}
        >
          {isPushActive
            ? 'Closed-App Push Active ✓'
            : permission === 'denied'
              ? 'Browser Blocked ✕'
              : 'In-Tab Only'}
        </span>
      </div>

      {/* Closed-App Push Card */}
      <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-sidebar">Closed-App Web Push</span>
              <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[9px] font-extrabold text-sidebar">
                OFFLINE CAPABLE
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-[500px]">
              Receive reminder chimes and banners via your operating system (Windows, macOS, Android)
              even when LifeOS website tabs are completely closed.
            </p>
          </div>
          <button
            type="button"
            disabled={loadingPush || !pushSupported}
            onClick={() => handleTogglePush(!isPushActive)}
            className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors ${
              isPushActive ? 'bg-primary' : 'bg-muted'
            } ${!pushSupported ? 'opacity-50 cursor-not-allowed' : ''}`}
            data-testid="toggle-closed-app-push"
          >
            <span
              className={`absolute top-1 size-4 rounded-full bg-background shadow-sm transition-transform flex items-center justify-center ${
                isPushActive ? 'translate-x-6' : 'translate-x-1'
              }`}
            >
              {isPushActive && <Check className="size-2.5 text-primary stroke-[3]" />}
            </span>
          </button>
        </div>

        {isPushActive && (
          <div className="pt-2 border-t border-border/40 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-muted-foreground text-[11px]">
              Want to verify closed-app delivery?
            </span>
            <button
              type="button"
              disabled={testingPush}
              onClick={handleTestClosedApp}
              className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 font-bold text-sidebar hover:bg-muted active:scale-95 shadow-2xs"
            >
              <Send className="size-3 text-accent" />
              <span>{testingPush ? 'Closing window test…' : 'Test Closed-App Push (in 5s)'}</span>
            </button>
          </div>
        )}

        {testPushStatus && (
          <div className="rounded-lg bg-accent/15 border border-accent/30 p-2.5 text-xs text-sidebar font-semibold animate-fade-in">
            {testPushStatus}
          </div>
        )}
      </div>

      {/* Routine Reminders */}
      <div className="space-y-3">
        <h3 className="text-xs font-extrabold text-sidebar uppercase tracking-wider">
          Automated Daily Routine Nudges
        </h3>

        {/* Morning Kickoff */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 p-3.5 hover:bg-muted/20 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌅</span>
            <div>
              <div className="text-sm font-bold text-sidebar">Morning Focus Kickoff</div>
              <div className="text-xs text-muted-foreground">
                Prompt to plan your day, declare top priorities, and set the tone.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <input
              type="time"
              value={routineConfig.morningKickoffTime}
              onChange={(e) => updateRoutineConfig({ morningKickoffTime: e.target.value })}
              disabled={!routineConfig.morningKickoffEnabled}
              className="focus-ring rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-mono font-bold text-foreground disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() =>
                updateRoutineConfig({
                  morningKickoffEnabled: !routineConfig.morningKickoffEnabled,
                })
              }
              className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                routineConfig.morningKickoffEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-1 size-4 rounded-full bg-background shadow-sm transition-transform flex items-center justify-center ${
                  routineConfig.morningKickoffEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              >
                {routineConfig.morningKickoffEnabled && (
                  <Check className="size-2.5 text-primary stroke-[3]" />
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Evening Reflection */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 p-3.5 hover:bg-muted/20 transition-colors">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌙</span>
            <div>
              <div className="text-sm font-bold text-sidebar">Evening Reflection & Wind-Down</div>
              <div className="text-xs text-muted-foreground">
                Prompt to review momentum, capture reflections, and mentally decompress.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end sm:self-auto">
            <input
              type="time"
              value={routineConfig.eveningReflectionTime}
              onChange={(e) => updateRoutineConfig({ eveningReflectionTime: e.target.value })}
              disabled={!routineConfig.eveningReflectionEnabled}
              className="focus-ring rounded-lg border border-input bg-background px-2.5 py-1 text-xs font-mono font-bold text-foreground disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() =>
                updateRoutineConfig({
                  eveningReflectionEnabled: !routineConfig.eveningReflectionEnabled,
                })
              }
              className={`focus-ring relative h-6 w-11 shrink-0 rounded-full transition-colors ${
                routineConfig.eveningReflectionEnabled ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <span
                className={`absolute top-1 size-4 rounded-full bg-background shadow-sm transition-transform flex items-center justify-center ${
                  routineConfig.eveningReflectionEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              >
                {routineConfig.eveningReflectionEnabled && (
                  <Check className="size-2.5 text-primary stroke-[3]" />
                )}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Immediate Audio & Banner Test */}
      <div className="flex items-center justify-between pt-2 border-t border-border/60">
        <span className="text-xs text-muted-foreground">Test in-app chime & desktop alert</span>
        <button
          type="button"
          onClick={triggerTestAlert}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3.5 py-1.5 text-xs font-bold text-sidebar hover:bg-muted active:scale-95"
          data-testid="button-test-alert"
        >
          <Volume2 className="size-3.5 text-accent" />
          <span>Test Notification Chime</span>
        </button>
      </div>
    </section>
  );
}