/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const helper = require('../../../lib/agent_helper')
const agent = helper.instrumentMockedAgent()
process.once('unhandledRejection', function () {})

helper.runInTransaction(agent, function (transaction) {
  Promise.reject('test rejection')

  setTimeout(function () {
    assert.equal(transaction.exceptions.length, 0)
    // eslint-disable-next-line no-process-exit
    process.exit(0)
  }, 15)
})
