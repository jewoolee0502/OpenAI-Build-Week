import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

import { imagineLabApi } from '@/api/client';
import type { GameProject } from '@/api/types';

interface AppStateValue {
  projects: GameProject[];
  isLoading: boolean;
  errorMessage: string | null;
  refreshChildProjects: () => Promise<void>;
  createProject: (prompt: string) => Promise<GameProject>;
  editProject: (projectId: string, instruction: string) => Promise<GameProject>;
  publishProject: (projectId: string) => Promise<{ project: GameProject; publicUrl: string }>;
  unpublishProject: (projectId: string) => Promise<void>;
  clearError: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something unexpected happened.';
}

export function AppProvider({ children }: PropsWithChildren) {
  const [projects, setProjects] = useState<GameProject[]>([]);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const childRefresh = useRef<Promise<void> | null>(null);

  const begin = useCallback(() => {
    setErrorMessage(null);
    setPendingOperations((current) => current + 1);
  }, []);

  const end = useCallback(() => {
    setPendingOperations((current) => Math.max(0, current - 1));
  }, []);

  const fail = useCallback((error: unknown) => {
    setErrorMessage(messageFrom(error));
  }, []);

  const replaceProject = useCallback((project: GameProject) => {
    setProjects((current) => {
      const existing = current.some((candidate) => candidate.id === project.id);
      if (!existing) return [project, ...current];
      return current.map((candidate) => (candidate.id === project.id ? project : candidate));
    });
  }, []);

  const refreshChildProjects = useCallback(async () => {
    if (childRefresh.current) return childRefresh.current;
    begin();
    const operation = imagineLabApi
      .listChildProjects()
      .then(setProjects)
      .catch((error: unknown) => {
        fail(error);
        throw error;
      })
      .finally(() => {
        end();
        childRefresh.current = null;
      });
    childRefresh.current = operation;
    return operation;
  }, [begin, end, fail]);

  const createProject = useCallback(
    async (prompt: string) => {
      begin();
      try {
        const response = await imagineLabApi.createProject(prompt);
        replaceProject(response.project);
        return response.project;
      } catch (error) {
        fail(error);
        throw error;
      } finally {
        end();
      }
    },
    [begin, end, fail, replaceProject],
  );

  const editProject = useCallback(
    async (projectId: string, instruction: string) => {
      begin();
      try {
        const response = await imagineLabApi.editProject(projectId, instruction);
        replaceProject(response.project);
        return response.project;
      } catch (error) {
        fail(error);
        throw error;
      } finally {
        end();
      }
    },
    [begin, end, fail, replaceProject],
  );

  const publishProject = useCallback(
    async (projectId: string) => {
      begin();
      try {
        const response = await imagineLabApi.publishProject(projectId);
        replaceProject(response.project);
        return response;
      } catch (error) {
        fail(error);
        throw error;
      } finally {
        end();
      }
    },
    [begin, end, fail, replaceProject],
  );

  const unpublishProject = useCallback(
    async (projectId: string) => {
      begin();
      try {
        await imagineLabApi.unpublishProject(projectId);
        setProjects((current) =>
          current.map((project) =>
            project.id === projectId
              ? { ...project, status: 'draft', publishedVersionId: null }
              : project,
          ),
        );
      } catch (error) {
        fail(error);
        throw error;
      } finally {
        end();
      }
    },
    [begin, end, fail],
  );

  const clearError = useCallback(() => setErrorMessage(null), []);

  const value = useMemo<AppStateValue>(
    () => ({
      projects,
      isLoading: pendingOperations > 0,
      errorMessage,
      refreshChildProjects,
      createProject,
      editProject,
      publishProject,
      unpublishProject,
      clearError,
    }),
    [
      projects,
      pendingOperations,
      errorMessage,
      refreshChildProjects,
      createProject,
      editProject,
      publishProject,
      unpublishProject,
      clearError,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext);
  if (!value) throw new Error('useAppState must be used inside AppProvider.');
  return value;
}
