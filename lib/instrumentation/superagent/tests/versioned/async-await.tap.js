/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

utils(tap)

const EXTERNAL_NAME = /External\/newrelic.com(:443)*\//

tap.test('SuperAgent instrumentation with async/await', (t) => {
  t.autoend()

  let helper = null
  let request = null
  t.beforeEach(() => {
    helper = utils.TestAgent.makeInstrumented()
    const hooks = require('../../nr-hooks.js')
    hooks.forEach(helper.registerInstrumentation)
    request = require('superagent')
  })
  t.afterEach(() => {
    helper.unload()
  })

  t.test('should maintain transaction context with promises', (t) => {
    helper.runInTransaction(async function (tx) {
      await request.get('https://newrelic.com')

      t.transaction(tx)
      t.segments(tx.trace.root, [
        {
          name: EXTERNAL_NAME,
          children: [{ name: 'Callback: <anonymous>' }] // CB created by superagent
        }
      ])
      t.end()
    })
  })

  t.test('should not create segment if not in a transaction', async (t) => {
    await request.get('https://newrelic.com')
    t.notOk(helper.getTransaction(), 'should not have a transaction')
    t.end()
  })
})
