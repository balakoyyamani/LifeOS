import { ArrowRight, Compass, Home } from 'lucide-react';
import { Link } from 'wouter';
import { BrandMark } from '@/components/brand-mark';

export default function NotFound() {
  return (
    <div className="grain flex min-h-[100dvh] flex-col items-center justify-center bg-background px-5 py-12 text-center">
      <div className="w-full max-w-[480px] animate-rise-in rounded-[32px] border border-border bg-card p-8 shadow-xl sm:p-10">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-2xl bg-accent/20 text-accent">
          <Compass className="size-7 animate-pulse" />
        </div>

        <div className="mono-label text-muted-foreground">Coordinates Not Found</div>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-.05em] text-sidebar sm:text-4xl">
          Off the runway<span className="text-accent">.</span>
        </h1>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The view or page you were looking for doesn't exist, was moved, or hasn't been charted yet.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/today"
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-xs font-extrabold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95"
            data-testid="button-404-today"
          >
            <span>Return to Today</span>
            <ArrowRight className="size-3.5" />
          </Link>
          <Link
            href="/"
            className="focus-ring inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3 text-xs font-bold text-muted-foreground hover:bg-muted hover:text-foreground"
            data-testid="button-404-home"
          >
            <Home className="size-3.5" />
            <span>Home</span>
          </Link>
        </div>

        <div className="mt-10 border-t border-border/70 pt-6">
          <BrandMark compact className="mx-auto justify-center opacity-70" />
        </div>
      </div>
    </div>
  );
}
