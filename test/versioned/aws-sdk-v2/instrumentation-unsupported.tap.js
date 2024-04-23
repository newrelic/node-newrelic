/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const instrumentationHelper = require('../../../lib/instrumentation/aws-sdk/v2/instrumentation-helper')

tap.test('instrumentation is not supported', (t) => {
  t.autoend()

  t.beforeEach((t) => {
    t.context.agent = helper.instrumentMockedAgent()
    t.context.AWS = require('aws-sdk')
  })

  t.afterEach((t) => {
    helper.unloadAgent(t.context.agent)
  })

  t.test('AWS should not be instrumented', (t) => {
    const { AWS } = t.context
    t.not(
      AWS.NodeHttpClient.prototype.handleRequest.name,
      'wrappedHandleRequest',
      'AWS does not have a wrapped NodeHttpClient'
    )
    t.end()
  })

  t.test('instrumentation supported function', (t) => {
    const { AWS } = t.context
    t.notOk(
      instrumentationHelper.instrumentationSupported(AWS),
      'instrumentationSupported returned false'
    )
    t.end()
  })
})
