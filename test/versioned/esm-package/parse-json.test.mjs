/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test'
import assert from 'node:assert'
import helper from '../../lib/agent_helper.js'
import shimmer from '../../../lib/shimmer.js'
import parseJsonInstrumentation from './parse-json-instrumentation.mjs'

shimmer.registerInstrumentation({
  moduleName: 'parse-json',
  type: 'generic',
  isEsm: true,
  onRequire: parseJsonInstrumentation
})

test('ESM Package Instrumentation', async (t) => {
  const agent = helper.instrumentMockedAgent()
  const { default: parseJson, JSONError } = await import('parse-json')

  t.after(() => {
    helper.unloadAgent(agent)
  })

  await t.test('should register instrumentation on default exports', () => {
    const output = parseJson(JSON.stringify({ foo: 'bar' }))
    assert.ok(output.isInstrumented, 'should have the field we add in our test instrumentation')
  })

  await t.test('should register instrumentation on named exports', () => {
    const err = new JSONError('test me')
    assert.ok(err.isInstrumented, 'JSONError should be instrumented')
  })
})
