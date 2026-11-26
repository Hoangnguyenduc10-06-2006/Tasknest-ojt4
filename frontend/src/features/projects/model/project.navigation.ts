import type { MyProjectItem } from './project.types';

export function findProject(projects: MyProjectItem[], id: string) {
  return projects.find(project => project.id === id);
}
