/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const sinon = require('sinon')

module.exports = (sandbox = sinon) => {
  return {
    traceEnabled: sandbox.stub().returns(true),
    trace: sandbox.stub(),
    info: sandbox.stub(),
    debug: sandbox.stub(),
    warn: sandbox.stub(),
    error: sandbox.stub()
  }
}
