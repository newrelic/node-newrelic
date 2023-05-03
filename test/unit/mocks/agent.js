/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const { EventEmitter } = require('events')
const util = require('util')
const sinon = require('sinon')

module.exports = (sandbox = sinon.stub()) => {
  function MockAgent(config) {
    EventEmitter.call(this)
    this.config = config
  }

  MockAgent.prototype.recordSupportability = sandbox.stub()
  MockAgent.prototype.start = sandbox.stub()
  util.inherits(MockAgent, EventEmitter)
  return MockAgent
}
