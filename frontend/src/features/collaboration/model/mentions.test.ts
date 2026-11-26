import { describe, expect, it } from 'vitest';
import { retainedMentions } from './mentions';

const members = [{ id: 'self', name: 'An' }, { id: 'other', name: 'Linh' }];
describe('mention selection', () => {
  it('removes self mentions even when selected previously', () => {
    expect(retainedMentions('@An @Linh', ['self', 'other'], members, 'self')).toEqual(['other']);
  });
  it('releases a selected member when their name is deleted', () => {
    expect(retainedMentions('@', ['other'], members, 'self')).toEqual([]);
    expect(retainedMentions('@Linh ', ['other'], members, 'self')).toEqual(['other']);
  });
  it('keeps mentions with punctuation but rejects a longer name prefix', () => {
    expect(retainedMentions('@Linh, xem giúp', ['other'], members)).toEqual(['other']);
    expect(retainedMentions('@LinhAnh', ['other'], members)).toEqual([]);
  });
});
