'use strict'

var test = require('tap').test
var helper = require('../../lib/agent_helper')
var verifySegments = require('./verify.js')

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

test('chain', function testChain(t) {
  t.plan(4)
  var agent = helper.loadTestAgent(t)
  var segment

  helper.runInTransaction(agent, function inTransaction(transaction) {
    new Promise(executor).chain(done)

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
