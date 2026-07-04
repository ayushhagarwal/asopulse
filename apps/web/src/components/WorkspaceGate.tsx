import { useQuery } from "@tanstack/react-query";
import { Outlet } from "@tanstack/react-router";
import {
  BootSplash,
  OfflineSplash,
  OwnerLoginPage,
  OwnerSetupPage,
  ProjectOnboardingPage,
} from "../features/boot/BootScreens";
import { apiRequest } from "../lib/api";
import { type SessionUser, type WorkspaceProject, WorkspaceProvider } from "../lib/workspace";
import { AppShell } from "./AppShell";

type SessionResponse = {
  configured: boolean;
  authenticated: boolean;
  user: SessionUser | null;
};

type ProjectsResponse = {
  data: WorkspaceProject[];
};

export function WorkspaceGate() {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: () => apiRequest<SessionResponse>("/auth/session"),
    retry: false,
  });

  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => apiRequest<ProjectsResponse>("/projects"),
    enabled: session.data?.authenticated === true,
    retry: false,
  });

  const sessionData = session.data;
  const projectData = projects.data?.data;

  if (session.isLoading) return <BootSplash />;
  if (session.isError) return <OfflineSplash />;
  if (!sessionData?.configured) return <OwnerSetupPage />;
  if (!sessionData.authenticated || !sessionData.user) return <OwnerLoginPage />;
  if (projects.isLoading) return <BootSplash message="Loading your projects…" />;
  if (projects.isError) return <OfflineSplash />;
  if ((projectData?.length ?? 0) === 0) return <ProjectOnboardingPage />;

  return (
    <WorkspaceProvider projects={projectData ?? []} user={sessionData.user}>
      <AppShell>
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  );
}
