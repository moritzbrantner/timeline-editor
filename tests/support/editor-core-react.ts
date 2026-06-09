import * as React from "react";

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
  const [internalValue, setInternalValue] = React.useState(defaultValue);
  const controlled = value !== undefined;
  const currentValue = controlled ? value : internalValue;
  const currentValueRef = React.useRef(currentValue);
  const onChangeRef = React.useRef(onChange);
  currentValueRef.current = currentValue;
  onChangeRef.current = onChange;

  const setValue = React.useCallback(
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
