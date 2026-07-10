import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { CheckIcon, SearchIcon } from "../../components/icons";
import { Logo } from "../../components/Logo";
import { apiRequest } from "../../lib/api";
import { STOREFRONTS, type StorefrontCode, storefrontName } from "../../lib/storefronts";

type SearchResult = {
  appId: string;
  name: string;
  developer: string;
  iconUrl: string;
  averageRating: number;
  ratingCount: number;
};

type AppSearchResponse = { data: SearchResult[] };

export function BootSplash({ message = "Loading your workspace…" }: { message?: string }) {
  return (
    <div className="boot-shell">
      <motion.div
        className="boot-panel boot-panel-center"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Logo />
        <p>{message}</p>
      </motion.div>
    </div>
  );
}

export function OfflineSplash() {
  return (
    <div className="boot-shell">
      <motion.div
        className="boot-panel boot-panel-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <Logo />
        <h1>ASOpulse needs the local API.</h1>
        <p>Start the API and database services, then refresh this page.</p>
      </motion.div>
    </div>
  );
}

export function OwnerSetupPage() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("");
  const setup = useMutation({
    mutationFn: () =>
      apiRequest<{ configured: boolean }>("/auth/setup", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  return (
    <div className="boot-shell">
      <motion.form
        className="boot-panel"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={(event) => {
          event.preventDefault();
          setup.mutate();
        }}
      >
        <Logo />
        <div className="boot-copy">
          <h1>Create the owner workspace.</h1>
          <p>Single-owner mode keeps V1 simple. Your credentials stay on your infrastructure.</p>
        </div>
        <label className="boot-field">
          <span>Username</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="boot-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 10 characters"
          />
        </label>
        {setup.isError ? (
          <p className="inline-error">
            The owner account could not be created. Check the API logs and try again.
          </p>
        ) : null}
        <button className="primary-button boot-button" type="submit" disabled={setup.isPending}>
          {setup.isPending ? "Creating…" : "Create owner"}
        </button>
      </motion.form>
    </div>
  );
}

export function OwnerLoginPage() {
  const queryClient = useQueryClient();
  const [username, setUsername] = useState("owner");
  const [password, setPassword] = useState("");
  const login = useMutation({
    mutationFn: () =>
      apiRequest<{ user: { id: string; username: string } }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["session"] });
    },
  });

  return (
    <div className="boot-shell">
      <motion.form
        className="boot-panel"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={(event) => {
          event.preventDefault();
          login.mutate();
        }}
      >
        <Logo />
        <div className="boot-copy">
          <h1>Sign in to ASOpulse.</h1>
          <p>Pick up where the last observation left off.</p>
        </div>
        <label className="boot-field">
          <span>Username</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} />
        </label>
        <label className="boot-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Your owner password"
          />
        </label>
        {login.isError ? (
          <p className="inline-error">Those credentials didn’t match the owner workspace.</p>
        ) : null}
        <button className="primary-button boot-button" type="submit" disabled={login.isPending}>
          {login.isPending ? "Signing in…" : "Sign in"}
        </button>
      </motion.form>
    </div>
  );
}

export function ProjectOnboardingPage() {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [term, setTerm] = useState("");
  const [storefront, setStorefront] = useState<StorefrontCode>("US");

  useEffect(() => {
    const normalized = input.trim();
    const handle = window.setTimeout(() => {
      setTerm((current) => (current === normalized ? current : normalized));
    }, 180);

    return () => window.clearTimeout(handle);
  }, [input]);

  const search = useQuery({
    queryKey: ["bootstrap-app-search", term, storefront],
    queryFn: () =>
      apiRequest<AppSearchResponse>(
        `/apps/search?term=${encodeURIComponent(term)}&country=${storefront}`,
      ),
    enabled: term.length >= 2,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });
  const createProject = useMutation({
    mutationFn: (app: SearchResult) =>
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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  return (
    <div className="boot-shell">
      <motion.div
        className="boot-panel boot-panel-wide"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Logo />
        <div className="boot-copy">
          <h1>Choose the app you want to monitor.</h1>
          <p>Search {storefrontName(storefront)} and create your first ASOpulse workspace.</p>
        </div>
        <label className="boot-storefront-field">
          <span>App Store market</span>
          <select
            value={storefront}
            onChange={(event) => setStorefront(event.target.value as StorefrontCode)}
          >
            {STOREFRONTS.map((market) => (
              <option key={market.code} value={market.code}>
                {market.name}
              </option>
            ))}
          </select>
        </label>
        <form
          className="hero-search boot-search"
          onSubmit={(event) => {
            event.preventDefault();
            setTerm(input.trim());
          }}
        >
          <SearchIcon size={22} />
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="App name or developer"
          />
          <kbd>↵</kbd>
        </form>
        <div className="picker-results boot-results">
          {search.isFetching ? (
            <div className="picker-message">
              <i /> Searching the store…
            </div>
          ) : null}
          {search.isError ? (
            <div className="picker-message error-message">
              <strong>App search is unavailable.</strong>
              <span>Check that the ASOpulse API can reach Apple’s public Search API.</span>
            </div>
          ) : null}
          {!search.isFetching && !search.isError && term.length === 0 ? (
            <div className="picker-message">
              Search for the app you want to turn into a workspace.
            </div>
          ) : null}
          {!search.isFetching &&
          !search.isError &&
          term.length >= 2 &&
          (search.data?.data.length ?? 0) === 0 ? (
            <div className="picker-message">No matching App Store apps found yet.</div>
          ) : null}
          {search.data?.data.map((app) => (
            <button
              type="button"
              key={app.appId}
              className="app-result"
              onClick={() => createProject.mutate(app)}
              disabled={createProject.isPending}
            >
              <span className="result-icon">
                {app.iconUrl ? <img src={app.iconUrl} alt="" /> : app.name.slice(0, 1)}
              </span>
              <span>
                <strong>{app.name}</strong>
                <small>{app.developer}</small>
              </span>
              <span>
                {createProject.isPending ? (
                  <small>Creating…</small>
                ) : (
                  <>
                    <strong>{app.averageRating.toFixed(1)}</strong>
                    <small>{app.ratingCount.toLocaleString()} ratings</small>
                  </>
                )}
              </span>
            </button>
          ))}
        </div>
        {createProject.isSuccess ? (
          <p className="success-message">
            <CheckIcon size={15} /> Workspace created. Opening Pulse…
          </p>
        ) : null}
      </motion.div>
    </div>
  );
}
