import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AppPickerDialog, type SelectedApp } from "./AppPickerDialog";
import { CommandPalette } from "./CommandPalette";
import { Logo } from "./Logo";
import { PulseField } from "./PulseField";
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

const navigation = [
  { to: "/pulse", label: "Pulse", icon: PulseIcon },
  { to: "/discover", label: "Discover", icon: SearchIcon },
  { to: "/watchlist", label: "Watchlist", icon: BookmarkIcon },
] as const;

export function AppShell() {
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState<SelectedApp>(() => {
    try {
      const saved = localStorage.getItem("asopulse:selected-app:v1");
      return saved
        ? (JSON.parse(saved) as SelectedApp)
        : {
            appId: "demo-clarity",
            name: "Clarity — Daily Journal",
            developer: "ASOpulse Demo",
            iconUrl: "",
          };
    } catch {
      return {
        appId: "demo-clarity",
        name: "Clarity — Daily Journal",
        developer: "ASOpulse Demo",
        iconUrl: "",
      };
    }
  });
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((value) => !value);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="app-shell">
      <PulseField />
      <button
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
          <button className="app-selector" onClick={() => setPickerOpen(true)}>
            <span className="app-icon">
              {selectedApp.iconUrl ? (
                <img src={selectedApp.iconUrl} alt="" />
              ) : (
                selectedApp.name.slice(0, 1)
              )}
            </span>
            <span>{selectedApp.name}</span>
            <ChevronDownIcon size={16} />
          </button>
          <button className="store-selector">
            <span>US · App Store</span>
            <ChevronDownIcon size={16} />
          </button>
          <button className="command-trigger" onClick={() => setCommandOpen(true)}>
            <SearchIcon size={18} />
            <span>Search or type a command…</span>
            <kbd>
              <CommandIcon size={13} /> K
            </kbd>
          </button>
          <button className="avatar" aria-label="Open account menu">
            A
          </button>
        </header>
        <main id="main-content" className="content">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      <AppPickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(app) => {
          setSelectedApp(app);
          localStorage.setItem("asopulse:selected-app:v1", JSON.stringify(app));
        }}
      />
    </div>
  );
}
