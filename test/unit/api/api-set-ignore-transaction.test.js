'use strict'

const tap = require('tap')
const API = require('../../../api')
const helper = require('../../lib/agent_helper')

tap.test('Agent API - setIgnoreTransaction', (t) => {
  t.autoend()

  let agent = null
  let api = null

  const TEST_URL = '/test/path/31337'
  const NAME = 'WebTransaction/Uri/test/path/31337'

  t.beforeEach((done) => {
    agent = helper.loadMockedAgent()
    api = new API(agent)

    done()
  })

  t.afterEach((done) => {
    helper.unloadAgent(agent)
    agent = null

    done()
  })

  t.test("exports a transaction ignoring function", (t) => {
    t.ok(api.setIgnoreTransaction)
    t.type(api.setIgnoreTransaction, 'function')

    t.end()
  })

  t.test("should mark the transaction ignored", (t) => {
    agent.on('transactionFinished', function(transaction) {
      transaction.finalizeNameFromUri(TEST_URL, 200)

      t.equal(transaction.ignore, true)

      t.end()
    })

    helper.runInTransaction(agent, function(transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL
      transaction.verb = 'GET'

      api.setIgnoreTransaction(true)

      transaction.end()
    })
  })

  t.test("should force a transaction to not be ignored", (t) => {
    api.addIgnoringRule('^/test/.*')

    agent.on('transactionFinished', function(transaction) {
      transaction.finalizeNameFromUri(TEST_URL, 200)

      t.equal(transaction.ignore, false)

      t.end()
    })

    helper.runInTransaction(agent, function(transaction) {
      agent.tracer.createSegment(NAME)
      transaction.url = TEST_URL
      transaction.verb = 'GET'

      api.setIgnoreTransaction(false)

      transaction.end()
    })
  })
})
