import type { GameProject } from '@/api/types';

export async function createProjectFromVoice(
  transcript: string,
  createProject: (prompt: string) => Promise<GameProject>,
): Promise<GameProject> {
  const idea = transcript.trim();
  if (idea.length < 3) {
    throw new Error('I could not hear enough of your idea. Hold Milo and try again.');
  }
  return createProject(idea);
}
