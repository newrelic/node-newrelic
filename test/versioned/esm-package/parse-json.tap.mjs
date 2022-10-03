/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import tap from 'tap'
import helper from '../../lib/agent_helper.js'
import shimmer from '../../../lib/shimmer.js'
import parseJsonInstrumentation from './parse-json-instrumentation.mjs'

shimmer.registerInstrumentation({
  moduleName: 'parse-json',
  type: 'generic',
  onRequire: parseJsonInstrumentation
})

tap.test('ESM Package Instrumentation', (t) => {
  t.autoend()

  let agent
  let parseJson
  let JSONError

  t.before(async () => {
    agent = helper.instrumentMockedAgent()
    ;({ default: parseJson, JSONError } = await import('parse-json'))
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  t.test('should register instrumentation on default exports', (t) => {
    const output = parseJson(JSON.stringify({ foo: 'bar' }))
    t.ok(output.isInstrumented, 'should have the field we add in our test instrumentation')
    t.end()
  })

  t.test('should register instrumentation on named exports', (t) => {
    const err = new JSONError('test me')
    t.ok(err.isInstrumented, 'JSONError should be instrumented')
    t.end()
  })
})
