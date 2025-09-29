/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const common = module.exports
const helper = require('../../lib/agent_helper')

/**
 * Defines the configuration for the Restify test utility.
 * @typedef {object} TestConfig
 * @property {object} t test context
 * @property {object} [assert=require('node:assert')] the assert library to use
 * @property {string} endpoint url endpoint
 * @property {string} [prefix='Restify'] prefix for the transaction name
 * @property {string} expectedName expected transaction name
 * @property {Function} [cb=t.end] callback function
 * @property {object} [requestOpts=null] request options
 * @property {object} agent New Relic agent instance
 * @property {object} server Restify server instance
 */

/**
 * Runs the Restify test.
 * @param {TestConfig} cfg The Restify test configuration object.
 */
common.runTest = function runTest(cfg) {
  const {
    assert = require('node:assert'),
    endpoint,
    agent,
    prefix = 'Restify',
    requestOpts = null,
    server
  } = cfg
  let { expectedName } = cfg
  expectedName = `WebTransaction/${prefix}/${expectedName}`

  agent.on('transactionFinished', (tx) => {
    assert.equal(tx.name, expectedName, 'should have correct name')
  })

  server.listen(() => {
    const port = server.address().port
    helper.makeGetRequest(`http://localhost:${port}${endpoint}`, requestOpts)
  })
}
