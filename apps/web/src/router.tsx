import {
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";
import { WorkspaceGate } from "./components/WorkspaceGate";

const rootRoute = createRootRoute({ component: () => <Outlet /> });

const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  component: WorkspaceGate,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: lazyRouteComponent(() => import("./features/landing/LandingPage"), "LandingPage"),
});

const pulseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/pulse",
  component: lazyRouteComponent(() => import("./features/pulse/PulsePage"), "PulsePage"),
});

const discoverRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/discover",
  component: lazyRouteComponent(() => import("./features/discover/DiscoverPage"), "DiscoverPage"),
});

const watchlistRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/watchlist",
  component: lazyRouteComponent(
    () => import("./features/watchlist/WatchlistPage"),
    "WatchlistPage",
  ),
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/settings",
  component: lazyRouteComponent(() => import("./features/settings/SettingsPage"), "SettingsPage"),
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  appRoute.addChildren([pulseRoute, discoverRoute, watchlistRoute, settingsRoute]),
]);

export const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
