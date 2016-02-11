'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')

function QContext(test, agent) {
    this.agent = agent;
    this.test = test;
}

QContext.prototype.assertTransaction = function assertTransaction(transaction) {
    this.test.equal(this.agent.getTransaction(), transaction)
    this.test.equal(this.agent.getTransaction().trace.root.children.length, 0)
}

test('Q.ninvoke', function testQNInvoke(t) {
  var agent = setupAgent(t)
  var Q = require('q')
  var qContext = new QContext(t, agent)

  var firstTest = Q.defer()
  var secondTest = Q.defer()
    
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Q.ninvoke(function anonymous() {
      qContext.assertTransaction(transaction)
      firstTest.resolve()
    })
  })

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Q.ninvoke(function anonymous() {
      qContext.assertTransaction(transaction)
      secondTest.resolve()
    })
  })

  Q.all([firstTest, secondTest])
    .then(function done() {
      t.end()
    })
})

test('Q.then', function testQNInvoke(t) {
  var agent = setupAgent(t)
  var Q = require('q')
  var qContext = new QContext(t, agent)

  var firstTest = Q.defer()
  var secondTest = Q.defer()
    
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Q(true).then(function anonymous() {
      qContext.assertTransaction(transaction)
      firstTest.resolve()
    })
  })

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Q(true).then(function anonymous() {
      qContext.assertTransaction(transaction)
      secondTest.resolve()
    })
  })

  Q.all([firstTest, secondTest])
    .then(function done() {
      t.end()
    })
})

test('Q.then rejections', function testQNInvoke(t) {
  var agent = setupAgent(t)
  var Q = require('q')
  var qContext = new QContext(t, agent)

  var firstTest = Q.defer()
  var secondTest = Q.defer()
    
  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var thrownError = new Error('Unhandled error');
    process.on('unhandledRejection', function rejectionHandler(error) {
      if (error === thrownError) {
        qContext.assertTransaction(transaction)
        firstTest.resolve()
      }
    })

    Q(true).then(function anonymous() {
      throw thrownError
    })
  })

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var thrownError = new Error('Unhandled error');
    process.on('unhandledRejection', function rejectionHandler(error) {
      if (error === thrownError) {
        qContext.assertTransaction(transaction)
        secondTest.resolve()
      }
    })

    Q(true).then(function anonymous() {
      throw thrownError
    })
  })

  Q.all([firstTest, secondTest])
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
