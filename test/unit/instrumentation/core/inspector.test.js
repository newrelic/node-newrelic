/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const helper = require('../../../lib/agent_helper')
const inspectorInstrumentation = require('../../../../lib/instrumentation/core/inspector')

tap.test('Inspector instrumentation', (t) => {
  let agent = null

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent()
    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    done()
  })

  t.test('should not throw when passed null for the module', (t) => {
    t.doesNotThrow(inspectorInstrumentation.bind(null, agent, null))
    t.end()
  })

  t.end()
})
