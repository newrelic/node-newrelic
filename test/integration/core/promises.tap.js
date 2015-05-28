'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')
var verifySegments = require('./verify.js')
var util = require('util')

if (!global.Promise) {
  test = function noop() {
    console.error('Promise tests cant run without native Promises')
  }
}

test('then', function testThen(t) {
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(done, fail)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
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
  t.plan(7)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(next, fail).then(done, fail)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
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
  t.plan(7)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(next, fail).then(done, fail)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
        accept(15)
        reject(10)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 15, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

      return new Promise(function wait(accept) {
        setTimeout(function resolve() {
          segment = agent.tracer.getSegment()
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


test('chain', function testChain(t) {
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(done, fail)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
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

test('multi chain', function testThen(t) {
  t.plan(7)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(next, fail).chain(done, fail)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
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

test('multi chain async', function testThen(t) {
  t.plan(7)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(next, fail).chain(done, fail)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
        accept(15)
        reject(10)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 15, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

      return new Promise(function wait(accept) {
        setTimeout(function resolve() {
          segment = agent.tracer.getSegment()
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
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(fail, done)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
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
  t.plan(7)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(fail, next).then(fail, done)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
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
  t.plan(7)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).then(fail, next).then(fail, done)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
        reject(10)
        accept(15)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 10, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

      return new Promise(function wait(accept, reject) {
        setTimeout(function resolve() {
          segment = agent.tracer.getSegment()
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

test('chain reject', function testChainReject(t) {
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(fail, done)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
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

test('multi chain reject', function testThen(t) {
  t.plan(7)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(fail, next).chain(fail, done)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
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

test('multi chain async reject', function testThen(t) {
  t.plan(7)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(fail, next).chain(fail, done)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
        reject(10)
        accept(15)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 10, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

      return new Promise(function wait(accept, reject) {
        setTimeout(function resolve() {
          segment = agent.tracer.getSegment()
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
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).catch(done)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
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
  t.plan(7)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).catch(next).catch(done)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
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
  t.plan(7)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).catch(next).catch(done)

    function executor(accept, reject) {
      setTimeout(function resolve() {
        segment = agent.tracer.getSegment()
        reject(10)
        accept(15)
      }, 0)
    }

    function next(val) {
      t.equal(agent.getTransaction(), transaction, 'transaction should be preserved')
      t.equal(val, 10, 'should resolve with the correct value')
      t.equal(agent.tracer.getSegment(), segment, 'segment should be preserved')

      return new Promise(function wait(accept, reject) {
        setTimeout(function resolve() {
          segment = agent.tracer.getSegment()
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
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function resolve() {
      segment = agent.tracer.getSegment()
      Promise.resolve(15).then(done, fail)
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

test('Promise.accept', function testAccept(t) {
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function accept() {
      segment = agent.tracer.getSegment()
      Promise.accept(15).then(done, fail)
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
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function reject() {
      segment = agent.tracer.getSegment()
      Promise.reject(10).then(fail, done)
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
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function resolve() {
      segment = agent.tracer.getSegment()
      var a = Promise.resolve(15)
      var b = Promise.resolve(25)
      Promise.all([a, b]).then(done, fail)
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
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function reject() {
      segment = agent.tracer.getSegment()
      var a = Promise.resolve(15)
      var b = Promise.reject(10)
      Promise.all([a, b]).then(fail, done)
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
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function resolve() {
      segment = agent.tracer.getSegment()
      var a = Promise.resolve(15)
      var b = Promise.defer()
      Promise.race([a, b.promise]).then(done, fail)
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

test('Promise.race reject', function testRaceReject(t) {
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    setTimeout(function reject() {
      segment = agent.tracer.getSegment()
      var a = Promise.defer()
      var b = Promise.reject(10)
      Promise.race([a.promise, b]).then(fail, done)
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

test('Promise.defer', function testDefer(t) {
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    var p = Promise.defer()
    p.promise.then(done, fail)

    setTimeout(function resolve() {
      segment = agent.tracer.getSegment()
      p.resolve(15)
      p.reject(10)
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

test('Promise.defer reject', function testDeferReject(t) {
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    var p = Promise.defer()
    p.promise.then(fail, done)

    setTimeout(function reject() {
      segment = agent.tracer.getSegment()
      p.reject(10)
      p.resolve(15)
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

test('instanceof Promise should not break', function testDeferReject(t) {
  t.plan(4)
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
  t.plan(5)


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
  t.plan(3)

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

  t.plan(3)

  var p = new Promise(function noop() {})

  t.ok(p instanceof Promise, 'instanceof should work on nr wrapped Promise')
  t.ok(p instanceof WrappedPromise, 'instanceof should work on wrapped Promise')
  t.ok(p instanceof OriginalPromise, 'instanceof should work on unwrapped Promise')

  t.end()
})

test('throw in executor', function testCatch(t) {
  t.plan(4)
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
