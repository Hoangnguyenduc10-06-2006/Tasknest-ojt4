// eligibleTasks excludes cancelled tasks. No tasks means progress is undefined.
export function getCompletionPercentage(completedTasks: number, eligibleTasks: number): number | null {
  return eligibleTasks === 0 ? null : Math.round((completedTasks / eligibleTasks) * 100);
}
