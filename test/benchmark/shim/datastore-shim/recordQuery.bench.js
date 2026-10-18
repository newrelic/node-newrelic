/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const helper = require('#testlib/agent_helper.js')
const shared = require('./shared')

const suite = shared.makeSuite('recordQuery')

let testDatastore = null

function makeInit(instrumented) {
  return function setDatastore(agent) {
    testDatastore = shared.getTestDatastore(agent, instrumented)
  }
}

suite.add({
  name: 'instrumented operation in transaction',
  agent: {},
  initialize: makeInit(true),
  runInTransaction: true,
  fn: function () {
    return new Promise((resolve) => {
      testDatastore.testQuery('test', resolve)
    })
  }
})

suite.add({
  name: 'instrumented operation recorded at transaction end',
  agent: {},
  initialize: makeInit(true),
  fn: function (agent) {
    return helper.runInTransaction(agent, (transaction) => new Promise((resolve) => {
      testDatastore.testQuery('SELECT * FROM homes WHERE id = 1', () => {
        transaction.end()
        resolve()
      })
    }))
  }
})

suite.add({
  name: 'instrumented operation',
  initialize: makeInit(true),
  agent: {},
  fn: function () {
    return new Promise((resolve) => {
      testDatastore.testQuery('test', resolve)
    })
  }
})

suite.add({
  name: 'uninstrumented operation',
  initialize: makeInit(false),
  fn: function () {
    return new Promise((resolve) => {
      testDatastore.testQuery('test', resolve)
    })
  }
})

suite.run()
