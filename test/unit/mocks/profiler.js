/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const sinon = require('sinon')
const DEFAULT_DATA = Buffer.from('test-data')

function createProfiler({ sandbox = sinon, data = DEFAULT_DATA } = {}) {
  return {
    start: sandbox.stub(),
    stop: sandbox.stub(),
    collect: sandbox.stub().resolves(data)
  }
}

module.exports = createProfiler
