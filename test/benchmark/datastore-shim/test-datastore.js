/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

class TestDatastore {
  testOp(cb) {
    setImmediate(cb)
  }

  testQuery(query, cb) {
    setImmediate(cb)
  }

  testBatch(query, cb) {
    setImmediate(cb)
  }
}

module.exports = TestDatastore
