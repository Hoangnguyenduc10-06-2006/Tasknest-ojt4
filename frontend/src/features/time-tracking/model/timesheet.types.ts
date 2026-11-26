export interface ManualTimeInput {
  startedAt: string;
  endedAt: string;
  reason: string;
}
export interface TimeRevision {
  id: number;
  entryId: number;
  taskId: number;
  taskTitle: string;
  projectName: string;
  beforeStartedAt: string;
  beforeEndedAt: string;
  afterStartedAt: string;
  afterEndedAt: string;
  reason: string;
  revisedAt: string;
}
