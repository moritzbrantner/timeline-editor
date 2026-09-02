import { useCallback, useRef, useState } from "react";

export type ControllableEditorStateOptions<T> = {
  value?: T;
  defaultValue: T | (() => T);
  onChange?: (value: T) => void;
};

export function useControllableEditorState<T>({
  value,
  defaultValue,
  onChange,
}: ControllableEditorStateOptions<T>): [T, (value: T | ((previous: T) => T)) => void] {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;
  const currentValueRef = useRef(currentValue);
  const onChangeRef = useRef(onChange);
  currentValueRef.current = currentValue;
  onChangeRef.current = onChange;

  const setValue = useCallback(
    (nextValue: T | ((previous: T) => T)) => {
      const previousValue = currentValueRef.current;
      const resolved =
        typeof nextValue === "function"
          ? (nextValue as (previous: T) => T)(previousValue)
          : nextValue;

      if (!controlled) {
        setInternalValue(resolved);
      }
      onChangeRef.current?.(resolved);
    },
    [controlled],
  );

  return [currentValue, setValue];
}
