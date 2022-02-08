/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')

tap.test('next-context', (t) => {
  t.autoend()

  let helper
  // TODO let server

  t.beforeEach(() => {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: './context',
      type: 'datastore',
      onResolved: require('../../lib/context')
    })

    // TODO require server
    // TODO set up server
  })

  t.afterEach(() => {
    helper && helper.unload()
    helper = null

    // TODO close server
  })

  t.test('records middleware', async (t) => {
    t.autoend()

    // TODO
  })
})
