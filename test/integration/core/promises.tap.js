'use strict'

var genericTestDir = '../../integration/instrumentation/promises/'

var test = require('tap').test
var helper = require('../../lib/agent_helper')
var util = require('util')
var testPromiseSegments = require(genericTestDir + 'segments')
var testTransactionState = require(genericTestDir + 'transaction-state')

if (!global.Promise) {
  test = function noop() {
    /* eslint-disable no-console */
    console.error('Promise tests cant run without native Promises')
    /* eslint-enable no-console */
  }
}

test('transaction state', function(t) {
  var agent = helper.loadTestAgent(t)
  t.autoend()
  testTransactionState(t, agent, Promise)
})

// XXX Promise segments in native instrumentation are currently less than ideal
// XXX in structure. Transaction state is correctly maintained, and all segments
// XXX are created, but the heirarchy is not correct.
test('segments', {skip: true}, function(t) {
  var agent = helper.loadTestAgent(t)
  t.autoend()
  testPromiseSegments(t, agent, Promise)
})

test('then', function testThen(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(done, fail)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        accept(15)
        reject(10)
      }, 0)
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 15, 'should resolve with the correct value')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test('multi then', function testThen(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(next, fail).then(done, fail)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        accept(15)
        reject(10)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 15, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')
      return val
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 15, 'should resolve with the correct value')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test('multi then async', function testThen(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(next, fail).then(done, fail)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        accept(15)
        reject(10)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 15, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

      return new Promise(function wait(accept) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          accept(val)
        }, 0)
      })
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 15, 'should resolve with the correct value')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})


test(
  'chain',
  {skip: !(global.Promise && Promise.prototype.chain)},
  function testChain(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(done, fail)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        accept(15)
        reject(10)
      }, 0)
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 15, 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test(
  'multi chain',
  {skip: !(global.Promise && Promise.prototype.chain)},
  function testThen(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(next, fail).chain(done, fail)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        accept(15)
        reject(10)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 15, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')
      return val
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 15, 'should resolve with the correct value')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test(
  'multi chain async',
  {skip: !(global.Promise && Promise.prototype.chain)},
  function testThen(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(next, fail).chain(done, fail)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        accept(15)
        reject(10)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 15, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

      return new Promise(function wait(accept) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          accept(val)
        }, 0)
      })
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 15, 'should resolve with the correct value')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test('then reject', function testThenReject(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(fail, done)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        reject(10)
        accept(15)
      }, 0)
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 10, 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test('multi then reject', function testThen(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(fail, next).then(fail, done)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        reject(10)
        accept(15)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 10, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')
      throw val
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test('multi then async reject', function testThen(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(fail, next).then(fail, done)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        reject(10)
        accept(15)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 10, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

      return new Promise(function wait(accept, reject) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          reject(val)
        }, 0)
      })
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test(
  'chain reject',
  {skip: !(global.Promise && Promise.prototype.chain)},
  function testChainReject(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(fail, done)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        reject(10)
        accept(15)
      }, 0)
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 10, 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test(
  'multi chain reject',
  {skip: !(global.Promise && Promise.prototype.chain)},
  function testThen(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(fail, next).chain(fail, done)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        reject(10)
        accept(15)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 10, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')
      throw val
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test(
  'multi chain async reject',
  {skip: !(global.Promise && Promise.prototype.chain)},
  function testThen(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(fail, next).chain(fail, done)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        reject(10)
        accept(15)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 10, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

      return new Promise(function wait(accept, reject) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          reject(val)
        }, 0)
      })
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test('catch', function testCatch(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).catch(done)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        reject(10)
        accept(15)
      }, 0)
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 10, 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }
  })
})

test('multi catch', function testThen(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).catch(next).catch(done)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        reject(10)
        accept(15)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 10, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')
      throw val
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test('multi catch async', function testThen(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).catch(next).catch(done)

    function executor(accept, reject) {
      segment = agent.tracer.getSegment()
      setTimeout(function resolve() {
        reject(10)
        accept(15)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 10, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

      return new Promise(function wait(accept, reject) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          reject(val)
        }, 0)
      })
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test('Promise.resolve', function testResolve(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function resolve() {
      Promise.resolve(15).then(function(val) {
        segment = agent.tracer.getSegment()
        return val
      }).then(done, fail)
    }, 0)

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 15, 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test(
  'Promise.accept',
  {skip: !(global.Promise && Promise.accept)},
  function testAccept(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function accept() {
      Promise.accept(15).then(function (val) {
        segment = agent.tracer.getSegment()
        return val
      }).then(done, fail)
    }, 0)

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 15, 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})


test('Promise.reject', function testReject(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function reject() {
      Promise.reject(10).then(null, function (error) {
        segment = agent.tracer.getSegment()
        throw error
      }).then(fail, done)
    }, 0)

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 10, 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})


test('Promise.all', function testAll(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function resolve() {
      var a = Promise.resolve(15)
      var b = Promise.resolve(25)
      Promise.all([a, b]).then(function (val){
        segment = agent.tracer.getSegment()
        return val
      }).then(done, fail)
    }, 0)

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.deepEqual(val, [15, 25], 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test('Promise.all reject', function testAllReject(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function reject() {
      var a = Promise.resolve(15)
      var b = Promise.reject(10)
      Promise.all([a, b]).then(null, function (err){
        segment = agent.tracer.getSegment()
        throw err
      }).then(fail, done)
    }, 0)

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.deepEqual(val, 10, 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test('Promise.race', function testRace(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function resolve() {
      var a = Promise.resolve(15)
      var b = new Promise(function (resolve) {setTimeout(resolve, 100)})
      Promise.race([a, b]).then(function (val){
        segment = agent.tracer.getSegment()
        return val
      }).then(done, fail)
    }, 0)

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.deepEqual(val, 15, 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test(
  'Promise.race reject',
  function testRaceReject(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function reject() {
      var a = new Promise(function (resolve) {setTimeout(resolve, 100)})
      var b = Promise.reject(10)
      Promise.race([a, b]).then(null, function(err){
        segment = agent.tracer.getSegment()
        throw err
      }).then(fail, done)
    }, 0)

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.deepEqual(val, 10, 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test(
  'Promise.defer',
  {skip: !(global.Promise && Promise.defer)},
  function testDefer(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)

  helper.runInTransaction(agent, function inTransaction(transaction) {
    var p = Promise.defer()
    p.promise.then(done, fail)

    setTimeout(function resolve() {
      p.resolve(15)
      p.reject(10)
    }, 0)

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.deepEqual(val, 15, 'value should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test(
  'Promise.defer reject',
  {skip: !(global.Promise && Promise.defer)},
  function testDeferReject(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)

  helper.runInTransaction(agent, function inTransaction(transaction) {
    var p = Promise.defer()
    p.promise.then(fail, done)

    setTimeout(function reject() {
      p.reject(10)
      p.resolve(15)
    }, 0)

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.deepEqual(val, 10, 'value should be preserved')

        t.end()
      })
    }

    function fail() {
      t.fail('should not be called')
      t.end()
    }
  })
})

test('instanceof Promise should not break', function testDeferReject(t) {
  t.autoend()
  var OriginalPromise = Promise
  t.equal(OriginalPromise.__NR_original, void 0, 'should not be wrapped')
  var agent = helper.loadTestAgent(t)
  t.equal(Promise.__NR_original, OriginalPromise, 'should be wrapped')

  helper.runInTransaction(agent, function inTransaction() {
    var p = new Promise(function acceptIt(accept) {
      accept()
    })

    t.ok(p instanceof Promise, 'instanceof should work on wrapped Promise')
    t.ok(p instanceof OriginalPromise, 'instanceof should work on unwrapped Promise')
    t.end()
  })
})

test('should throw when called without executor', function testNoExecutor(t) {
  var OriginalPromise = Promise
  var unwrappedError, wrappedError
  var wrapped, unwrapped
  helper.loadTestAgent(t)
  t.autoend()


  try {
    unwrapped = new OriginalPromise(null)
  } catch (err) {
    unwrappedError = err
  }

  try {
    wrapped = new Promise(null)
  } catch (err) {
    wrappedError = err
  }

  t.equal(wrapped, void 0, 'should not be set')
  t.equal(unwrapped, void 0, 'should not be set')
  t.ok(unwrappedError instanceof Error, 'should error')
  t.ok(wrappedError instanceof Error, 'should error')
  t.equal(wrappedError.message, unwrappedError.message, 'should have same message')

  t.end()
})

test('should work if something else wraps promises first', function testWrapSecond(t) {
  var OriginalPromise = Promise

  util.inherits(WrappedPromise, Promise)
  global.Promise = WrappedPromise

  function WrappedPromise(executor) {
    var promise = new OriginalPromise(executor)
    promise.__proto__ = WrappedPromise.prototype
    return promise
  }

  helper.loadTestAgent(t)
  t.autoend()

  var p = new Promise(function noop() {})

  t.ok(p instanceof Promise, 'instanceof should work on nr wrapped Promise')
  t.ok(p instanceof WrappedPromise, 'instanceof should work on wrapped Promise')
  t.ok(p instanceof OriginalPromise, 'instanceof should work on unwrapped Promise')

  t.end()
})

test('should work if something else wraps promises after', function testWrapFirst(t) {
  var OriginalPromise = Promise

  helper.loadTestAgent(t)
  util.inherits(WrappedPromise, Promise)
  global.Promise = WrappedPromise

  function WrappedPromise(executor) {
    var promise = new OriginalPromise(executor)
    promise.__proto__ = WrappedPromise.prototype
    return promise
  }

  t.autoend()

  var p = new Promise(function noop() {})

  t.ok(p instanceof Promise, 'instanceof should work on nr wrapped Promise')
  t.ok(p instanceof WrappedPromise, 'instanceof should work on wrapped Promise')
  t.ok(p instanceof OriginalPromise, 'instanceof should work on unwrapped Promise')

  t.end()
})

test('throw in executor', function testCatch(t) {
  t.autoend()
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).catch(done)

    function executor() {
      segment = agent.tracer.getSegment()
      throw 10
    }

    function done(val) {
      t.equal(this, void 0, 'context should be undefined')
      process.nextTick(function finish() {
        t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
        t.equal(val, 10, 'value should be preserved')
        t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

        t.end()
      })
    }
  })
})
