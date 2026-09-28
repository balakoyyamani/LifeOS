import { useClerk, useUser } from '@clerk/react';
import { CalendarCheck2, ChevronDown, LogOut, Settings2, Sparkles, Target } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { BrandMark } from '@/components/brand-mark';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/today', label: 'Today', icon: CalendarCheck2 },
  { href: '/goals', label: 'Goals', icon: Target },
  { href: '/settings', label: 'Settings', icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <div className="grain min-h-[100dvh] bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-sidebar px-5 py-6 text-sidebar-foreground md:flex">
        <Link href="/today" className="focus-ring mb-14 inline-flex w-fit" data-testid="link-sidebar-home">
          <BrandMark />
        </Link>
        <div className="mb-3 px-3 mono-label text-sidebar-foreground/45">Your workspace</div>
        <nav className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`}
              className={cn('group flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition-colors',
                location === href ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/65 hover:bg-sidebar-accent hover:text-sidebar-foreground')}>
              <Icon className="size-[17px]" strokeWidth={location === href ? 2.5 : 1.8} />
              {label}
              {label === 'Today' && <span className="ml-auto size-1.5 rounded-full bg-accent" />}
            </Link>
          ))}
        </nav>
        <div className="mt-auto rounded-2xl border border-sidebar-border bg-sidebar-accent/60 p-4">
          <div className="mb-3 flex size-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground">
            <Sparkles className="size-4" />
          </div>
          <p className="text-xs font-bold">Keep the signal clear.</p>
          <p className="mt-1 text-[11px] leading-4 text-sidebar-foreground/55">A small, honest step still counts as movement.</p>
        </div>
        <button type="button" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || '/' })}
          className="focus-ring mt-5 flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground" data-testid="button-sign-out">
          <LogOut className="size-4" /> Sign out
        </button>
      </aside>

      <header className="sticky top-0 z-20 flex h-[68px] items-center justify-between border-b border-border/70 bg-background/90 px-5 backdrop-blur-md md:hidden">
        <Link href="/today" className="focus-ring" data-testid="link-mobile-home"><BrandMark /></Link>
        <div className="flex items-center gap-3">
          <Link href="/settings" className="focus-ring flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground" data-testid="link-mobile-settings">
            <Settings2 className="size-4" />
          </Link>
          <button type="button" onClick={() => signOut({ redirectUrl: import.meta.env.BASE_URL || '/' })} className="focus-ring flex size-9 items-center justify-center rounded-full bg-sidebar text-sidebar-foreground" data-testid="button-mobile-sign-out">
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      <main className="min-h-[100dvh] md:pl-[248px]">
        <div className="mx-auto w-full max-w-[1320px] px-5 pb-16 pt-8 sm:px-8 lg:px-12">{children}</div>
      </main>
      <div className="fixed bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border/80 bg-card/95 p-1.5 shadow-lg backdrop-blur-md md:hidden">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} className={cn('focus-ring flex min-w-[72px] flex-col items-center gap-1 rounded-full px-3 py-2 text-[10px] font-bold', location === href ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')} data-testid={`link-mobile-nav-${label.toLowerCase()}`}>
            <Icon className="size-4" /><span>{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ProfileChip() {
  const { user } = useUser();
  const name = user?.firstName || user?.username || 'You';
  return (
    <div className="flex items-center gap-2.5" data-testid="profile-chip">
      <div className="grid size-9 place-items-center rounded-full bg-sidebar text-xs font-bold text-sidebar-foreground">{name.slice(0, 1).toUpperCase()}</div>
      <div className="hidden text-left sm:block">
        <div className="text-xs font-bold">{name}</div>
        <div className="mono-label text-muted-foreground">personal plan</div>
      </div>
      <ChevronDown className="ml-1 size-3.5 text-muted-foreground" />
    </div>
  );
}