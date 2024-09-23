/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const { Writable } = require('node:stream')

const helper = require('../../lib/agent_helper')

test('does not strip message property', (t, end) => {
  const logs = []
  const dest = new Writable({
    write(chunk, encoding, callback) {
      logs.push(JSON.parse(chunk.toString()))
      callback()
    }
  })
  const agent = helper.instrumentMockedAgent({
    application_logging: {
      forwarding: { enabled: true }
    }
  })
  const pinoHttp = require('pino-http')
  const { logger } = pinoHttp({ level: 'info' }, dest)

  helper.runInTransaction(agent, (tx) => {
    logger.info({ message: 'keep me', message2: 'me too' })

    tx.end()

    const agentLogs = agent.logs.getEvents()
    assert.equal(agentLogs.length, 1, 'aggregator should have recorded log')
    assert.equal(logs.length, 1, 'stream should have recorded one log')

    // Verify the destination stream log has the expected properties.
    const expectedLog = logs[0]
    assert.equal(expectedLog.message, 'keep me')
    assert.equal(expectedLog.message2, 'me too')

    const foundLog = agentLogs[0]()

    // The forwarded log should have all of the extra keys that were logged to
    // the destination stream by Pino.
    const expectedKeys = Object.keys(expectedLog).filter(
      (k) => ['level', 'time', 'pid', 'hostname'].includes(k) === false // Omit baseline Pino keys.
    )
    for (const key of expectedKeys) {
      assert.equal(Object.hasOwn(foundLog, key), true, `forwarded log should have key "${key}"`)
      assert.equal(
        foundLog[key],
        expectedLog[key],
        `"${key}" key should have same value as original log`
      )
    }

    end()
  })
})
