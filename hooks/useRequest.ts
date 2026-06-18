/**
 * 通用异步请求 Hook
 * 封装 loading / error / data 状态，适配 .NET 10 接口错误结构
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface UseRequestState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseRequestOptions<T> {
  /** 是否在 mount 时立即执行，默认 true */
  immediate?: boolean;
  /** 请求成功回调 */
  onSuccess?: (data: T) => void;
  /** 请求失败回调 */
  onError?: (error: string) => void;
}

interface UseRequestReturn<T> extends UseRequestState<T> {
  /** 手动触发请求 */
  run: (...args: unknown[]) => Promise<void>;
  /** 重置状态 */
  reset: () => void;
}

/**
 * @example
 * const { data, loading, error, run } = useRequest(() => wordApi.getWordStats());
 */
export function useRequest<T>(
  requestFn: (...args: unknown[]) => Promise<T>,
  options: UseRequestOptions<T> = {},
): UseRequestReturn<T> {
  const { immediate = true, onSuccess, onError } = options;

  const [state, setState] = useState<UseRequestState<T>>({
    data: null,
    loading: immediate,
    error: null,
  });

  // 使用 ref 避免闭包捕获旧的回调
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  // 防止组件卸载后 setState
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(
    async (...args: unknown[]) => {
      if (!mountedRef.current) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await requestFn(...args);

        if (!mountedRef.current) return;
        setState({ data: result, loading: false, error: null });
        onSuccessRef.current?.(result);
      } catch (err) {
        if (!mountedRef.current) return;
        const msg = err instanceof Error ? err.message : "请求失败，请稍后重试";

        setState((prev) => ({ ...prev, loading: false, error: msg }));
        onErrorRef.current?.(msg);
      }
    },

    [requestFn],
  );

  useEffect(() => {
    if (immediate) {
      run();
    }
    // 仅在 mount 时执行一次
  }, [immediate, run]);

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, run, reset };
}
