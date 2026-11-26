import { describe, expect, it } from 'vitest';
import { countActionableInvitations } from './invitation.selectors';

describe('actionable invitation badges', () => {
  it('does not show pending work when all invitations belong to archived projects', () => {
    expect(countActionableInvitations([
      { status: 'PENDING', projectArchived: true },
      { status: 'ACCEPTED', projectArchived: false },
    ])).toBe(0);
  });

  it('counts only pending invitations in active projects', () => {
    expect(countActionableInvitations([
      { status: 'PENDING', projectArchived: false },
      { status: 'PENDING', projectArchived: true },
      { status: 'EXPIRED', projectArchived: false },
      { status: 'DECLINED', projectArchived: false },
      { status: 'CANCELLED', projectArchived: false },
    ])).toBe(1);
  });

  it('supports an empty list and older responses without the archive flag', () => {
    expect(countActionableInvitations([])).toBe(0);
    expect(countActionableInvitations([{ status: 'PENDING' }])).toBe(1);
  });
});
