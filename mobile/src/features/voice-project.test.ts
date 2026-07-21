import { describe, expect, it, vi } from 'vitest';

import type { GameProject } from '@/api/types';
import { createProjectFromVoice } from './voice-project';

describe('voice-first project creation', () => {
  it('creates the project immediately from the received transcript', async () => {
    const project = { id: 'project-1' } as GameProject;
    const createProject = vi.fn(async () => project);

    await expect(createProjectFromVoice('  A cloud golf game  ', createProject)).resolves.toBe(project);
    expect(createProject).toHaveBeenCalledOnce();
    expect(createProject).toHaveBeenCalledWith('A cloud golf game');
  });

  it('asks the child to try again when no usable idea was heard', async () => {
    const createProject = vi.fn<() => Promise<GameProject>>();

    await expect(createProjectFromVoice('  a ', createProject)).rejects.toThrow('Hold Milo and try again');
    expect(createProject).not.toHaveBeenCalled();
  });
});
