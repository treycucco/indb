import { useMemo, useRef } from 'preact/hooks';

/**
 * This hook is like `useMemo` except that you can call a teardown method before the new memo value
 * is created.
 *
 * This is favorable to `useEffect` because `useEffect` is called on the first render, but after.
 * So if you want to always have a value (like useMemo) but you need to do a cleanup when the value
 * is replaced, use `useLifecycleMemo`.
 *
 * This method does not include `init` in the dependencies array, so that value does not need to be
 * stable, as with useMemo.
 *
 * To get good linting on this hook with `eslint`, add it to the `additionalHooks` key of the
 * `react-hooks/exhaustive-deps` configuration in .eslintrc:
 *
 *
 * ```
 * "react-hooks/exhaustive-deps": [
 *   "error",
 *   {
 *     "additionalHooks": "^(useLifecycleMemo)$"
 *   }
 * ]
 * ```
 */
const useLifecycleMemo = <T>(
  init: () => [data: T, teardown: () => void],
  dependencies: unknown[],
): T => {
  const lastTeardownRef = useRef<() => void>();
  return useMemo(() => {
    lastTeardownRef.current?.();
    const [data, teardown] = init();
    lastTeardownRef.current = teardown;
    return data;
    // We're requiring deps to be passed in to the hook, but we don't require init to be stable, so
    // we are intentionally disabling the lint check next line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
};

export default useLifecycleMemo;
