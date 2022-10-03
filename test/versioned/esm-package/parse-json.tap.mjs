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

  t.before(() => {
    agent = helper.instrumentMockedAgent()
  })

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  t.test('should register our instrumentation', async (t) => {
    const { default: parseJson, JSONError } = await import('parse-json')
    // console.log('test', JSONError)

    const output = parseJson(JSON.stringify({ foo: 'bar' }))
    t.ok(output.isInstrumented, 'should have the field we add in our test instrumentation')

    try {
      parseJson('{\n\t"foo": true,\n}')
      t.error(new Error('function succeeded'), 'parseJson should have thrown but did not')
    } catch (err) {
      t.ok(err instanceof JSONError, 'should still be our original error type')
      t.ok(err.isInstrumented, 'should have been altered by our instrumentation')
    }

    t.end()
  })
})
