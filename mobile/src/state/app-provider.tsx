import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { ApiError, apiBaseUrl, imagineLabApi } from '@/api/client';
import type { AuthenticatedImageSource, BuilderDraft, ChildAccount, GameProject, GuestSession } from '@/api/types';
import { childSessionStorage } from '@/state/child-session-storage';

interface AppStateValue {
  child: ChildAccount | null;
  projects: GameProject[];
  isLoading: boolean;
  isRestoringSession: boolean;
  errorMessage: string | null;
  joinAsGuest: () => Promise<ChildAccount>;
  refreshChildProjects: () => Promise<void>;
  createProject: (prompt: string) => Promise<GameProject>;
  editProject: (projectId: string, instruction: string) => Promise<GameProject>;
  publishProject: (projectId: string) => Promise<{ project: GameProject; publicUrl: string }>;
  unpublishProject: (projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  loadBuilderDraft: (projectId: string) => Promise<BuilderDraft | null>;
  saveBuilderDraft: (projectId: string, draft: BuilderDraft) => Promise<BuilderDraft>;
  generateCreativePlan: (projectId: string) => Promise<BuilderDraft>;
  generateSceneVariants: (projectId: string) => Promise<BuilderDraft>;
  testBuilderGame: (projectId: string) => Promise<GameProject>;
  transcribeAudio: (uri: string) => Promise<string>;
  projectImageSource: (project: GameProject) => AuthenticatedImageSource | null;
  clearError: () => void;
}

const AppStateContext = createContext<AppStateValue | null>(null);

function messageFrom(error: unknown): string {
  return error instanceof Error ? error.message : 'Something unexpected happened.';
}

export function AppProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<GuestSession | null>(null);
  const [projects, setProjects] = useState<GameProject[]>([]);
  const [pendingOperations, setPendingOperations] = useState(0);
  const [isRestoringSession, setIsRestoringSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const childRefresh = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;
    void childSessionStorage
      .load()
      .then((storedSession) => {
        if (!active) return;
        if (!storedSession) {
          setIsRestoringSession(false);
          return;
        }

        setSession(storedSession);
        setIsRestoringSession(false);
        void imagineLabApi
          .getMe(storedSession.token)
          .then(async (user) => {
            const refreshedSession = { token: storedSession.token, user };
            await childSessionStorage.save(refreshedSession);
            if (active) setSession(refreshedSession);
          })
          .catch(async (error: unknown) => {
            if (!active) return;
            if (error instanceof ApiError && error.statusCode === 401) {
              await childSessionStorage.clear();
              setSession(null);
              return;
            }
            setErrorMessage(messageFrom(error));
          });
      })
      .catch((error: unknown) => {
        if (active) setErrorMessage(messageFrom(error));
      })
      .finally(() => {
        if (active) setIsRestoringSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const requireToken = useCallback(() => {
    if (!session?.token) throw new Error('Join as a guest before creating a game.');
    return session.token;
  }, [session?.token]);

  const joinAsGuest = useCallback(async () => {
    begin();
    try {
      const nextSession = await imagineLabApi.createGuest();
      await childSessionStorage.save(nextSession);
      setSession(nextSession);
      return nextSession.user;
    } catch (error) {
      fail(error);
      throw error;
    } finally {
      end();
    }
  }, [begin, end, fail]);

  const replaceProject = useCallback((project: GameProject) => {
    setProjects((current) => {
      const existing = current.some((candidate) => candidate.id === project.id);
      if (!existing) return [project, ...current];
      return current.map((candidate) => (candidate.id === project.id ? project : candidate));
    });
  }, []);

  const refreshChildProjects = useCallback(async () => {
    if (!session?.token) return;
    if (childRefresh.current) return childRefresh.current;
    begin();
    const token = session.token;
    const operation = Promise.all([
      imagineLabApi.listChildProjects(token),
      imagineLabApi.getMe(token),
    ])
      .then(async ([nextProjects, user]) => {
        const refreshedSession = { token, user };
        setProjects(nextProjects);
        setSession(refreshedSession);
        await childSessionStorage.save(refreshedSession);
      })
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
  }, [begin, end, fail, session?.token]);

  const createProject = useCallback(
    async (prompt: string) => {
      begin();
      try {
        const response = await imagineLabApi.createProject(requireToken(), prompt);
        replaceProject(response.project);
        return response.project;
      } catch (error) {
        fail(error);
        throw error;
      } finally {
        end();
      }
    },
    [begin, end, fail, replaceProject, requireToken],
  );

  const editProject = useCallback(
    async (projectId: string, instruction: string) => {
      begin();
      try {
        const response = await imagineLabApi.editProject(requireToken(), projectId, instruction);
        replaceProject(response.project);
        return response.project;
      } catch (error) {
        fail(error);
        throw error;
      } finally {
        end();
      }
    },
    [begin, end, fail, replaceProject, requireToken],
  );

  const publishProject = useCallback(
    async (projectId: string) => {
      begin();
      try {
        const response = await imagineLabApi.publishProject(requireToken(), projectId);
        replaceProject(response.project);
        return response;
      } catch (error) {
        fail(error);
        throw error;
      } finally {
        end();
      }
    },
    [begin, end, fail, replaceProject, requireToken],
  );

  const unpublishProject = useCallback(
    async (projectId: string) => {
      begin();
      try {
        await imagineLabApi.unpublishProject(requireToken(), projectId);
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
    [begin, end, fail, requireToken],
  );

  const transcribeAudio = useCallback(
    (uri: string) => imagineLabApi.transcribeAudio(requireToken(), uri),
    [requireToken],
  );

  const projectImageSource = useCallback((project: GameProject): AuthenticatedImageSource | null => {
    if (!session?.token || !apiBaseUrl || !project.profileImageUrl) return null;
    return {
      uri: `${apiBaseUrl}${project.profileImageUrl}`,
      headers: { Authorization: `Bearer ${session.token}` },
    };
  }, [session?.token]);

  const deleteProject = useCallback(async (projectId: string) => {
    begin();
    try {
      await imagineLabApi.deleteProject(requireToken(), projectId);
      setProjects((current) => current.filter((project) => project.id !== projectId));
    } catch (error) { fail(error); throw error; } finally { end(); }
  }, [begin, end, fail, requireToken]);

  const loadBuilderDraft = useCallback(
    (projectId: string) => imagineLabApi.loadBuilderDraft(requireToken(), projectId),
    [requireToken],
  );

  const saveBuilderDraft = useCallback(
    (projectId: string, draft: BuilderDraft) => imagineLabApi.saveBuilderDraft(requireToken(), projectId, draft),
    [requireToken],
  );

  const generateCreativePlan = useCallback(async (projectId: string) => {
    begin();
    try {
      return await imagineLabApi.generateCreativePlan(requireToken(), projectId);
    } catch (error) {
      fail(error);
      throw error;
    } finally {
      end();
    }
  }, [begin, end, fail, requireToken]);

  const generateSceneVariants = useCallback(
    (projectId: string) => imagineLabApi.generateSceneVariants(requireToken(), projectId),
    [requireToken],
  );

  const testBuilderGame = useCallback(async (projectId: string) => {
    begin();
    try {
      const response = await imagineLabApi.testBuilderGame(requireToken(), projectId);
      replaceProject(response.project);
      return response.project;
    } catch (error) { fail(error); throw error; } finally { end(); }
  }, [begin, end, fail, replaceProject, requireToken]);

  const clearError = useCallback(() => setErrorMessage(null), []);

  const value = useMemo<AppStateValue>(
    () => ({
      child: session?.user ?? null,
      projects,
      isLoading: pendingOperations > 0,
      isRestoringSession,
      errorMessage,
      joinAsGuest,
      refreshChildProjects,
      createProject,
      editProject,
      publishProject,
      unpublishProject,
      deleteProject,
      loadBuilderDraft,
      saveBuilderDraft,
      generateCreativePlan,
      generateSceneVariants,
      testBuilderGame,
      transcribeAudio,
      projectImageSource,
      clearError,
    }),
    [
      session?.user,
      projects,
      pendingOperations,
      isRestoringSession,
      errorMessage,
      joinAsGuest,
      refreshChildProjects,
      createProject,
      editProject,
      publishProject,
      unpublishProject,
      deleteProject,
      loadBuilderDraft,
      saveBuilderDraft,
      generateCreativePlan,
      generateSceneVariants,
      testBuilderGame,
      transcribeAudio,
      projectImageSource,
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
