/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const NoOpExporter = require('#agentlib/otel/logs/no-op-exporter.js')

test('export fires callback', (t, end) => {
  const exporter = new NoOpExporter()
  exporter.export([], (code) => {
    assert.equal(code, 0)
    end()
  })
})

test('shutdown returns a success promise', async () => {
  const exporter = new NoOpExporter()
  await exporter.shutdown()
  assert.ok(true)
})
