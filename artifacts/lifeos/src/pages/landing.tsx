import { ArrowRight, CirclePlay, Compass, Layers3, MoveUpRight, Target, Zap } from 'lucide-react';
import { Link } from 'wouter';
import { BrandMark } from '@/components/brand-mark';

export default function Landing() {
  return (
    <div className="grain min-h-[100dvh] overflow-hidden bg-background">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-6 sm:px-8 lg:px-10">
        <BrandMark />
        <div className="flex items-center gap-2">
          <Link href="/sign-in" className="focus-ring rounded-full px-4 py-2.5 text-sm font-bold text-foreground/75 hover:bg-muted" data-testid="link-landing-sign-in">Sign in</Link>
          <Link href="/sign-up" className="focus-ring rounded-full bg-sidebar px-4 py-2.5 text-sm font-bold text-sidebar-foreground shadow-sm hover:opacity-90" data-testid="link-landing-sign-up">Start your space <ArrowRight className="ml-1 inline size-3.5" /></Link>
        </div>
      </header>

      <main>
        <section className="relative mx-auto max-w-[1240px] px-5 pb-20 pt-14 sm:px-8 sm:pt-24 lg:px-10 lg:pb-28">
          <div className="pointer-events-none absolute -right-48 -top-20 size-[520px] rounded-full bg-primary/20 blur-3xl" />
          <div className="relative max-w-[820px] animate-rise-in">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 text-[11px] font-bold text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" /> A calmer way to move forward
            </div>
            <h1 className="max-w-[790px] text-[clamp(3.5rem,9vw,7.8rem)] font-extrabold leading-[.9] tracking-[-.08em] text-sidebar">
              Make room for<br /><span className="display-serif font-medium italic text-accent">what matters.</span>
            </h1>
            <p className="mt-8 max-w-[500px] text-lg leading-8 text-muted-foreground sm:text-xl">LifeOS turns your ambitions into a daily rhythm you can actually live with. See the signal, take the next step, keep going.</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link href="/sign-up" className="focus-ring rounded-full bg-primary px-6 py-3.5 text-sm font-extrabold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5" data-testid="link-landing-start">Build your rhythm <ArrowRight className="ml-2 inline size-4" /></Link>
              <a href="#how-it-works" className="focus-ring inline-flex items-center gap-2 rounded-full px-4 py-3 text-sm font-bold text-muted-foreground hover:text-foreground" data-testid="link-landing-how-it-works"><CirclePlay className="size-4" /> See how it works</a>
            </div>
          </div>
          <div className="relative mt-16 grid gap-4 sm:grid-cols-[1fr_1.4fr] lg:mt-24">
            <div className="rounded-[28px] bg-sidebar p-7 text-sidebar-foreground sm:min-h-[300px] sm:p-9">
              <div className="flex items-center justify-between"><span className="mono-label text-sidebar-foreground/45">The daily view</span><Compass className="size-5 text-primary" /></div>
              <div className="mt-16"><div className="display-serif text-4xl italic">Good morning, Alex.</div><p className="mt-2 text-sm text-sidebar-foreground/55">Three things are enough for today.</p></div>
              <div className="mt-9 h-1.5 overflow-hidden rounded-full bg-sidebar-accent"><div className="h-full w-[68%] rounded-full bg-primary" /></div>
            </div>
            <div className="rounded-[28px] border border-border bg-card p-7 sm:p-9">
              <div className="flex items-center justify-between"><span className="mono-label text-muted-foreground">One clear signal</span><span className="rounded-full bg-primary/20 px-2 py-1 text-[10px] font-bold text-primary-foreground">68% in motion</span></div>
              <div className="mt-10 flex items-end justify-between gap-4">
                <div><div className="text-6xl font-extrabold tracking-[-.08em] text-sidebar">04<span className="text-accent">:26</span></div><p className="mt-2 text-sm text-muted-foreground">focus minutes this week</p></div>
                <div className="hidden h-24 items-end gap-1.5 sm:flex">{[30,44,22,58,42,76,68,88,64,92,82,100].map((height, i) => <span key={i} className="w-2 rounded-full bg-primary/70" style={{ height: `${height}%` }} />)}</div>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-y border-border bg-card/60">
          <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:px-10 lg:py-28">
            <div><span className="mono-label text-accent">A soft system with a sharp point</span><h2 className="mt-5 max-w-[400px] text-4xl font-extrabold leading-tight tracking-[-.06em] text-sidebar sm:text-5xl">Less tracking.<br /><span className="display-serif font-medium italic">More traction.</span></h2></div>
            <div className="grid gap-8 sm:grid-cols-3">{[{icon: Target, title: 'Choose the signal', body: 'Keep your active goals small enough to remember and meaningful enough to matter.'}, {icon: Layers3, title: 'Meet the day', body: 'Start with a focused view of what moved, what is waiting, and what comes next.'}, {icon: Zap, title: 'Make progress visible', body: 'Tiny updates compound into evidence that your direction is working.'}].map(({icon: Icon, title, body}, i) => <div key={title} className="animate-rise-in" style={{ animationDelay: `${i * 80}ms` }}><div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Icon className="size-5" /></div><h3 className="text-base font-extrabold text-sidebar">{title}</h3><p className="mt-3 text-sm leading-6 text-muted-foreground">{body}</p></div>)}</div>
          </div>
        </section>

        <section className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:flex lg:items-center lg:justify-between lg:px-10 lg:py-28">
          <div><span className="mono-label text-muted-foreground">Built for the long game</span><h2 className="mt-4 max-w-[650px] text-4xl font-extrabold leading-[1.05] tracking-[-.06em] text-sidebar sm:text-6xl">A workspace that respects<br /><span className="display-serif font-medium italic text-accent">your actual life.</span></h2></div>
          <Link href="/sign-up" className="focus-ring mt-8 inline-flex rounded-full bg-sidebar px-6 py-3.5 text-sm font-extrabold text-sidebar-foreground lg:mt-0" data-testid="link-landing-bottom-cta">Open LifeOS <MoveUpRight className="ml-2 size-4" /></Link>
        </section>
      </main>
      <footer className="mx-auto flex max-w-[1240px] items-center justify-between border-t border-border px-5 py-6 text-xs text-muted-foreground sm:px-8 lg:px-10"><BrandMark compact /><span>Personal operating system · Phase 01</span></footer>
    </div>
  );
}