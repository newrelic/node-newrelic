/*
 * Copyright 2023 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const sinon = require('sinon')
module.exports = (sandbox = sinon) => {
  return {
    getMetric: sandbox.stub(),
    getOrCreateMetric: sandbox.stub().returns({ incrementCallCount: sandbox.stub() })
  }
}
