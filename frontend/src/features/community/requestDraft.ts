import {
  requestDraftStorageKey,
  writeStoredDraft,
  removeStoredDraft,
} from './draftStorage';
export type RequestDraft = {
  title: string;
  description: string;
  skills: string;
  minimum: string;
  maximum: string;
  delivery: string;
  reference: string;
  images?: string[];
};
const fields: (keyof Omit<RequestDraft, 'images'>)[] = [
  'title',
  'description',
  'skills',
  'minimum',
  'maximum',
  'delivery',
  'reference',
];
const key = requestDraftStorageKey;
export function readRequestDraft(user: string): RequestDraft | null {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(key(user)) ?? 'null',
    );
    if (
      !value ||
      typeof value !== 'object' ||
      !fields.every(
        (field) =>
          typeof (value as Record<string, unknown>)[field] === 'string',
      )
    )
      return null;
    const draft = Object.fromEntries(fields.map(field => [field, (value as RequestDraft)[field]])) as Omit<RequestDraft, 'images'>;
    const images = (value as RequestDraft).images;
    if (Array.isArray(images) && images.length <= 4 && images.every(image => typeof image === 'string' && image.length <= 1398104))
      return { ...draft, images };
    return draft;
  } catch {
    return null;
  }
}
export function saveRequestDraft(user: string, draft: RequestDraft) {
  writeStoredDraft(key(user), draft);
}
export function clearRequestDraft(user: string) {
  removeStoredDraft(key(user));
}
