/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { EventEmitter } = require('events')
const util = require('util')
const sinon = require('sinon')
const HealthReporter = require('#agentlib/health-reporter.js')

module.exports = (sandbox = sinon, metricsMock) => {
  function MockAgent(config = {}) {
    EventEmitter.call(this)
    this.config = config
    this.config.app_name = 'Unit Test App'
    this.metrics = metricsMock
    this.healthReporter = new HealthReporter()
  }
  MockAgent.prototype.start = sandbox.stub()
  MockAgent.prototype.recordSupportability = sandbox.stub()
  util.inherits(MockAgent, EventEmitter)
  return MockAgent
}
