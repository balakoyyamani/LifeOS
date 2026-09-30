import { type ReactNode, useEffect, useRef } from 'react';
import { ClerkProvider, Show, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import Today from '@/pages/today';
import Goals from '@/pages/goals';
import Analytics from '@/pages/analytics';
import Weekly from '@/pages/weekly';
import Settings from '@/pages/settings';
import { SignInPage, SignUpPage, SSOCallbackPage } from '@/pages/auth';
import {
  Redirect,
  Route,
  Switch,
  Router as WouterRouter,
  useLocation,
} from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const rawClerkKey =
  (typeof window !== 'undefined' && ((window as unknown as { __CLERK_PUBLISHABLE_KEY__?: string }).__CLERK_PUBLISHABLE_KEY__)) ||
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkPubKey = rawClerkKey ? publishableKeyFromHost(window.location.hostname, rawClerkKey) : undefined;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/today" /></Show><Show when="signed-out"><Landing /></Show></>;
}

function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => { const id = user?.id ?? null; if (previous.current !== undefined && previous.current !== id) client.clear(); previous.current = id; }), [addListener, client]);
  return null;
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/sso-callback" component={SSOCallbackPage} />
        <Route path="/sign-in/sso-callback" component={SSOCallbackPage} />
        <Route path="/sign-up/sso-callback" component={SSOCallbackPage} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route path="/today"><Protected><Today /></Protected></Route>
        <Route path="/goals"><Protected><Goals /></Protected></Route>
        <Route path="/weekly"><Protected><Weekly /></Protected></Route>
        <Route path="/analytics"><Protected><Analytics /></Protected></Route>
        <Route path="/settings"><Protected><Settings /></Protected></Route>
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  const stripBase = (path: string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={{
        theme: shadcn,
        cssLayerName: 'clerk',
        variables: {
          colorPrimary: '#d8ef6a',
          colorForeground: '#243244',
          colorBackground: '#fbfaf4',
          fontFamily: 'Manrope, sans-serif',
        },
      }}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={`${basePath}/today`}
      signUpFallbackRedirectUrl={`${basePath}/today`}
      signInForceRedirectUrl={`${basePath}/today`}
      signUpForceRedirectUrl={`${basePath}/today`}
      routerPush={to => setLocation(stripBase(to))}
      routerReplace={to => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Router />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return <TooltipProvider><WouterRouter base={basePath}><>{clerkPubKey ? <ClerkRoutes /> : <QueryClientProvider client={queryClient}><Router /></QueryClientProvider>}</></WouterRouter><Toaster /></TooltipProvider>;
}

export default App;
