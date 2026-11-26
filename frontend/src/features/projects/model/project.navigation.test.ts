import { describe, expect, it } from 'vitest';
import { findProject } from './project.navigation';
import { MY_PROJECTS_MOCK_DATA } from '../mocks/projects.mock';

describe('project navigation', () => {
  it('does not map old mock aliases to another project', () => {
    expect(findProject(MY_PROJECTS_MOCK_DATA, 'p1')).toBeUndefined();
    expect(findProject(MY_PROJECTS_MOCK_DATA, 'brand-refresh')).toBeUndefined();
  });
  it('uses IDs even when two projects have identical names containing TaskNest', () => {
    const projects = [
      { ...MY_PROJECTS_MOCK_DATA[0], id: 'mobile', name: 'TaskNest Mobile' },
      { ...MY_PROJECTS_MOCK_DATA[0], id: 'desktop', name: 'TaskNest Mobile' },
    ];
    expect(findProject(projects, 'mobile')?.id).toBe('mobile');
    expect(findProject(projects, 'desktop')?.id).toBe('desktop');
    expect(findProject(projects, 'tasknest-mobile')).toBeUndefined();
  });
});
