/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const EventEmitter = require('node:events')
const HttpsSubscriber = require('#agentlib/subscribers/core/https/server.js')
const helper = require('#testlib/agent_helper.js')
const loggerMock = require('../../../../mocks/logger')

test('instrument should not throw when ServerResponse is missing', (t) => {
  const agent = helper.loadMockedAgent()
  const logger = loggerMock()
  const subscriber = new HttpsSubscriber({ agent, logger })
  t.after(() => {
    subscriber.disable()
    subscriber.unsubscribe()
    helper.unloadAgent(agent)
  })
  // `https` has no `ServerResponse`/`IncomingMessage` of its own.
  const https = { createServer: () => {}, Server: { prototype: new EventEmitter() } }

  assert.doesNotThrow(() => subscriber.instrument(https))
})
