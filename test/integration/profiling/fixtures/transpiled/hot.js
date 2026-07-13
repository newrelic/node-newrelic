"use strict";
/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.burnMappedCpu = burnMappedCpu;
exports.burnUnmappedCpu = burnUnmappedCpu;
exports.allocateMapped = allocateMapped;
exports.allocateUnmapped = allocateUnmapped;
// Fixture for the source-mapping integration tests, compiled (tsc --sourceMap)
// to hot.js + hot.js.map so frames can be checked for resolution back to this
// .ts. Two cpu-burn functions feed the CpuProfiler tests and two allocation
// functions feed the HeapProfiler tests — one function per test (see the test),
// because a function is only reliably captured as a named frame the first time
// it is profiled in a process.
function burnMappedCpu(durationMs) {
    const end = Date.now() + durationMs;
    let acc = 0;
    while (Date.now() < end) {
        for (let i = 0; i < 100_000; i++) {
            acc += Math.sqrt(i) * Math.sin(i);
        }
    }
    return acc;
}
function burnUnmappedCpu(durationMs) {
    const end = Date.now() + durationMs;
    let acc = 0;
    while (Date.now() < end) {
        for (let i = 0; i < 100_000; i++) {
            acc += Math.cbrt(i) * Math.cos(i);
        }
    }
    return acc;
}
// Allocate `count` retained arrays (~8 KB each on the V8 heap, not external) so the
// heap sampler captures allocation frames here. The caller must hold the return value
// until after collect(): the sampling profiler reports only live allocations.
function allocateMapped(count) {
    const retained = [];
    for (let i = 0; i < count; i++) {
        retained.push(new Array(1024).fill(i));
    }
    return retained;
}
function allocateUnmapped(count) {
    const retained = [];
    for (let i = 0; i < count; i++) {
        retained.push(new Array(1024).fill(i + 1));
    }
    return retained;
}
//# sourceMappingURL=hot.js.map