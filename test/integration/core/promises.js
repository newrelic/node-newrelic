/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const genericTestDir = '../../integration/instrumentation/promises/'
const helper = require('../../lib/agent_helper')
const util = require('util')
const testPromiseSegments = require(genericTestDir + 'segments')
const testTransactionState = require(genericTestDir + 'transaction-state')

module.exports = function runTests(t, flags) {
  t.test('transaction state', function (t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    t.autoend()
    testTransactionState(t, agent, Promise)
  })

  // XXX Promise segments in native instrumentation are currently less than ideal
  // XXX in structure. Transaction state is correctly maintained, and all segments
  // XXX are created, but the heirarchy is not correct.
  t.test('segments', function (t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    t.autoend()
    testPromiseSegments(t, agent, Promise)
  })

  t.test('then', function testThen(t) {
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

  t.test('multi then', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      new Promise(function executor(accept, reject) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          accept(15)
          reject(10)
        }, 0)
      })
        .then(next, fail)
        .then(function done(val) {
          t.equal(this, void 0, 'context should be undefined')
          process.nextTick(function finish() {
            t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
            t.equal(val, 15, 'should resolve with the correct value')
            t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

            t.end()
          })
        }, fail)

      function next(val) {
        t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
        t.equal(val, 15, 'should resolve with the correct value')
        t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')
        return val
      }

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  t.test('multi then async', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      new Promise(function executor(accept, reject) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          accept(15)
          reject(10)
        }, 0)
      })
        .then(next, fail)
        .then(function done(val) {
          t.equal(this, void 0, 'context should be undefined')
          process.nextTick(function finish() {
            t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
            t.equal(val, 15, 'should resolve with the correct value')
            t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

            t.end()
          })
        }, fail)

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

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  t.test('then reject', function testThenReject(t) {
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

  t.test('multi then reject', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      new Promise(function executor(accept, reject) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          reject(10)
          accept(15)
        }, 0)
      })
        .then(fail, next)
        .then(fail, done)

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

  t.test('multi then async reject', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      new Promise(function executor(accept, reject) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          reject(10)
          accept(15)
        }, 0)
      })
        .then(fail, next)
        .then(fail, function done(val) {
          t.equal(this, void 0, 'context should be undefined')
          process.nextTick(function finish() {
            t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
            t.equal(val, 10, 'should resolve with the correct value')
            t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

            t.end()
          })
        })

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

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  t.test('catch', function testCatch(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      new Promise(function executor(accept, reject) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          reject(10)
          accept(15)
        }, 0)
      }).catch(function done(val) {
        t.equal(this, void 0, 'context should be undefined')
        process.nextTick(function finish() {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'value should be preserved')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          t.end()
        })
      })
    })
  })

  t.test('multi catch', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      new Promise(function executor(accept, reject) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          reject(10)
          accept(15)
        }, 0)
      })
        .catch(function next(val) {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')
          throw val
        })
        .catch(function done(val) {
          t.equal(this, void 0, 'context should be undefined')
          process.nextTick(function finish() {
            t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
            t.equal(val, 10, 'should resolve with the correct value')
            t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

            t.end()
          })
        })
    })
  })

  t.test('multi catch async', function testThen(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      new Promise(function executor(accept, reject) {
        segment = agent.tracer.getSegment()
        setTimeout(function resolve() {
          reject(10)
          accept(15)
        }, 0)
      })
        .catch(function next(val) {
          t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
          t.equal(val, 10, 'should resolve with the correct value')
          t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

          return new Promise(function wait(accept, reject) {
            segment = agent.tracer.getSegment()
            setTimeout(function resolve() {
              reject(val)
            }, 0)
          })
        })
        .catch(function done(val) {
          t.equal(this, void 0, 'context should be undefined')
          process.nextTick(function finish() {
            t.equal(id(agent.getTransaction()), id(transaction), 'transaction should be preserved')
            t.equal(val, 10, 'should resolve with the correct value')
            t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

            t.end()
          })
        })
    })
  })

  t.test('Promise.resolve', function testResolve(t) {
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

  t.test('Promise.reject', function testReject(t) {
    const agent = helper.loadTestAgent(t, { feature_flag: flags })
    let segment

    helper.runInTransaction(agent, function inTransaction(transaction) {
      setTimeout(function reject() {
        Promise.reject(10)
          .then(null, function (error) {
            segment = agent.tracer.getSegment()
            throw error
          })
          .then(fail, function done(val) {
            t.equal(this, void 0, 'context should be undefined')
            process.nextTick(function finish() {
              t.equal(
                id(agent.getTransaction()),
                id(transaction),
                'transaction should be preserved'
              )
              t.equal(val, 10, 'value should be preserved')
              t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

              t.end()
            })
          })
      }, 0)

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  t.test('Promise.all', function testAll(t) {
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

  t.test('Promise.all reject', function testAllReject(t) {
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

  t.test('Promise.race', function testRace(t) {
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

  t.test('Promise.race reject', function testRaceReject(t) {
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
          .then(fail, function done(val) {
            t.equal(this, void 0, 'context should be undefined')
            process.nextTick(function finish() {
              t.equal(
                id(agent.getTransaction()),
                id(transaction),
                'transaction should be preserved'
              )
              t.same(val, 10, 'value should be preserved')
              t.ok(agent.tracer.getSegment() === segment, 'segment should be preserved')

              t.end()
            })
          })
      }, 0)

      function fail() {
        t.fail('should not be called')
        t.end()
      }
    })
  })

  t.test('should throw when called without executor', function testNoExecutor(t) {
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

  t.test('should work if something wraps promises first', function testWrapSecond(t) {
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

  t.test('should work if something wraps promises after', function testWrapFirst(t) {
    const OriginalPromise = Promise

    helper.loadTestAgent(t, { feature_flag: flags })
    util.inherits(WrappedPromise, Promise)
    global.Promise = WrappedPromise

    t.teardown(function () {
      global.Promise = OriginalPromise
    })

    /* eslint-disable-next-line sonarjs/no-identical-functions -- Disabled due to wrapping behavior and scoping issue */
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

  t.test('throw in executor', function testCatch(t) {
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
