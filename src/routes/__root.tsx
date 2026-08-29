import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { BrandNav } from "@/components/BrandNav";
import { PrimaryBottomNav } from "@/components/PrimaryBottomNav";
import { MiniPlayer } from "@/components/MiniPlayer";
import { SessionBridge } from "@/components/SessionBridge";
import { VehicleTelemetryBridge } from "@/components/VehicleTelemetryBridge";
import { InstallPrompt } from "@/components/InstallPrompt";
import { TelemetryBridge } from "@/components/TelemetryBridge";
import { SiteFooter } from "@/components/SiteFooter";
import { CookieConsent } from "@/components/CookieConsent";
import { DynamicDriveSessionBridge } from "@/components/DynamicDriveSessionBridge";
import { DynamicDriveTrialBridge } from "@/components/DynamicDriveTrialBridge";
import { EntitlementEnforcer } from "@/components/EntitlementEnforcer";
import { AccountProvider } from "@/lib/account/AccountProvider";
import { EntitlementsProvider } from "@/lib/entitlements/EntitlementsProvider";
import { useSessionSelector } from "@/lib/store/session-store";

import appCss from "../styles.css?url";
import { reportRuntimeError } from "../lib/runtime-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportRuntimeError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ELCAMOSO · Your EV. Your Sound. More Emotion." },
      {
        name: "description",
        content: "Motion-responsive sound experiences for electric cars.",
      },
      { name: "theme-color", content: "#000000" },
      { name: "apple-mobile-web-app-title", content: "ELCAMOSO" },
      { property: "og:site_name", content: "ELCAMOSO" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Outfit:wght@200;300;400&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/svg+xml", href: "/icon.svg" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const showMiniPlayer = pathname !== "/";

  return (
    <QueryClientProvider client={queryClient}>
      <AccountProvider>
        <EntitlementsProvider>
          <div id="app-root" className="flex min-h-svh flex-col">
            <SessionBridge />
            <EntitlementEnforcer />
            <DynamicDriveSessionBridge />
            <DynamicDriveTrialBridge />
            <VehicleTelemetryBridge />
            <TelemetryBridge />
            <BrandNav />
            <AppChrome showMiniPlayer={showMiniPlayer} />
            <CookieConsent />
          </div>
        </EntitlementsProvider>
      </AccountProvider>
    </QueryClientProvider>
  );
}

function AppChrome({ showMiniPlayer }: { showMiniPlayer: boolean }) {
  const { safetyMode } = useSessionSelector((snap) => ({ safetyMode: snap.safetyMode }));
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onDrive = pathname === "/drive" || pathname.startsWith("/drive/");
  const hideTop = safetyMode && onDrive;
  const padTop = hideTop
    ? "pt-[env(safe-area-inset-top,0px)]"
    : "pt-[calc(3.5rem+env(safe-area-inset-top,0px))] sm:pt-[calc(4rem+env(safe-area-inset-top,0px))]";
  const padBottom =
    safetyMode && onDrive
      ? "pb-[env(safe-area-inset-bottom,0px)]"
      : "pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] md:pb-0";

  return (
    <div className={`flex flex-1 flex-col ${padTop} ${padBottom}`}>
      {showMiniPlayer ? <MiniPlayer /> : null}
      <InstallPrompt />
      <div className="flex-1">
        <Outlet />
      </div>
      <SiteFooter />
      <PrimaryBottomNav />
    </div>
  );
}
