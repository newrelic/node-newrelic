'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')

function QContext(t, agent) {
    this.agent = agent
    this.test = t
}

QContext.prototype.assertTransaction = function assertTransaction(transaction) {
    this.test.equal(this.agent.getTransaction(), transaction)
    this.test.equal(this.agent.getTransaction().trace.root.children.length, 0)
}

test('q.ninvoke', function testQNInvoke(t) {
  var agent = setupAgent(t)
  var q = require('q')
  var qContext = new QContext(t, agent)

  var firstTest = q.defer()
  var secondTest = q.defer()

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    q.ninvoke(function() {
      qContext.assertTransaction(transaction)
      firstTest.resolve()
    })
  })

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    q.ninvoke(function() {
      qContext.assertTransaction(transaction)
      secondTest.resolve()
    })
  })

  q.all([firstTest, secondTest])
    .then(function done() {
      t.end()
    })
})

test('q.then', function testQNInvoke(t) {
  var agent = setupAgent(t)
  var q = require('q')
  var qContext = new QContext(t, agent)

  var firstTest = q.defer()
  var secondTest = q.defer()

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    q(true).then(function() {
      qContext.assertTransaction(transaction)
      firstTest.resolve()
    })
  })

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    q(true).then(function() {
      qContext.assertTransaction(transaction)
      secondTest.resolve()
    })
  })

  q.all([firstTest, secondTest])
    .then(function done() {
      t.end()
    })
})

test('q.then rejections', function testQNInvoke(t) {
  t.plan(4)

  var agent = setupAgent(t)
  var q = require('q')
  var qContext = new QContext(t, agent)

  var firstTest = q.defer()
  var secondTest = q.defer()

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var thrownError = new Error('First unhandled error')
    process.on('unhandledRejection', function rejectionHandler(error) {
      if (error === thrownError) {
        qContext.assertTransaction(transaction)
        firstTest.resolve()
      }
    })

    q(true).then(function() {
      throw thrownError
    })
  })

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var thrownError = new Error('Second unhandled error')
    process.on('unhandledRejection', function rejectionHandler(error) {
      if (error === thrownError) {
        qContext.assertTransaction(transaction)
        secondTest.resolve()
      }
    })

    q(true).then(function() {
      throw thrownError
    })
  })

  q.all([firstTest.promise, secondTest.promise])
    .then(function done() {
      t.end()
    })
})

function setupAgent(t) {
  var agent = helper.instrumentMockedAgent()
  t.tearDown(function tearDown() {
    helper.unloadAgent(agent)
  })

  return agent
}
