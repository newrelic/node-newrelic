/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const shared = require('./shared')

const suite = shared.makeSuite('recordQuery')

var testDatastore = null

function makeInit(instrumented) {
  return function setDatastore(agent) {
    testDatastore = shared.getTestDatastore(agent, instrumented)
  }
}

suite.add({
  name: 'instrumented operation in transaction',
  async: true,
  agent: {},
  initialize: makeInit(true),
  runInTransaction: true,
  fn: function(agent, done) {
    testDatastore.testQuery('test', done)
  }
})

suite.add({
  name: 'instrumented operation',
  async: true,
  initialize: makeInit(true),
  agent: {},
  fn: function(agent, done) {
    testDatastore.testQuery('test', done)
  }
})

suite.add({
  name: 'uninstrumented operation',
  initialize: makeInit(false),
  async: true,
  fn: function(agent, done) {
    testDatastore.testQuery('test', done)
  }
})

suite.run()
