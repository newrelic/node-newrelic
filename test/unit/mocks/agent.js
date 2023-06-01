/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const sinon = require('sinon')
module.exports = (sandbox = sinon, metricsMock) => {
  function MockAgent(config) {
    this.config = config
    this.config.app_name = 'Unit Test App'
    this.metrics = metricsMock
  }
  MockAgent.prototype.start = sandbox.stub()
  MockAgent.prototype.recordSupportability = sandbox.stub()
  MockAgent.prototype.once = sandbox.stub()
  return MockAgent
}
