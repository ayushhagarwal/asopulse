import {
  createContext,
  type ReactNode,
  startTransition,
  useContext,
  useEffect,
  useState,
} from "react";

export type SessionUser = {
  id: string;
  username: string;
};

export type WorkspaceProject = {
  id: string;
  name: string;
  appId: string;
  appName: string;
  storefront: string;
  createdAt: string;
};

type WorkspaceContextValue = {
  projects: WorkspaceProject[];
  selectedProject: WorkspaceProject;
  selectedProjectId: string;
  setSelectedProjectId: (projectId: string) => void;
  user: SessionUser;
};

const STORAGE_KEY = "asopulse:selected-project:v1";
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  children,
  projects,
  user,
}: {
  children: ReactNode;
  projects: WorkspaceProject[];
  user: SessionUser;
}) {
  const [selectedProjectId, setSelectedProjectIdState] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? projects[0]?.id ?? "";
    } catch {
      return projects[0]?.id ?? "";
    }
  });

  useEffect(() => {
    if (!projects.some((project) => project.id === selectedProjectId)) {
      setSelectedProjectIdState(projects[0]?.id ?? "");
    }
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    localStorage.setItem(STORAGE_KEY, selectedProjectId);
  }, [selectedProjectId]);

  const selectedProject =
    projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  if (!selectedProject) throw new Error("WorkspaceProvider requires at least one project");

  return (
    <WorkspaceContext.Provider
      value={{
        projects,
        selectedProject,
        selectedProjectId: selectedProject.id,
        setSelectedProjectId(projectId) {
          startTransition(() => setSelectedProjectIdState(projectId));
        },
        user,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return value;
}
