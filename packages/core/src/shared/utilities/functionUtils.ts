/*!
 * Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { sleep, Timeout } from './timeoutUtils'

/**
 * Creates a function that always returns a 'shared' Promise.
 *
 * This is essentially a 'debounce' or unkeyed 'lock' for async functions.
 *
 * #### Example
 * ```ts
 * const foo = shared(async () => console.log('bar'))
 *
 * const f1 = foo() // 'bar' is printed
 * const f2 = foo() // nothing happens
 *
 * // Same event loop, equal by reference
 * assert.strictEqual(f1, f2)
 *
 * // The promise is not freed until the next event loop
 * await f1
 *
 * const f3 = foo() // 'bar' is printed
 * assert.notStrictEqual(f1, f3)
 * ```
 */
export function shared<T, U extends any[]>(fn: (...args: U) => Promise<T>): (...args: U) => Promise<T> {
    let p: Promise<T> | undefined

    return (...args) => (p ??= fn(...args).finally(() => (p = undefined)))
}

/**
 * Special-case of `memoize`: creates a function that is executed only once.
 */
export function once<T>(fn: () => T): () => T {
    let val: T
    let ran = false

    return () => (ran ? val : ((val = fn()), (ran = true), val))
}

/**
 * Special-case of `memoize`: creates a function that runs only if the args
 * changed versus the previous invocation.
 *
 * @note See note on {@link memoize}
 *
 * TODO: use lib?: https://github.com/anywhichway/nano-memoize
 */
export function onceChanged<T, U extends any[]>(fn: (...args: U) => T): (...args: U) => T {
    let val: T
    let ran = false
    let prevArgs = ''

    return (...args) =>
        ran && prevArgs === args.map(String).join(':')
            ? val
            : ((val = fn(...args)), (ran = true), (prevArgs = args.map(String).join(':')), val)
}

/**
 * Creates a new function that stores the result of a call.
 *
 * @note This uses an extremely simple mechanism for creating keys from parameters.
 * Objects are effectively treated as a single key, while primitive values will behave as
 * expected with a few very uncommon exceptions.
 *
 * TODO: use lib?: https://github.com/anywhichway/nano-memoize
 */
export function memoize<T, U extends any[]>(fn: (...args: U) => T): (...args: U) => T {
    const cache: { [key: string]: T | undefined } = {}

    return (...args) => (cache[args.map(String).join(':')] ??= fn(...args))
}

/**
 * Prevents a function from executing until {@link delay} milliseconds have passed
 * since the last invocation. Omitting {@link delay} will not execute the function for
 * a single event loop.
 *
 * Multiple calls made during the debounce window will receive references to the
 * same Promise similar to {@link shared}. The window will also be 'rolled', delaying
 * the execution by another {@link delay} milliseconds.
 */
export function debounce<T>(cb: () => T | Promise<T>, delay: number = 0): () => Promise<T> {
    let timeout: Timeout | undefined
    let promise: Promise<T> | undefined

    return () => {
        timeout?.refresh()

        return (promise ??= new Promise<T>((resolve, reject) => {
            timeout = new Timeout(delay)
            timeout.onCompletion(async () => {
                timeout = promise = undefined
                try {
                    resolve(await cb())
                } catch (err) {
                    reject(err)
                }
            })
        }))
    }
}

/**
 *
 * Similar to {@link debounce}, but allows the function to be cancelled and allow callbacks to pass function parameters.
 */
export function cancellableDebounce<T, U extends any[]>(
    cb: (...args: U) => T | Promise<T>,
    delay: number = 0
): { promise: (...args: U) => Promise<T>; cancel: () => void } {
    let timeout: Timeout | undefined
    let promise: Promise<T> | undefined

    const cancel = (): void => {
        if (timeout) {
            timeout.cancel()
            timeout = undefined
            promise = undefined
        }
    }

    return {
        promise: (...arg) => {
            timeout?.refresh()

            return (promise ??= new Promise<T>((resolve, reject) => {
                timeout = new Timeout(delay)
                timeout.onCompletion(async () => {
                    timeout = promise = undefined
                    try {
                        resolve(await cb(...arg))
                    } catch (err) {
                        reject(err)
                    }
                })
            }))
        },
        cancel: cancel,
    }
}

/**
 * Executes the given function, retrying if it throws.
 *
 * @param opts - if no opts given, defaults are used
 */
export async function withRetries<T>(
    fn: () => Promise<T>,
    opts?: { maxRetries?: number; delay?: number; backoff?: number }
): Promise<T> {
    const maxRetries = opts?.maxRetries ?? 3
    const delay = opts?.delay ?? 0
    const backoff = opts?.backoff ?? 1

    let retryCount = 0
    let latestDelay = delay
    while (true) {
        try {
            return await fn()
        } catch (err) {
            retryCount++
            if (retryCount >= maxRetries) {
                throw err
            }
            if (latestDelay > 0) {
                await sleep(latestDelay)
                latestDelay = latestDelay * backoff
            }
        }
    }
}
