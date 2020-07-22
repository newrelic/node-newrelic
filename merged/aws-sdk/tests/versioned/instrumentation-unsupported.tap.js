/*
* Copyright 2020 New Relic Corporation. All rights reserved.
* SPDX-License-Identifier: Apache-2.0
*/
'use strict'

const tap = require('tap')
const utils = require('@newrelic/test-utilities')
const instrumentationHelper = require('../../lib/instrumentation-helper')
utils.assert.extendTap(tap)

tap.test('instrumentation is supported', (t) => {
  t.autoend()

  let helper = null
  let AWS = null

  t.beforeEach((done) => {
    helper = utils.TestAgent.makeInstrumented()
    helper.registerInstrumentation({
      moduleName: 'aws-sdk',
      type: 'conglomerate',
      onRequire: require('../../lib/instrumentation')
    })
    AWS = require('aws-sdk')
    done()
  })

  t.afterEach((done) => {
    helper && helper.unload()
    AWS = null
    done()
  })

  t.test('AWS should not have newrelic attributes', (t) => {
    t.assert(!AWS.__NR_instrumented, '__NR_instrumented not present')
    t.end()
  })

  t.test('instrumentation supported function', (t) => {
    t.assert(
      !instrumentationHelper.instrumentationSupported(AWS),
      'instrumentationSupported returned false'
    )
    t.end()
  })
})
