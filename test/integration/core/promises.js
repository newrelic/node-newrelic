/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const genericTestDir = '../../integration/instrumentation/promises/'

const tap = require('tap')
const helper = require('../../lib/agent_helper')
const util = require('util')
const testPromiseSegments = require(genericTestDir + 'segments')
const testTransactionState = require(genericTestDir + 'transaction-state')

module.exports = function runTests(flags) {
  const RealPromise = global.Promise
  tap.afterEach(() => {
    Promise = global.Promise = RealPromise
  })

  tap.test('transaction state', function (t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    t.autoend()
    testTransactionState(t, agent, Promise)
  })

  // XXX Promise segments in native instrumentation are currently less than ideal
  // XXX in structure. Transaction state is correctly maintained, and all segments
  // XXX are created, but the heirarchy is not correct.
  tap.test('segments', { skip: true }, function (t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    t.autoend()
    testPromiseSegments(t, agent, Promise)
  })

  tap.test('then', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 15, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('multi then', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
        t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
        t.equal(val, 15, 'should resolve with the correct value')
        t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')
        return val
      }

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 15, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('multi then async', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
        t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
        t.equal(val, 15, 'should resolve with the correct value')
        t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

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
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 15, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  const skipChain = !(global.Promise && Promise.prototype.chain)
  tap.test('chain', { skip: skipChain }, function testChain(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 15, 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('multi chain', { skip: skipChain }, function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
        t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
        t.equal(val, 15, 'should resolve with the correct value')
        t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')
        return val
      }

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 15, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('multi chain async', { skip: skipChain }, function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
        t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
        t.equal(val, 15, 'should resolve with the correct value')
        t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

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
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 15, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('then reject', function testThenReject(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('multi then reject', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
        t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')
        throw val
      }

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('multi then async reject', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
        t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

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
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('chain reject', { skip: skipChain }, function testChainReject(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('multi chain reject', { skip: skipChain }, function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
        t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')
        throw val
      }

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('multi chain async reject', { skip: skipChain }, function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
        t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

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
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('catch', function testCatch(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }
    })
  })

  tap.test('multi catch', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
        t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')
        throw val
      }

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }
    })
  })

  tap.test('multi catch async', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

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
        t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
        t.equal(val, 10, 'should resolve with the correct value')
        t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

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
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }
    })
  })

  tap.test('Promise.resolve', function testResolve(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      setTimeout(function resolve() {
        Promise.resolve(15)
          .then(function (val) {
            segment = agent.tracer.getSegment()
            return val
          })
          .then(done, fail)
      }, 0)

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 15, 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  const skipAccept = !(global.Promise && Promise.accept)
  tap.test('Promise.accept', { skip: skipAccept }, function testAccept(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      setTimeout(function accept() {
        Promise.accept(15)
          .then(function (val) {
            segment = agent.tracer.getSegment()
            return val
          })
          .then(done, fail)
      }, 0)

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 15, 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('Promise.reject', function testReject(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      setTimeout(function reject() {
        Promise.reject(10)
          .then(null, function (error) {
            segment = agent.tracer.getSegment()
            throw error
          })
          .then(fail, done)
      }, 0)

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('Promise.all', function testAll(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      setTimeout(function resolve() {
        const a = Promise.resolve(15)
        const b = Promise.resolve(25)
        Promise.all([a, b])
          .then(function (val) {
            segment = agent.tracer.getSegment()
            return val
          })
          .then(done, fail)
      }, 0)

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.same(val, [15, 25], 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('Promise.all reject', function testAllReject(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      setTimeout(function reject() {
        const a = Promise.resolve(15)
        const b = Promise.reject(10)
        Promise.all([a, b])
          .then(null, function (err) {
            segment = agent.tracer.getSegment()
            throw err
          })
          .then(fail, done)
      }, 0)

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.same(val, 10, 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('Promise.race', function testRace(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      setTimeout(function () {
        const a = Promise.resolve(15)
        const b = new Promise(function (resolve) {
          setTimeout(resolve, 100)
        })
        Promise.race([a, b])
          .then(function (val) {
            segment = agent.tracer.getSegment()
            return val
          })
          .then(done, fail)
      }, 0)

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.same(val, 15, 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('Promise.race reject', function testRaceReject(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      setTimeout(function reject() {
        const a = new Promise(function (resolve) {
          setTimeout(resolve, 100)
        })
        const b = Promise.reject(10)
        Promise.race([a, b])
          .then(null, function (err) {
            segment = agent.tracer.getSegment()
            throw err
          })
          .then(fail, done)
      }, 0)

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.same(val, 10, 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  const skipDefer = !(global.Promise && Promise.defer)
  tap.test('Promise.defer', { skip: skipDefer }, function testDefer(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })

    helper.runInTransaction(agent, function inTransaction(transaction) {
      const p = Promise.defer()
      p.promise.then(done, fail)

      setTimeout(function resolve() {
        p.resolve(15)
        p.reject(10)
      }, 0)

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.same(val, 15, 'value should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  tap.test('Promise.defer reject', { skip: skipDefer }, function testDeferReject(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })

    helper.runInTransaction(agent, function inTransaction(transaction) {
      const p = Promise.defer()
      p.promise.then(fail, done)

      setTimeout(function reject() {
        p.reject(10)
        p.resolve(15)
      }, 0)

      function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.same(val, 10, 'value should be preserved')

          t.end()
        })
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  // skip this in the hook case, since we don't wrap
  const skipInstanceOf = flags && flags.await_support
  tap.test('instanceof Promise should not break', { skip: skipInstanceOf }, function (t) {
    const OriginalPromise = Promise
    t.equal(OriginalPromise.__NR_original, void 0, 'should not be wrapped')
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    t.equal(Promise.__NR_original, OriginalPromise, 'should be wrapped')

    helper.runInTransaction(agent, function inTransaction() {
      const p = new Promise(function acceptIt(accept) {
        accept()
      })

      t.ok(p instanceof Promise, 'instanceof should work on wrapped Promise')
      t.ok(p instanceof OriginalPromise, 'instanceof should work on unwrapped Promise')
      t.end()
    })
  })

  tap.test('should throw when called without executor', function testNoExecutor(t) {
    const OriginalPromise = Promise
    let unwrappedError
    let wrappedError
    let wrapped
    let unwrapped
    helper.loadTestAgent(t, { feature_flag: flags })

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

  tap.test('should work if something wraps promises first', function testWrapSecond(t) {
    const OriginalPromise = Promise

    util.inherits(WrappedPromise, Promise)
    global.Promise = WrappedPromise

    function WrappedPromise(executor) {
      const promise = new OriginalPromise(executor)
      promise.__proto__ = WrappedPromise.prototype
      return promise
    }

    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    t.teardown(function () {
      global.Promise = OriginalPromise
    })

    helper.runInTransaction(agent, function () {
      const p = new Promise(function noop() {})

      t.ok(p instanceof Promise, 'instanceof should work on nr wrapped Promise')
      t.ok(p instanceof WrappedPromise, 'instanceof should work on wrapped Promise')
      t.ok(p instanceof OriginalPromise, 'instanceof should work on unwrapped Promise')

      t.end()
    })
  })

  tap.test('should work if something wraps promises after', function testWrapFirst(t) {
    const OriginalPromise = Promise

    helper.loadTestAgent(t, { feature_flag: flags })
    util.inherits(WrappedPromise, Promise)
    global.Promise = WrappedPromise

    t.teardown(function () {
      global.Promise = OriginalPromise
    })

    function WrappedPromise(executor) {
      const promise = new OriginalPromise(executor)
      promise.__proto__ = WrappedPromise.prototype
      return promise
    }

    const p = new Promise(function noop() {})

    t.ok(p instanceof Promise, 'instanceof should work on nr wrapped Promise')
    t.ok(p instanceof WrappedPromise, 'instanceof should work on wrapped Promise')
    t.ok(p instanceof OriginalPromise, 'instanceof should work on unwrapped Promise')

    t.end()
  })

  tap.test('throw in executor', function testCatch(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment = null
    const exception = {}

    helper.runInTransaction(agent, function inTransaction(transaction) {
      new Promise(function () {
        segment = agent.tracer.getSegment()
        throw exception
      }).then(
        function () {
          t.fail('should have rejected promise')
          t.end()
        },
        function (val) {
          t.equal(this, undefined, 'context should be undefined')

          process.nextTick(function () {
            const keptTx = agent.tracer.getTransaction()
            t.equal(keptTx && keptTx.id, transaction.id, 'transaction should be preserved')
            t.equal(val, exception, 'should pass through error')

            // Using `.ok` intead of `.equal` to avoid giant test message that is
            // not useful in this case.
            t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

            t.end()
          })
        }
      )
    })
  })
}

function id(tx) {
  return tx && tx.id
}
