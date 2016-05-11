'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')
var assertSegments = require('../../lib/metrics_helper').assertSegments
var testPromiseSegments = require('./promises/segments.js')
var testTransactionState = require('./promises/transaction-state.js')

var runMultiple = testTransactionState.runMultiple


test('transaction state', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')
  testTransactionState(t, agent, Promise)
  t.autoend()
})

test('segments', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')
  testPromiseSegments(t, agent, Promise)
  t.autoend()
})

test('no transaction', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  Promise.resolve(0).then(function step1() {
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
  var Promise = require('bluebird')

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
  var Promise = require('bluebird')

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

test('Promise.join', function(t) {
  testPromiseClassMethod(t, 1, function joinTest(Promise, name) {
    return Promise.join(
      Promise.resolve(1),
      Promise.resolve(2),
      Promise.resolve(3),
      Promise.resolve(name)
    ).then(function(res) {
      t.same(res, [1, 2, 3, name], name + 'should have all the values')
    })
  })
})

test('Promise.try', function(t) {
  testPromiseClassMethod(t, 3, function tryTest(Promise, name) {
    return Promise.try(function() {
      throw new Error('Promise.try test error')
    }).then(function() {
      t.fail(name + 'should not go into resolve after throwing')
    }, function(err) {
      t.ok(err, name + 'should have error')
      if (err) {
        t.equal(err.message, 'Promise.try test error', name + 'should be correct error')
      }
    }).then(function(){
      var foo = {what: 'Promise.try test object'}
      return Promise.try(function() {
        return foo
      }).then(function(obj) {
        t.equal(obj, foo, name + 'should also work on success')
      })
    })
  })
})

test('Promise.method', function(t) {
  testPromiseClassMethod(t, 3, function methodTest(Promise, name) {
    var fn = Promise.method(function() {
      throw new Error('Promise.method test error')
    })

    return fn().then(function() {
      t.fail(name + 'should not go into resolve after throwing')
    }, function(err) {
      t.ok(err, name + 'should have error')
      if (err) {
        t.equal(err.message, 'Promise.method test error', name + 'should be correct error')
      }
    }).then(function(){
      var foo = {what: 'Promise.method test object'}
      var fn2 = Promise.method(function() {
        return foo
      })

      return fn2().then(function(obj) {
        t.equal(obj, foo, name + 'should also work on success')
      })
    })
  })
})

test('Promise.fromCallback', function(t) {
  testPromiseClassMethod(t, 3, function fromCallbackTest(Promise, name) {
    return Promise.fromCallback(function(cb) {
      cb(null, 'foobar')
    }).then(function(res) {
      t.equal(res, 'foobar', name + 'should pass result through')

      return Promise.fromCallback(function(cb) {
        cb(new Error('Promise.fromCallback test error'))
      })
    }).then(function() {
      t.fail(name + 'should not resolve after rejecting')
    }, function(err) {
      t.ok(err, name + 'should have an error')
      if (err) {
        t.equal(
          err.message,
          'Promise.fromCallback test error',
          name + 'should have correct error'
        )
      }
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

test('Promise#asCallback', function(t) {
  testPromiseInstanceMethod(t, 6, function asCallbackTest(p, name) {
    return p.asCallback(function(err, result) {
      t.notOk(err, name + 'should not have an error')
      t.same(result, [1, 2, 3, name], name + 'should have the correct result value')
    }).then(function() {
      throw new Error('Promise#asCallback test error')
    }).then(function() {
      t.fail(name + 'should have skipped then after rejection')
    }).asCallback(function(err, result) {
      t.ok(err, name + 'should have error in asCallback')
      t.notOk(result, name + 'should not have a result')
      if (err) {
        t.equal(
          err.message,
          'Promise#asCallback test error',
          name + 'should be the correct error'
        )
      }
    }).catch(function(err){
      t.ok(err, name + 'should have error in catch too')
      // Swallowing error that doesn't get caught in the asCallback.
    })
  })
})

test('Promise#bind', function(t) {
  testPromiseInstanceMethod(t, 2, function bindTest(p, name) {
    var foo = {what: 'test object'}
    return p.bind(foo).then(function(res) {
      t.equal(this, foo, name + 'should have correct this value')
      t.same(res, [1, 2, 3, name], name + 'parameters should be correct')
    })
  })
})

test('Promise#call', function(t) {
  testPromiseInstanceMethod(t, 3, function callTest(p, name) {
    var foo = {
      test: function(){
        t.equal(this, foo, name + 'should have correct this value')
        t.pass(name + 'should call the test method of foo')
        return 'foobar'
      }
    }
    return p.then(function(){
      return foo
    }).call('test').then(function(res) {
      t.same(res, 'foobar', name + 'parameters should be correct')
    })
  })
})

test('Promise#get', function(t) {
  testPromiseInstanceMethod(t, 1, function getTest(p, name) {
    return p.get('length').then(function(res) {
      t.equal(res, 4, name + 'should get the property specified')
    })
  })
})

test('Promise#return', function(t) {
  testPromiseInstanceMethod(t, 1, function returnTest(p, name) {
    var foo = {what: 'return test object'}
    return p.return(foo).then(function(res) {
      t.equal(res, foo, name + 'should pass throught the correct object')
    })
  })
})

test('Promise#throw', function(t) {
  testPromiseInstanceMethod(t, 1, function throwTest(p, name) {
    var foo = {what: 'throw test object'}
    return p.throw(foo).then(function(){
      t.fail(name + 'should not go into resolve handler after throw')
    })
    .catch(function(err) {
      t.equal(err, foo, name + 'should pass throught the correct object')
    })
  })
})

test('Promise#catchReturn', function(t) {
  testPromiseInstanceMethod(t, 1, function catchReturnTest(p, name) {
    var foo = {what: 'catchReturn test object'}
    return p.throw(new Error('catchReturn test error'))
      .catchReturn(foo)
      .then(function(res) {
        t.equal(res, foo, name + 'should pass throught the correct object')
      })
  })
})

test('Promise#catchThrow', function(t) {
  testPromiseInstanceMethod(t, 1, function catchThrowTest(p, name) {
    var foo = {what: 'catchThrow test object'}
    return p.throw(new Error('catchThrow test error'))
      .catchThrow(foo)
      .catch(function(err) {
        t.equal(err, foo, name + 'should pass throught the correct object')
      })
    })
})

test('all', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p1 = new Promise(function(resolve, reject) {
      resolve(1)
    })

    var p2 = new Promise(function(resolve, reject) {
      resolve(2)
    })

    Promise.all([p1, p2]).then(function() {
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('all on instance', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p1 = new Promise(function(resolve, reject) {
      resolve([1, 2])
    })

    p1.all().then(function() {
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('props', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p1 = new Promise(function(resolve, reject) {
      resolve(1)
    })

    var p2 = new Promise(function(resolve, reject) {
      resolve(2)
    })

    Promise.props({
      first: p1,
      second: p2
    }).then(function(result) {
      t.equal(result.first, 1)
      t.equal(result.second, 2)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('props on instance', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p1 = new Promise(function(resolve, reject) {
      resolve({
        first: 1,
        second: 2
      })
    })

    p1.props().then(function(result) {
      t.equal(result.first, 1)
      t.equal(result.second, 2)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('any', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Promise.any([
      Promise.resolve(1),
      Promise.resolve(2)
    ]).then(function(result) {
      t.equal(result, 1)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('any on instance', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p = new Promise(function(resolve, reject) {
      resolve([1, 2])
    })

    p.any().then(function(result) {
      t.equal(result, 1)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('race', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Promise.race([
      Promise.resolve(1),
      Promise.resolve(2)
    ]).then(function(result) {
      t.equal(result, 1)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('some', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Promise.some([
      Promise.resolve(1),
      Promise.resolve(2),
      Promise.resolve(3)
    ], 2).then(function(result) {
      t.equal(result.length, 2)
      t.equal(result[0], 1)
      t.equal(result[1], 2)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('some on instance', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p = new Promise(function(resolve, reject) {
      resolve([1, 2, 3])
    })

    p.some(2).then(function(result) {
      t.equal(result.length, 2)
      t.equal(result[0], 1)
      t.equal(result[1], 2)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('map', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Promise.map([1, 2], function(item) {
      return Promise.resolve(item)
    }).then(function(result) {
      t.equal(result.length, 2)
      t.equal(result[0], 1)
      t.equal(result[1], 2)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('map on instance', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p = new Promise(function(resolve) {
      resolve([1, 2])
    })

    p.map(function(item) {
      return Promise.resolve(item)
    }).then(function(result) {
      t.equal(result.length, 2)
      t.equal(result[0], 1)
      t.equal(result[1], 2)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('reduce', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Promise.reduce([1, 2], function(total, item) {
      return Promise.resolve(item).then(function(result) {
        return total + result
      })
    }, 0).then(function(total) {
      t.equal(total, 3)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('reduce on instance', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p = new Promise(function(resolve) {
      resolve([1, 2])
    })

    p.reduce(function(total, item) {
      return Promise.resolve(item).then(function(result) {
        return total + result
      })
    }, 0).then(function(total) {
      t.equal(total, 3)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('filter', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Promise.resolve([1, 2, 3, 4]).filter(function(value) {
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

test('filter on instance', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p = new Promise(function(resolve) {
      resolve([1, 2, 3, 4])
    })

    p.filter(function(value) {
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

test('each', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Promise.resolve([1, Promise.resolve(2)]).each(function(value) {
      // do something with the value
    })
    .then(function(result) {
      t.equal(result.length, 2)
      t.equal(result[0], 1)
      t.equal(result[1], 2)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('each on instance', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p = new Promise(function(resolve) {
      resolve([1, Promise.resolve(2)])
    })

    p.each(function(value) {
      // do something with the value
    })
    .then(function(result) {
      t.equal(result.length, 2)
      t.equal(result[0], 1)
      t.equal(result[1], 2)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('mapSeries', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    Promise.mapSeries([1, 2], function(item) {
      return Promise.resolve(item)
    }).then(function(result) {
      t.equal(result.length, 2)
      t.equal(result[0], 1)
      t.equal(result[1], 2)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
    })
  })
})

test('mapSeries on instance', function(t) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

  helper.runInTransaction(agent, function transactionWrapper(transaction) {
    var p = new Promise(function(resolve) {
      resolve([1, 2])
    })

    p.mapSeries(function(item) {
      return Promise.resolve(item)
    }).then(function(result) {
      t.equal(result.length, 2)
      t.equal(result[0], 1)
      t.equal(result[1], 2)
      t.equal(agent.getTransaction(), transaction, 'has the right transaction')
      t.end()
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
  var Promise = require('bluebird')

  _testPromiseMethod(t, plan, agent, function(name) {
    var p = new Promise(function(resolve, reject) {
      resolve([1, 2, 3, name])
    })
    return testFunc(p, name)
  })
}

function testPromiseClassMethod(t, plan, testFunc) {
  var agent = setupAgent(t)
  var Promise = require('bluebird')

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
