/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

class TestDatastore {
  testOp(cb) {
    if (typeof cb === 'function') {
      return setImmediate(cb)
    }
    return cb || 'testOp'
  }

  testQuery(query, cb) {
    if (typeof cb === 'function') {
      return setImmediate(cb)
    }
    return cb || 'testQuery'
  }

  testBatch(query, cb) {
    if (typeof cb === 'function') {
      return setImmediate(cb)
    }
    return cb || 'testBatch'
  }
}

module.exports = TestDatastore
