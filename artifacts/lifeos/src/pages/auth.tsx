import { SignIn, SignUp, AuthenticateWithRedirectCallback } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { BrandMark } from '@/components/brand-mark';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  variables: { colorPrimary: '#d8ef6a', colorForeground: '#243244', colorMutedForeground: '#667181', colorBackground: '#fbfaf4', colorInput: '#f3f1e8', colorInputForeground: '#243244', colorDanger: '#c65446', colorNeutral: '#d8d4c9', fontFamily: 'Manrope, sans-serif', borderRadius: '0.8rem' },
  elements: {
    rootBox: 'w-full',
    cardBox: 'bg-[#fbfaf4] rounded-[24px] w-[440px] max-w-full overflow-hidden shadow-none',
    card: '!shadow-none !border-0 !bg-transparent',
    footer: '!shadow-none !border-0 !bg-transparent',
    headerTitle: 'text-[#243244] font-extrabold',
    headerSubtitle: 'text-[#667181]',
    formFieldLabel: 'text-[#243244] font-bold',
    formFieldInput: 'bg-[#f3f1e8] border-[#d8d4c9] text-[#243244]',
    formButtonPrimary: 'bg-[#d8ef6a] text-[#243244] font-extrabold hover:bg-[#cce55c]',
    footerActionLink: 'text-[#687c29] font-bold',
    footerActionText: 'text-[#667181]',
    socialButtonsBlockButton: 'border-[#d8d4c9] bg-transparent text-[#243244]',
    dividerText: 'text-[#667181]',
    dividerLine: 'bg-[#d8d4c9]',
    alert: 'bg-[#fbeae5] text-[#243244]',
  },
};

function ClerkDevNotice() {
  const isDevKeyOnProd =
    typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    (((window as unknown as { __CLERK_PUBLISHABLE_KEY__?: string }).__CLERK_PUBLISHABLE_KEY__?.startsWith('pk_test_')) ||
      (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY?.startsWith('pk_test_')));

  if (!isDevKeyOnProd) return null;

  return (
    <div className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-50/80 p-4 text-xs text-amber-950 shadow-sm" data-testid="clerk-dev-notice">
      <div className="font-bold flex items-center gap-1.5 mb-1 text-amber-800">
        <span>⚠️</span> Clerk Development Key on Live Domain
      </div>
      <p className="leading-relaxed opacity-90">
        Clerk restricts <code className="font-mono bg-black/5 px-1 py-0.5 rounded text-[11px]">pk_test_</code> keys from creating sessions on live cloud domains ({typeof window !== 'undefined' ? window.location.hostname : 'onrender.com'}).
      </p>
      <p className="mt-2 leading-relaxed opacity-90">
        To enable login on Render, open your <a href="https://dashboard.clerk.com" target="_blank" rel="noreferrer" className="underline font-bold text-amber-900">Clerk Dashboard</a>, switch to or create a <strong>Production Instance</strong>, and update <code className="font-mono bg-black/5 px-1 py-0.5 rounded text-[11px]">CLERK_PUBLISHABLE_KEY</code> (<code className="font-mono text-[11px]">pk_live_...</code>) in your Render Environment Variables.
      </p>
    </div>
  );
}

export function SignInPage() {
  return (
    <AuthFrame>
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/today`}
        forceRedirectUrl={`${basePath}/today`}
        appearance={appearance}
      />
      <ClerkDevNotice />
    </AuthFrame>
  );
}

export function SignUpPage() {
  return (
    <AuthFrame>
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/today`}
        forceRedirectUrl={`${basePath}/today`}
        appearance={appearance}
      />
      <ClerkDevNotice />
    </AuthFrame>
  );
}

export function SSOCallbackPage() {
  return (
    <AuthFrame>
      <div className="flex flex-col items-center justify-center p-8 text-center" data-testid="sso-callback-loading">
        <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent mb-4" />
        <p className="text-sm font-semibold text-[#243244]">Completing sign in...</p>
        <p className="text-xs text-[#667181] mt-1">Preparing your LifeOS runway</p>
        <AuthenticateWithRedirectCallback
          signInFallbackRedirectUrl={`${basePath}/today`}
          signUpFallbackRedirectUrl={`${basePath}/today`}
          signInForceRedirectUrl={`${basePath}/today`}
          signUpForceRedirectUrl={`${basePath}/today`}
        />
      </div>
    </AuthFrame>
  );
}

function AuthFrame({ children }: { children: React.ReactNode }) {
  return <div className="grain flex min-h-[100dvh] flex-col items-center bg-sidebar px-4 py-7"><div className="flex w-full max-w-[440px] justify-between"><Link href="/" className="focus-ring"><BrandMark /></Link><Link href="/" className="focus-ring flex items-center gap-1 text-xs font-bold text-sidebar-foreground/60 hover:text-sidebar-foreground" data-testid="link-auth-back"><ArrowLeft className="size-3.5" /> Back</Link></div><div className="my-auto w-full max-w-[440px] rounded-[24px] bg-background p-1 shadow-2xl">{children}</div><p className="mt-7 text-center text-xs text-sidebar-foreground/45">Your private workspace for the long game.</p></div>;
}