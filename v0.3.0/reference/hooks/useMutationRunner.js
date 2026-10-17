import * as React from "react";
import { useToast } from "../context/ToastContext.jsx";
import { usePending } from "../components/utils.js";

/** @typedef {import("../context/ToastContext.jsx").ToastOptions} ToastOptions */

/**
 * @template T
 * @typedef {Object} AttemptMessages
 * @property {string} [ok] - success toast; defaults to the hook's `ok`
 * @property {(error: unknown) => string} fail - builds the error toast from the failure value
 * @property {(value: T) => void} [onOk] - called with the mutation's payload on success
 * @property {ToastOptions} [toast] - per-call overrides of the success toast's duration/delay
 */

/**
 * @typedef {Object} MutationRunnerDefaults
 * @property {string} [ok] - default success message (default "Saved.")
 * @property {number} [duration] - success toast auto-dismiss in ms (default 2000)
 * @property {number} [delay] - success toast debounce in ms (default 500)
 */

/**
 * The `[success, valueOrError]` tuple every MutableTable method resolves to. Multi-step
 * flows may return their own `[false, message]` so each step keeps its own wording.
 */
/** @template T @typedef {[boolean, (T | Error | string)?]} MutationResult */

/**
 * Pending tracking + toast reporting for the `[ok, valueOrError]` convention of
 * `MutableTable`, so a row component writes one line per mutation instead of the
 * guard / await / unwrap / toast dance.
 *
 * `attempt(fn, msgs)` runs `fn` under `usePending`, toasts `msgs.fail(error)` when the
 * tuple reports failure or `fn` throws, and toasts `msgs.ok` otherwise. A `fn` that
 * returns `undefined` (the usual `mutations?.update(...)` when config is invalid) is a
 * silent no-op. `run` is the raw `usePending` runner for multi-step flows that don't fit
 * a single tuple.
 *
 * @param {MutationRunnerDefaults} [defaults]
 * @returns {{
 *   pending: boolean,
 *   run: <T>(fn: () => Promise<T>) => Promise<T>,
 *   attempt: <T>(fn: () => Promise<MutationResult<T> | undefined> | undefined, msgs: AttemptMessages<T>) => Promise<void>,
 * }}
 */
export function useMutationRunner({ ok: defaultOk = "Salvo com Sucesso.", duration = 2000, delay = 500 } = {}) {
   const { error: toastError, toast } = useToast();
   const [pending, run] = usePending();

   const attempt = React.useCallback(
      /**
       * @template T
       * @param {() => Promise<MutationResult<T> | undefined> | undefined} fn
       * @param {AttemptMessages<T>} msgs
       */
      (fn, { ok = defaultOk, fail, onOk, toast: toastOptions }) =>
         run(async () => {
            /** @type {MutationResult<T> | undefined} */
            let result;
            try {
               result = await fn();
            } catch (err) {
               return toastError(fail(err));
            }
            if (!result) return;

            const [success, value] = result;
            if (!success) return toastError(fail(value));

            toast(ok, { duration, delay, ...toastOptions });
            onOk?.(/** @type {T} */ (value));
         }),
      [run, toast, toastError, defaultOk, duration, delay],
   );

   return { pending, run, attempt };
}
