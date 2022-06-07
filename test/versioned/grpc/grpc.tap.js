/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../lib/agent_helper')

tap.test('grpc client instrumentation', (t) => {
  t.autoend()

  let agent
  // let grpc

  t.beforeEach(() => {
    agent = helper.instrumentMockedAgent()
    // grpc = require('@grpc/grpc-js')
  })

  t.afterEach(() => {
    agent && helper.unloadAgent(agent)
    agent = null
    Object.keys(require.cache).forEach((key) => {
      if (/@grpc\/grpc-js/.test(key)) {
        delete require.cache[key]
      }
    })
  })

  t.test('smoke test', (t) => {
    t.end()
  })
})
