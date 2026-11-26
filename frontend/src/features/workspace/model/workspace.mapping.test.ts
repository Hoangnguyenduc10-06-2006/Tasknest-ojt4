import { describe, expect, it } from 'vitest';
import { mapWorkspace, type RawWorkspace } from '../api/workspace.api';
const raw: RawWorkspace = {
  members: [
    { projectId: 7, id: 'real-user', name: 'Tên từ Identity', role: 'Manager' },
  ],
  tasks: [
    {
      id: 42,
      projectId: 7,
      title: 'Nhiệm vụ thật',
      description: null,
      assigneeId: 'real-user',
      priority: 'HIGH',
      status: 'IN_REVIEW',
      startsOn: '2026-10-28',
      deadlineOn: '2026-10-30',
      estimatedSeconds: 7200,
      spentSeconds: null,
      blocked: true,
      blockedReason: 'Chờ phản hồi',
      version: 4,
      createdAt: '2026-10-28T00:00:00Z',
    },
  ],
  timeEntries: [],
  invitations: [],
  joinRequests: [],
};
describe('workspace server mapping', () => {
  it('uses real IDs, directory display names and current-user identity', () => {
    const data = mapWorkspace(raw, 'real-user');
    expect(data.tasks[0]).toMatchObject({
      id: '42',
      projectId: '7',
      version: 4,
      status: 'REVIEW',
      estimatedHours: 2,
      assignee: {
        id: 'real-user',
        name: 'Tên từ Identity',
        isCurrentUser: true,
      },
    });
  });
  it('does not turn the blocked flag into a workflow state or hidden hours into zero', () => {
    const task = mapWorkspace(raw, 'another-user').tasks[0];
    expect(task.status).toBe('REVIEW');
    expect(task.isBlocked).toBe(true);
    expect(task.spentHours).toBeUndefined();
    expect(task.assignee.isCurrentUser).toBe(false);
  });
  it('an empty database stays empty without injecting preview rows', () => {
    expect(
      mapWorkspace(
        {
          tasks: [],
          members: [],
          timeEntries: [],
          invitations: [],
          joinRequests: [],
        },
        'user',
      ),
    ).toEqual({
      customerProgress: [],
      tasks: [],
      members: [],
      timeEntries: [],
      invitations: [],
      joinRequests: [],
    });
  });
  it('propagates projectArchived flag on invitations and joinRequests for read-only guard', () => {
    const mapped = mapWorkspace(
      {
        tasks: [],
        members: [],
        timeEntries: [],
        invitations: [
          {
            id: 10,
            projectId: 7,
            projectName: 'Dự án lưu trữ',
            inviterName: 'Chủ dự án',
            inviterRole: 'Owner',
            status: 'PENDING',
            createdAt: '2026-10-28T00:00:00Z',
            expiresAt: '2026-11-04T00:00:00Z',
            projectArchived: true,
          },
        ],
        joinRequests: [
          {
            id: 11,
            projectId: 7,
            projectName: 'Dự án lưu trữ',
            reason: 'Xin tham gia',
            status: 'PENDING',
            createdAt: '2026-10-28T00:00:00Z',
            projectArchived: true,
          },
        ],
      },
      'real-user',
    );
    expect(mapped.invitations[0].projectArchived).toBe(true);
    expect(mapped.joinRequests[0].projectArchived).toBe(true);
  });
});
