import { SignIn, SignUp, AuthenticateWithRedirectCallback } from '@clerk/react';
import { shadcn } from '@clerk/themes';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { BrandMark } from '@/components/brand-mark';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const appearance = {
  theme: shadcn,
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

export function SignInPage() {
  return (
    <AuthFrame>
      <SignIn
        routing="hash"
        signUpUrl={`${basePath}/sign-up`}
        fallbackRedirectUrl={`${basePath}/today`}
        forceRedirectUrl={`${basePath}/today`}
        appearance={appearance}
      />
    </AuthFrame>
  );
}

export function SignUpPage() {
  return (
    <AuthFrame>
      <SignUp
        routing="hash"
        signInUrl={`${basePath}/sign-in`}
        fallbackRedirectUrl={`${basePath}/today`}
        forceRedirectUrl={`${basePath}/today`}
        appearance={appearance}
      />
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
  return (
    <div className="grain flex min-h-[100dvh] flex-col items-center bg-sidebar px-4 py-7">
      <div className="flex w-full max-w-[440px] justify-between">
        <Link href="/" className="focus-ring"><BrandMark /></Link>
        <Link href="/" className="focus-ring flex items-center gap-1 text-xs font-bold text-sidebar-foreground/60 hover:text-sidebar-foreground" data-testid="link-auth-back">
          <ArrowLeft className="size-3.5" /> Back
        </Link>
      </div>
      <div className="my-auto w-full max-w-[440px] min-h-[480px] rounded-[24px] bg-background p-1 shadow-2xl flex flex-col justify-center">
        {children}
      </div>
      <p className="mt-7 text-center text-xs text-sidebar-foreground/45">Your private workspace for the long game.</p>
    </div>
  );
}