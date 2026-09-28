import { cn } from '@/lib/utils';

export function BrandMark({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)} data-testid="brand-lifeos">
      <span className="relative grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <span className="absolute h-4 w-4 rounded-full border-[3px] border-current" />
        <span className="absolute right-[7px] top-[7px] size-2 rounded-full bg-accent" />
      </span>
      {!compact && <span className="text-[15px] font-extrabold tracking-[-0.03em]">lifeos<span className="text-accent">.</span></span>}
    </div>
  );
}