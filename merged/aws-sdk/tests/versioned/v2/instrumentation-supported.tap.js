/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const instrumentationHelper = require('../../../lib/v2/instrumentation-helper')
utils.assert.extendTap(tap)

tap.test('instrumentation is supported', (t) => {
  t.autoend()

  let helper = null
  let AWS = null

  t.beforeEach(() => {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'aws-sdk',
      type: 'conglomerate',
      onRequire: require('../../../lib/v2/instrumentation')
    })
    AWS = require('aws-sdk')
  })

  t.afterEach(() => {
    helper && helper.unload()
    AWS = null
  })

  t.test('AWS should be instrumented', (t) => {
    t.equal(
      AWS.NodeHttpClient.prototype.handleRequest.name,
      'wrappedHandleRequest',
      'AWS has a wrapped NodeHttpClient'
    )
    t.end()
  })

  t.test('instrumentation supported function', (t) => {
    t.ok(
      instrumentationHelper.instrumentationSupported(AWS),
      'instrumentationSupported returned true'
    )
    t.end()
  })
})
