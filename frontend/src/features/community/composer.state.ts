import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';

export type Value =
  | string
  | number
  | boolean
  | string[]
  | Record<string, number>;
export type Field = { value: Value; initial: Value; persist: boolean };
export type Status = { busy: boolean; error: string };
type ComposerContextValue = {
  formId: string;
  draft: Record<string, unknown>;
  field: (name: string, value: Value, initial: Value, persist: boolean) => void;
  status: (value: Status) => void;
  complete: () => void;
};
export const ComposerContext = createContext<ComposerContextValue | null>(null);

export function useComposerField(
  name: string,
  initial: string,
  persist?: boolean,
): readonly [string, Dispatch<SetStateAction<string>>];
export function useComposerField(
  name: string,
  initial: boolean,
  persist?: boolean,
): readonly [boolean, Dispatch<SetStateAction<boolean>>];
export function useComposerField<T extends Value>(
  name: string,
  initial: T,
  persist?: boolean,
): readonly [T, Dispatch<SetStateAction<T>>];
export function useComposerField<T extends Value>(
  name: string,
  initial: T,
  persist = true,
) {
  const composer = useContext(ComposerContext);
  const [value, setValue] = useState<T>(() => {
    const saved = persist ? composer?.draft[name] : undefined;
    const compatible = Array.isArray(initial)
      ? Array.isArray(saved) && saved.every((item) => typeof item === 'string')
      : typeof initial === 'object'
        ? saved !== null &&
          typeof saved === 'object' &&
          !Array.isArray(saved) &&
          Object.keys(initial).every(
            (key) =>
              typeof (saved as Record<string, unknown>)[key] === 'number',
          )
        : typeof saved === typeof initial;
    return compatible ? (saved as T) : initial;
  });
  const report = composer?.field;
  const initialKey = JSON.stringify(initial);
  useLayoutEffect(() => {
    report?.(name, value, JSON.parse(initialKey) as T, persist);
  }, [report, name, value, initialKey, persist]);
  return [value, setValue] as const;
}
export function useComposerStatus(busy: boolean, error = '') {
  const composer = useContext(ComposerContext);
  const report = composer?.status;
  useLayoutEffect(() => {
    report?.({ busy, error });
  }, [report, busy, error]);
  return composer;
}
