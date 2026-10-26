/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const os = require('node:os')
const path = require('node:path')

const { isOtelBridgeAvailable, otelPackages } = require('#agentlib/otel/bridge-available.js')

test('derives the bridge package list from @opentelemetry dependencies', () => {
  assert.ok(otelPackages.length > 0, 'there should be at least one @opentelemetry dependency')
  assert.ok(otelPackages.every((p) => p.startsWith('@opentelemetry')))
})

test('resolves the bridge packages from within the agent install', () => {
  // Anchored at this repo, the agent's own @opentelemetry/* deps resolve.
  assert.equal(isOtelBridgeAvailable(__filename), true)
})

test('reports the bridge as unavailable from an unrelated location', () => {
  // The OS temp directory has no node_modules with @opentelemetry/*.
  const anchor = path.join(os.tmpdir(), 'not-a-real-project', 'anchor.js')
  assert.equal(isOtelBridgeAvailable(anchor), false)
})
