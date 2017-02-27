'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')
var testPromiseSegments = require('./promises/segments.js')
var testTransactionState = require('./promises/transaction-state.js')

var runMultiple = testTransactionState.runMultiple


test('transaction state', function(t) {
  var agent = setupAgent(t)
  var when = require('when')
  testTransactionState(t, agent, when.Promise, when)
  t.autoend()
})

test('transaction state on library', function(t) {
  t.autoend()

  var agent, when

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent({promise_segments: false})
    when = require('when')
    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    done()
  })

  t.test('when.promise', function(t) {
    helper.runInTransaction(agent, function(transaction) {
      when(1).then(function() {
        t.equal(agent.getTransaction(), transaction)
        t.end()
      })
    })
  })

  t.test('when.promise resolved', function(t) {
    helper.runInTransaction(agent, function(transaction) {
      when.promise(function(resolve, reject, notify) {
        resolve(1)
      })
      .then(function() {
        t.equal(agent.getTransaction(), transaction)
        t.end()
      })
    })
  })

  t.test('when.promise rejected', function(t) {
    helper.runInTransaction(agent, function(transaction) {
      when.promise(function(resolve, reject, notify) {
        reject(1)
      })
      .then(function() {
        t.fail('should not be here')
      })
      .catch(function(error) {
        t.equal(agent.getTransaction(), transaction)
        t.equal(error, 1)
        t.end()
      })
    })
  })
})

test('segments', function(t) {
  var agent = setupAgent(t)
  var when = require('when')
  testPromiseSegments(t, agent, when.Promise)
  t.autoend()
})

test('no transaction', function(t) {
  var agent = setupAgent(t)
  var when = require('when')

  when.resolve(0).then(function step1() {
    return 1
  })
  .then(function step2() {
    return 2
  })
  .then(function finalHandler(res) {
    t.equal(res, 2, 'should be the correct result')
  })
  .finally(function finallyHandler() {
    t.end()
  })
})

test('new Promise() throw', function(t) {
  t.plan(2)

  var agent = setupAgent(t)
  var Promise = require('when').Promise

  try {
    (new Promise(function(resolve, reject) {
      throw new Error('test error')
    })).then(function() {
      t.fail('Error should have been caught.')
    }, function(err) {
      t.ok(err, 'Error should go to the reject handler')
      t.equal(err.message, 'test error', 'Error should be as expected')
      t.end()
    })
  } catch (e) {
    t.fail('Error should have passed to `reject`.')
  }
})

test('new Promise() resolve then throw', function(t) {
  t.plan(1)

  var agent = setupAgent(t)
  var Promise = require('when').Promise

  try {
    (new Promise(function(resolve, reject) {
      resolve('foo')
      throw new Error('test error')
    })).then(function(res) {
      t.equal(res, 'foo', 'promise should be resolved.')
      t.end()
    }, function(err) {
      t.fail('Error should have been swallowed by promise.')
    })
  } catch (e) {
    t.fail('Error should have passed to `reject`.')
  }
})

test('Promise.resolve', function(t) {
  testPromiseClassMethod(t, 1, function resolveTest(Promise, name) {
    return Promise.resolve(name + ' resolve value')
      .then(function(res) {
        t.equal(res, name + ' resolve value', name + 'should pass the value')
      })
  })
})

test('Promise.reject', function(t) {
  testPromiseClassMethod(t, 1, function rejectTest(Promise, name) {
    return Promise.reject(name + ' reject value')
      .then(function() {
        t.fail(name + 'should not resolve after a rejection')
      }, function(err) {
        t.equal(err, name + ' reject value', name + 'should reject with the err')
      })
  })
})

test('Promise#then', function(t) {
  testPromiseInstanceMethod(t, 3, function thenTest(p, name) {
    return p.then(function(res) {
      t.same(res, [1, 2, 3, name], name + 'should have the correct result value')
      throw new Error('Promise#then test error')
    }).then(function() {
      t.fail(name + 'should not go into resolve handler from rejected promise')
    }, function(err) {
      t.ok(err, name + 'should pass error into thenned rejection handler')
      if (err) {
        t.equal(err.message, 'Promise#then test error', name + 'should be correct error')
      }
    })
  })
})

test('Promise#catch', function(t) {
  testPromiseInstanceMethod(t, 2, function catchTest(p, name) {
    return p.catch(function(err) {
      t.fail(name + 'should not go into catch from a resolved promise')
    }).then(function(){
      throw new Error('Promise#catch test error')
    }).catch(function(err){
      t.ok(err, name + 'should pass error into rejection handler')
      if (err) {
        t.equal(err.message, 'Promise#catch test error', name + 'should be correct error')
      }
    })
  })
})

test('Promise#finally', function(t) {
  testPromiseInstanceMethod(t, 6, function finallyTest(p, name) {
    return p.finally(function() {
      t.equal(arguments.length, 0, name + 'should not receive any parameters')
    }).then(function(res) {
      t.same(res, [1, 2, 3, name], name + 'should pass values beyond finally handler')
      throw new Error('Promise#finally test error')
    }).finally(function() {
      t.equal(arguments.length, 0, name + 'should not receive any parameters')
      t.pass(name + 'should go into finally handler from rejected promise')
    }).catch(function(err) {
      t.ok(err, name + 'should pass error beyond finally handler')
      if (err) {
        t.equal(err.message, 'Promise#finally test error', name + 'should be correct error')
      }
    })
  })
})

test('Promise#tap', function(t) {
  testPromiseInstanceMethod(t, 4, function tapTest(p, name) {
    return p.tap(function(res) {
      t.same(res, [1, 2, 3, name], name + 'should pass values into tap handler')
    }).then(function(res) {
      t.same(res, [1, 2, 3, name], name + 'should pass values beyond tap handler')
      throw new Error('Promise#tap test error')
    }).tap(function() {
      t.fail(name + 'should not call tap after rejected promises')
    }).catch(function(err) {
      t.ok(err, name + 'should pass error beyond tap handler')
      if (err) {
        t.equal(err.message, 'Promise#tap test error', name + 'should be correct error')
      }
    })
  })
})

test('Promise#spread', function(t) {
  testPromiseInstanceMethod(t, 1, function spreadTest(p, name) {
    return p.spread(function(a, b, c, d) {
      t.same([a, b, c, d], [1, 2, 3, name], name + 'parameters should be correct')
    })
  })
})

test('all', function(t) {
  t.autoend()
  var agent, when, Promise
  var p1, p2

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent({promise_segments: false})
    when = require('when')
    Promise = when.Promise

    p1 = new Promise(function(resolve, reject) {
      resolve(1)
    })

    p2 = new Promise(function(resolve, reject) {
      resolve(2)
    })
    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    done()
  })

  t.test('on library', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when.all([p1, p2]).then(function() {
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })

  t.test('on Promise', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.all([p1, p2]).then(function() {
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

test('any', function(t) {
  t.autoend()
  var agent, when, Promise

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent({promise_segments: false})
    when = require('when')
    Promise = when.Promise
    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    done()
  })

  t.test('on library', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when.any([
        when.resolve(1),
        when.resolve(2)
      ]).then(function(result) {
        t.equal(result, 1)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })

  t.test('on Promise', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.any([
        when.resolve(1),
        when.resolve(2)
      ]).then(function(result) {
        t.equal(result, 1)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

test('some', function(t) {
  t.autoend()
  var agent, when, Promise

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent({promise_segments: false})
    when = require('when')
    Promise = when.Promise
    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    done()
  })

  t.test('on library', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when.some([
        when.resolve(1),
        when.resolve(2),
        when.resolve(3)
      ], 2).then(function(result) {
        t.equal(result.length, 2)
        t.equal(result[0], 1)
        t.equal(result[1], 2)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })

  t.test('on Promise', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.some([
        when.resolve(1),
        when.resolve(2),
        when.resolve(3)
      ], 2).then(function(result) {
        t.equal(result.length, 2)
        t.equal(result[0], 1)
        t.equal(result[1], 2)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

test('map', function(t) {
  t.autoend()
  var agent, when, Promise

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent({promise_segments: false})
    when = require('when')
    Promise = when.Promise
    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    done()
  })

  t.test('on library', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when.map([1, 2], function(item) {
        return when.resolve(item)
      }).then(function(result) {
        t.equal(result.length, 2)
        t.equal(result[0], 1)
        t.equal(result[1], 2)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })

  t.test('on Promise', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.map([1, 2], function(item) {
        return when.resolve(item)
      }).then(function(result) {
        t.equal(result.length, 2)
        t.equal(result[0], 1)
        t.equal(result[1], 2)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

test('reduce', function(t) {
  t.autoend()
  var agent, when, Promise

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent({promise_segments: false})
    when = require('when')
    Promise = when.Promise
    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    done()
  })

  t.test('on library', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when.reduce([1, 2], function(total, item) {
        return when.resolve(item).then(function(result) {
          return total + result
        })
      }, 0).then(function(total) {
        t.equal(total, 3)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })

  t.test('on Promise', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.reduce([1, 2], function(total, item) {
        return when.resolve(item).then(function(result) {
          return total + result
        })
      }, 0).then(function(total) {
        t.equal(total, 3)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

test('filter', function(t) {
  t.autoend()
  var agent, when, Promise

  t.beforeEach(function(done) {
    agent = helper.instrumentMockedAgent({promise_segments: false})
    when = require('when')
    Promise = when.Promise
    done()
  })

  t.afterEach(function(done) {
    helper.unloadAgent(agent)
    done()
  })

  t.test('on library', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      when.filter([1, 2, 3, 4], function(value) {
        // filter out even numbers
        return (value % 2)
      })
      .then(function(result) {
        t.equal(result.length, 2)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })

  t.test('on Promise', function(t) {
    helper.runInTransaction(agent, function transactionWrapper(transaction) {
      Promise.filter([1, 2, 3, 4], function(value) {
        // filter out even numbers
        return (value % 2)
      })
      .then(function(result) {
        t.equal(result.length, 2)
        t.equal(agent.getTransaction(), transaction, 'has the right transaction')
        t.end()
      })
    })
  })
})

function setupAgent(t, enableSegments) {
  var agent = helper.instrumentMockedAgent({promise_segments: enableSegments})
  t.tearDown(function tearDown() {
    helper.unloadAgent(agent)
  })
  return agent
}

function testPromiseInstanceMethod(t, plan, testFunc) {
  var agent = setupAgent(t)
  var Promise = require('when').Promise

  _testPromiseMethod(t, plan, agent, function(name) {
    var p = new Promise(function(resolve, reject) {
      resolve([1, 2, 3, name])
    })
    return testFunc(p, name, agent)
  })
}

function testPromiseClassMethod(t, plan, testFunc) {
  var agent = setupAgent(t)
  var when = require('when')
  var Promise = when.Promise

  _testPromiseMethod(t, plan, agent, function(name) {
    return testFunc(Promise, name)
  })
}

function _testPromiseMethod(t, plan, agent, testFunc) {
  var COUNT = 2
  t.plan((plan * 3) + ((COUNT + 1) * 3))

  t.doesNotThrow(function outTXPromiseThrowTest() {
    var name = '[no tx] '
    var isAsync = false
    testFunc(name)
      .finally(function() {
        t.ok(isAsync, name + 'should have executed asynchronously')
      })
      .then(function(){
        t.notOk(agent.getTransaction(), name + 'has no transaction')
        testInTransaction()
      }, function(err) {
        if (err) {
          console.log(err)
          console.log(err.stack)
        }
        t.notOk(err, name + 'should not result in error')
        t.end()
      })
    isAsync = true
  }, '[no tx] should not throw out of a transaction')

  function testInTransaction() {
    runMultiple(COUNT, function(i, cb){
      helper.runInTransaction(agent, function transactionWrapper(transaction) {
        var name = '[tx ' + i + '] '
        t.doesNotThrow(function inTXPromiseThrowTest() {
          var isAsync = false
          testFunc(name)
            .finally(function() {
              t.ok(isAsync, name + 'should have executed asynchronously')
            })
            .then(function(){
              t.equal(
                agent.getTransaction(),
                transaction,
                name + 'has the right transaction'
              )
            }, function(err) {
              if (err) {
                console.log(err)
                console.log(err.stack)
              }
              t.notOk(err, name + 'should not result in error')
            })
            .finally(cb)
          isAsync = true
        }, name + 'should not throw in a transaction')
      })
    }, function() {
      t.end()
    })
  }
}
