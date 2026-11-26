import { describe, expect, it } from 'vitest';
import { validateAvatar, validateProfile } from './profile.validation';

describe('profile draft validation', () => {
  it('requires a name without requiring optional job/bio fields', () => {
    expect(validateProfile({ fullName: ' An Linh ', jobTitle: '', bio: '' })).toEqual({});
    expect(validateProfile({ fullName: ' ', jobTitle: '', bio: '' })).toHaveProperty('fullName');
  });
  it('checks Unicode character limits', () => {
    expect(validateProfile({ fullName: '😀'.repeat(100), jobTitle: '', bio: '😀'.repeat(500) })).toEqual({});
    expect(validateProfile({ fullName: 'An Linh', jobTitle: 'a'.repeat(101), bio: 'a'.repeat(501) })).toMatchObject({ jobTitle: expect.any(String), bio: expect.any(String) });
  });
  it('rejects files that pretend to be images and files above 5 MB', async () => {
    expect(await validateAvatar(new File(['<svg></svg>'], 'fake.png', { type: 'image/png' }))).toBeDefined();
    expect(await validateAvatar(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' }))).toBeDefined();
    expect(await validateAvatar(new File([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], 'photo.png', { type: 'image/png' }))).toBeUndefined();
  });
});
