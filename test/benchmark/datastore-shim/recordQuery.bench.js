'use strict'

const shared = require('./shared')

const testItems = shared.makeSuite('recordOperation')
const agent = testItems.agent
const suite = testItems.suite

const instrumentedDS = shared.getTestDatastore(agent, true)
const uninstrumentedDS = shared.getTestDatastore(agent, false)


suite.add({
  name: 'instrumented operation',
  async: true,
  fn: function(agent, done) {
    instrumentedDS.testQuery('test', done)
  }
})
suite.add({
  name: 'uninstrumented operation',
  async: true,
  fn: function(agent, done) {
    uninstrumentedDS.testQuery('test', done)
  }
})

suite.run()
