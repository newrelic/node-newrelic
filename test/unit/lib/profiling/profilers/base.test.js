/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const test = require('node:test')
const assert = require('node:assert')
const BaseProfiler = require('#agentlib/profiling/profilers/base.js')

test.beforeEach((ctx) => {
  ctx.nr = {
    profiler: new BaseProfiler({ enabled: true, name: 'TestProfiler' })
  }
})

test('should construct base profiler', (t) => {
  const { profiler } = t.nr
  assert.equal(profiler.enabled, true)
  assert.equal(profiler.name, 'TestProfiler')
})

test('empty constructor', () => {
  const profiler = new BaseProfiler()
  assert.equal(profiler.enabled, false)
  assert.equal(profiler.name, undefined)
})

test('should throw error when start is called', (t) => {
  const { profiler } = t.nr
  assert.throws(() => {
    profiler.start()
  })
})

test('should throw error when stop is called', (t) => {
  const { profiler } = t.nr
  assert.throws(() => {
    profiler.stop()
  })
})

test('should throw error when collect is called', (t) => {
  const { profiler } = t.nr
  assert.throws(() => {
    profiler.collect()
  })
})
