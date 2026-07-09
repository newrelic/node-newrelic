/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// CPU-heavy fixture for the source-mapping integration test, compiled
// (tsc --sourceMap) to hot.js + hot.js.map so frames can be checked for
// resolution back to this .ts. Two functions: one per test (see the test).

export function burnMappedCpu(durationMs: number): number {
  const end: number = Date.now() + durationMs
  let acc: number = 0
  while (Date.now() < end) {
    for (let i = 0; i < 100_000; i++) {
      acc += Math.sqrt(i) * Math.sin(i)
    }
  }
  return acc
}

export function burnUnmappedCpu(durationMs: number): number {
  const end: number = Date.now() + durationMs
  let acc: number = 0
  while (Date.now() < end) {
    for (let i = 0; i < 100_000; i++) {
      acc += Math.cbrt(i) * Math.cos(i)
    }
  }
  return acc
}
