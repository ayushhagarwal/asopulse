import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { type ReactNode, useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { storefrontName } from "../lib/storefronts";
import { useWorkspace } from "../lib/workspace";
import { AppPickerDialog, type ProjectSelection } from "./AppPickerDialog";
import { CommandPalette } from "./CommandPalette";
import {
  BookmarkIcon,
  ChevronDownIcon,
  CloseIcon,
  CommandIcon,
  MenuIcon,
  PulseIcon,
  SearchIcon,
  SettingsIcon,
} from "./icons";
import { Logo } from "./Logo";
import { MarketPickerDialog } from "./MarketPickerDialog";
import { PulseField } from "./PulseField";

const navigation = [
  { to: "/pulse", label: "Pulse", icon: PulseIcon },
  { to: "/discover", label: "Discover", icon: SearchIcon },
  { to: "/watchlist", label: "Track", icon: BookmarkIcon },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { projects, selectedProject, selectedProjectId, setSelectedProjectId, user } =
    useWorkspace();
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [marketPickerOpen, setMarketPickerOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const createProject = useMutation({
    mutationFn: ({ app, storefront }: ProjectSelection) =>
      apiRequest<{ data: { id: string } }>("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: app.name,
          appId: app.appId,
          appName: app.name,
          storefront,
          iconUrl: app.iconUrl,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      }),
    onSuccess: async ({ data }) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelectedProjectId(data.id);
      setPickerOpen(false);
    },
  });
  const createMarket = useMutation({
    mutationFn: (storefront: string) =>
      apiRequest<{ project: { id: string }; created: boolean }>(
        `/projects/${selectedProject.id}/markets`,
        {
          method: "POST",
          body: JSON.stringify({ storefront }),
        },
      ),
    onSuccess: async ({ project }) => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
      setSelectedProjectId(project.id);
      setMarketPickerOpen(false);
    },
  });
  const logout = useMutation({
    mutationFn: () => apiRequest<{ loggedOut: true }>("/auth/logout", { method: "POST" }),
    onSuccess: async () => {
      setAccountOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setMobileNavOpen(false);
        setPickerOpen(false);
        setMarketPickerOpen(false);
        setAccountOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="app-shell">
      <PulseField />
      <button
        type="button"
        className="mobile-menu icon-button"
        aria-label="Open navigation"
        onClick={() => setMobileNavOpen(true)}
      >
        <MenuIcon />
      </button>
      <AnimatePresence>
        {mobileNavOpen ? (
          <motion.button
            className="mobile-nav-backdrop"
            aria-label="Close navigation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileNavOpen(false)}
          />
        ) : null}
      </AnimatePresence>
      <aside className={`sidebar ${mobileNavOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand-row">
          <Logo />
          <button
            type="button"
            className="sidebar-close icon-button"
            aria-label="Close menu"
            onClick={() => setMobileNavOpen(false)}
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <nav aria-label="Primary navigation">
          {navigation.map((item) => {
            const selected = pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`nav-item ${selected ? "is-selected" : ""}`}
                onClick={() => setMobileNavOpen(false)}
              >
                <item.icon size={21} />
                <span>{item.label}</span>
                {selected ? (
                  <motion.i
                    layoutId="active-nav"
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>
        <Link
          to="/settings"
          className={`nav-item settings-link ${pathname === "/settings" ? "is-selected" : ""}`}
          onClick={() => setMobileNavOpen(false)}
        >
          <SettingsIcon size={21} />
          <span>Settings</span>
          {pathname === "/settings" ? <motion.i layoutId="active-nav" /> : null}
        </Link>
      </aside>
      <div className="workspace">
        <header className="utility-bar">
          <button type="button" className="app-selector" onClick={() => setPickerOpen(true)}>
            <span className="app-icon">
              {selectedProject.iconUrl ? (
                <img src={selectedProject.iconUrl} alt="" />
              ) : (
                selectedProject.name.slice(0, 1)
              )}
            </span>
            <span>{selectedProject.name}</span>
            <ChevronDownIcon size={16} />
          </button>
          <button
            type="button"
            className="store-selector"
            onClick={() => setMarketPickerOpen(true)}
          >
            <span>{storefrontName(selectedProject.storefront)} · App Store</span>
            <ChevronDownIcon size={16} />
          </button>
          <button type="button" className="command-trigger" onClick={() => setCommandOpen(true)}>
            <SearchIcon size={18} />
            <span>Search or type a command…</span>
            <kbd>
              <CommandIcon size={13} /> K
            </kbd>
          </button>
          <button
            type="button"
            className="avatar"
            aria-label="Open account menu"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen((value) => !value)}
          >
            {user.username.slice(0, 1).toUpperCase()}
          </button>
          {accountOpen ? (
            <div className="account-menu">
              <strong>{user.username}</strong>
              <Link to="/settings" onClick={() => setAccountOpen(false)}>
                Settings
              </Link>
              <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
                {logout.isPending ? "Signing out…" : "Sign out"}
              </button>
            </div>
          ) : null}
        </header>
        <main id="main-content" className="content">
          {children}
        </main>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <AppPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        projects={projects}
        currentProjectId={selectedProjectId}
        creating={createProject.isPending}
        onCreateProject={(selection) => createProject.mutate(selection)}
        onSelectProject={(projectId) => {
          setSelectedProjectId(projectId);
          setPickerOpen(false);
        }}
      />
      <MarketPickerDialog
        open={marketPickerOpen}
        onClose={() => setMarketPickerOpen(false)}
        projects={projects}
        currentProject={selectedProject}
        creating={createMarket.isPending}
        onCreate={(storefront) => createMarket.mutate(storefront)}
        onSelect={(projectId) => {
          setSelectedProjectId(projectId);
          setMarketPickerOpen(false);
        }}
      />
    </div>
  );
}
