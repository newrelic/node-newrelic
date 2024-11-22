/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const configurator = require('../../../lib/config')
const Agent = require('../../../lib/agent')

test('Agent should not connect to collector in serverless mode', (t, end) => {
  const config = configurator.initialize({
    app_name: 'node.js Tests',
    serverless_mode: {
      enabled: true
    },
    logging: {
      level: 'trace'
    }
  })
  const agent = new Agent(config)

  // Immediately fail if connect is called
  agent.collector.connect = () => assert.fail('Agent should not attempt to connect')

  agent.start((error, returned) => {
    assert.equal(error, undefined, 'started without error')
    assert.ok(returned, 'got boot configuration')
    assert.equal(returned.agent_run_id, undefined, 'should not have a run ID')
    assert.equal(agent.config.run_id, undefined, 'should not have run ID set in configuration')

    agent.stop((error) => {
      assert.equal(error, undefined, 'should have shut down without issue')
      end()
    })
  })
})
