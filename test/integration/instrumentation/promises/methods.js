'use strict'

var helper = require('../../../lib/agent_helper')
var testTransactionState = require('./transaction-state')


var runMultiple = testTransactionState.runMultiple
var tasks = []
var interval = null


module.exports = function(t, library, loadLibrary) {
  loadLibrary = loadLibrary || function() { return require(library) }
  var ptap = new PromiseTap(t, loadLibrary())

  t.beforeEach(function(done) {
    if (interval) {
      clearInterval(interval)
    }
    interval = setInterval(function() {
      if (tasks.length) {
        tasks.pop()()
      }
    }, 25)
    setImmediate(done)
  })

  t.afterEach(function(done) {
    clearInterval(interval)
    interval = null
    setImmediate(done)
  })

  ptap.test('new Promise() throw', function(t) {
    testPromiseClassMethod(t, 2, function throwTest(Promise, name) {
      try {
        return (new Promise(function() {
          throw new Error(name + ' test error')
        })).then(function() {
          t.fail(name + ' Error should have been caught.')
        }, function(err) {
          t.ok(err, name + ' Error should go to the reject handler')
          t.equal(
            err.message,
            name + ' test error',
            name + ' Error should be as expected'
          )
        })
      } catch (e) {
        t.error(e)
        t.fail(name + ' Should have gone to reject handler')
      }
    })
  })

  ptap.test('new Promise() resolve then throw', function(t) {
    testPromiseClassMethod(t, 1, function resolveThrowTest(Promise, name) {
      try {
        return (new Promise(function(resolve) {
          resolve(name + ' foo')
          throw new Error(name + ' test error')
        })).then(function(res) {
          t.equal(res, name + ' foo', name + ' promise should be resolved.')
        }, function() {
          t.fail(name + ' Error should have been swallowed by promise.')
        })
      } catch (e) {
        t.fail(name + ' Error should have passed to `reject`.')
      }
    })
  })

  ptap.test('new Promise -> resolve', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return new Promise(function(resolve) { resolve(name) })
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 3, function resolveTest(Promise, name) {
        var tracer = helper.getAgent().tracer
        var inTx = !!tracer.segment
        return new Promise(function(resolve) {
          addTask(function() {
            t.notOk(tracer.segment, name + 'should lose tx')
            resolve('foobar ' + name)
          })
        }).then(function(res) {
          if (inTx) {
            t.ok(tracer.segment, name + 'should return tx')
          } else {
            t.notOk(tracer.segment, name + 'should not create tx')
          }
          t.equal(res, 'foobar ' + name, name + 'should resolve with correct value')
        })
      })
    })
  })

  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //

  ptap.test('Promise.all', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.all([name])
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 1, function(Promise, name) {
        var p1 = Promise.resolve(name + '1')
        var p2 = Promise.resolve(name + '2')

        return Promise.all([p1, p2]).then(function(result) {
          t.deepEqual(result, [name + '1', name + '2'], name + 'should not change result')
        })
      })
    })
  })

  ptap.test('Promise.any', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.any([name])
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 1, function(Promise, name) {
        return Promise.any([
          Promise.reject(name + 'rejection!'),
          Promise.resolve(name + 'resolved'),
          Promise.delay(15, name + 'delayed')
        ]).then(function(result) {
          t.equal(result, name + 'resolved', 'should not change the result')
        })
      })
    })
  })

  testTryBehavior('attempt')

  ptap.test('Promise.bind', function(t) {
    t.plan(3)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.bind(name)
      })
    })

    t.test('usage', function(t) {
      var ctx = {}
      testPromiseClassMethod(t, 2, function(Promise, name) {
        return Promise.bind(ctx, name).then(function(value) {
          t.equal(this, ctx, 'should have expected `this` value')
          t.equal(value, name, 'should not change passed value')
        })
      })
    })

    t.test('catch', function(t) {
      var ctx = {}
      var err = new Error('oh dear')
      testPromiseClassMethod(t, 2, function(Promise, name) {
        return new Promise(function(resolve, reject) {
          reject(err)
        }).bind(ctx, name).catch(function(reason) {
          t.equal(this, ctx, 'should have expected `this` value')
          t.equal(reason, err, 'should not change rejection reason')
        })
      })
    })
  })

  testResolveBehavior('cast')
  ptap.skip('Promise.config')

  // TODO: Enable this test after deprecating Node 0.10 and 0.12.
  ptap.skip('Promise.coroutine')
  // ptap.test('Promise.coroutine', function(t) {
  //   t.plan(2)
  //
  //   t.test('context', function(t) {
  //     testPromiseContext(t, function(Promise, name) {
  //       return Promise.coroutine(function*(name) {
  //         for (var i = 0; i < 10; ++i) {
  //           yield Promise.delay(5)
  //         }
  //         return name
  //       })(name)
  //     })
  //   })
  //
  //   t.test('usage', function(t) {
  //     testPromiseClassMethod(t, 4, function(Promise, name) {
  //       var count = 0
  //
  //       t.doesNotThrow(function() {
  //         Promise.coroutine.addYieldHandler(function(value) {
  //           if (value === name) {
  //             t.pass('should call yield handler')
  //             return Promise.resolve(value + ' yielded')
  //           }
  //         })
  //       }, 'should be able to add yield handler')
  //
  //       return Promise.coroutine(function*(name) {
  //         for (var i = 0; i < 10; ++i) {
  //           yield Promise.delay(5)
  //           ++count
  //         }
  //         return yield name
  //       })(name).then(function(result) {
  //         t.equal(count, 10, 'should step through whole coroutine')
  //         t.equal(result, name + ' yielded', 'should pass through resolve value')
  //       })
  //     })
  //   })
  // })

  ptap.skip('Promise.defer')

  ptap.test('Promise.delay', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.delay(5, name)
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 3, function(Promise, name) {
        var DELAY = 500
        var MARGIN = 100
        var start = Date.now()
        return Promise.delay(DELAY, name).then(function(result) {
          var duration = Date.now() - start
          t.ok(duration < DELAY + MARGIN, 'should not take more than expected time')
          t.ok(duration > DELAY - MARGIN, 'should not take less than expected time')
          t.equal(result, name, 'should pass through resolve value')
        })
      })
    })
  })

  ptap.test('Promise.each', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.each([name], function() {})
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 5, function(Promise, name) {
        return Promise.each([
          Promise.resolve(name + '1'),
          Promise.resolve(name + '2'),
          Promise.resolve(name + '3'),
          Promise.resolve(name + '4')
        ], function(value, i) {
          t.equal(value, name + (i + 1), 'should not change input to iterator')
        }).then(function(result) {
          t.deepEqual(result, [
            name + '1',
            name + '2',
            name + '3',
            name + '4'
          ])
        })
      })
    })
  })

  ptap.test('Promise.filter', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.filter([name], function() { return true })
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 1, function(Promise, name) {
        return Promise.filter([
          Promise.resolve(name + '1'),
          Promise.resolve(name + '2'),
          Promise.resolve(name + '3'),
          Promise.resolve(name + '4')
        ], function(value) {
          return Promise.resolve(/[24]$/.test(value))
        }).then(function(result) {
          t.deepEqual(result, [name + '2', name + '4'], 'should not change the result')
        })
      })
    })
  })

  testResolveBehavior('fulfilled')
  testFromCallbackBehavior('fromCallback')
  testFromCallbackBehavior('fromNode')

  ptap.test('Promise.getNewLibraryCopy', function(t) {
    helper.loadTestAgent(t)
    var Promise = loadLibrary()
    var Promise2 = Promise.getNewLibraryCopy()

    t.ok(Promise2.resolve.__NR_original, 'should have wrapped class methods')
    t.ok(Promise2.prototype.then.__NR_original, 'should have wrapped instance methods')
    t.end()
  })

  ptap.skip('Promise.hasLongStackTraces')

  ptap.test('Promise.is', function(t) {
    helper.loadTestAgent(t)
    var Promise = loadLibrary()

    var p = new Promise(function(resolve) { setImmediate(resolve) })
    t.ok(Promise.is(p), 'should not break promise identification (new)')

    p = p.then(function() {})
    t.ok(Promise.is(p), 'should not break promise identification (then)')

    t.end()
  })

  ptap.test('Promise.join', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.join(name)
      })
    })

    t.test('usage', function(t) {
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
  })

  ptap.skip('Promise.longStackTraces')

  ptap.test('Promise.map', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.map([name], function(v) { return v.toUpperCase() })
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 1, function(Promise, name) {
        return Promise.map([
          Promise.resolve('1'),
          Promise.resolve('2')
        ], function(item) {
          return Promise.resolve(name + item)
        }).then(function(result) {
          t.deepEqual(
            result, [name + '1', name + '2'],
            'should not change the result'
          )
        })
      })
    })
  })

  ptap.test('Promise.mapSeries', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.mapSeries([name], function(v) { return v.toUpperCase() })
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 1, function(Promise, name) {
        return Promise.mapSeries([
          Promise.resolve('1'),
          Promise.resolve('2')
        ], function(item) {
          return Promise.resolve(name + item)
        }).then(function(result) {
          t.deepEqual(
            result, [name + '1', name + '2'],
            'should not change the result'
          )
        })
      })
    })
  })

  ptap.test('Promise.method', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.method(function() { return name })()
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 3, function methodTest(Promise, name) {
        var fn = Promise.method(function() {
          throw new Error('Promise.method test error')
        })

        return fn().then(function() {
          t.fail(name + 'should not go into resolve after throwing')
        }, function(err) {
          t.ok(err, name + 'should have error')
          if (err) {
            t.equal(
              err.message, 'Promise.method test error',
              name + 'should be correct error'
            )
          }
        }).then(function() {
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
  })

  ptap.test('Promise.noConflict', function(t) {
    helper.loadTestAgent(t)
    var Promise = loadLibrary()
    var Promise2 = Promise.noConflict()

    t.ok(Promise2.resolve.__NR_original, 'should have wrapped class methods')
    t.ok(Promise2.prototype.then.__NR_original, 'should have wrapped instance methods')
    t.end()
  })

  ptap.skip('Promise.onPossiblyUnhandledRejection')
  ptap.skip('Promise.onUnhandledRejectionHandled')

  ptap.test('Promise.promisify', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.promisify(function(cb) { cb(null, name) })()
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 3, function methodTest(Promise, name) {
        var fn = Promise.promisify(function(cb) {
          cb(new Error('Promise.promisify test error'))
        })

        return fn().then(function() {
          t.fail(name + 'should not go into resolve after throwing')
        }, function(err) {
          t.ok(err, name + 'should have error')
          if (err) {
            t.equal(
              err.message, 'Promise.promisify test error',
              name + 'should be correct error'
            )
          }
        }).then(function() {
          var foo = {what: 'Promise.promisify test object'}
          var fn2 = Promise.promisify(function(cb) {
            cb(null, foo)
          })

          return fn2().then(function(obj) {
            t.equal(obj, foo, name + 'should also work on success')
          })
        })
      })
    })
  })

  // XXX: Promise.promisifyAll _does_ cause state loss due to the construction
  //      of an internal promise that doesn't use the normal executor. However,
  //      instrumenting this method is treacherous as we will have to walk mimic
  //      the library's own property-finding techniques. In bluebird's case
  //      this involves walking the prototype chain and collecting the name of
  //      every property on every prototype.
  ptap.skip('Promise.promisifyAll')

  ptap.test('Promise.props', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.props({name: name})
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 1, function(Promise, name) {
        return Promise.props({
          first: Promise.resolve(name + '1'),
          second: Promise.resolve(name + '2')
        }).then(function(result) {
          t.deepEqual(
            result, {first: name + '1', second: name + '2'},
            'should not change results'
          )
        })
      })
    })
  })

  ptap.test('Promise.race', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.race([name])
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 1, function(Promise, name) {
        return Promise.race([
          Promise.resolve(name + 'resolved'),
          Promise.reject(name + 'rejection!'),
          Promise.delay(15, name + 'delayed')
        ]).then(function(result) {
          t.equal(result, name + 'resolved', 'should not change the result')
        })
      })
    })
  })

  ptap.test('Promise.reduce', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.reduce([name, name], function(a, b) { return a + b })
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 1, function(Promise, name) {
        return Promise.reduce([
          Promise.resolve('1'),
          Promise.resolve('2'),
          Promise.resolve('3'),
          Promise.resolve('4')
        ], function(a, b) {
          return Promise.resolve(name + a + b)
        }).then(function(result) {
          t.equal(result, name + name + name + '1234', 'should not change the result')
        })
      })
    })
  })

  ptap.skip('Promise.pending')
  testRejectBehavior('reject')
  testRejectBehavior('rejected')
  testResolveBehavior('resolve')

  // Settle was deprecated in Bluebird v3.
  ptap.skip('Promise.settle')
  ptap.skip('Promise.setScheduler')

  ptap.test('Promise.some', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.some([name], 1)
      })
    })

    t.test('usage', function(t) {
      testPromiseClassMethod(t, 1, function(Promise, name) {
        return Promise.some([
          Promise.resolve(name + 'resolved'),
          Promise.reject(name + 'rejection!'),
          Promise.delay(100, name + 'delayed more'),
          Promise.delay(5, name + 'delayed')
        ], 2).then(function(result) {
          t.deepEqual(
            result, [name + 'resolved', name + 'delayed'],
            'should not change the result'
          )
        })
      })
    })
  })

  // Spawn was deprecated in Bluebird v3.
  ptap.skip('Promise.spawn')
  testTryBehavior('try')
  ptap.skip('Promise.using')

  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //


  ptap.test('Promise#all', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve([
          Promise.resolve(name + '1'),
          Promise.resolve(name + '2')
        ]).all()
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function(Promise, p, name) {
        return p.then(function() {
          return [
            Promise.resolve(name + '1'),
            Promise.resolve(name + '2')
          ]
        }).all().then(function(result) {
          t.deepEqual(result, [name + '1', name + '2'], name + 'should not change result')
        })
      })
    })
  })

  ptap.test('Promise#any', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve([
          Promise.reject(name + 'rejection!'),
          Promise.resolve(name + 'resolved'),
          Promise.delay(15, name + 'delayed')
        ]).any()
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function(Promise, p, name) {
        return p.then(function() {
          return [
            Promise.reject(name + 'rejection!'),
            Promise.resolve(name + 'resolved'),
            Promise.delay(15, name + 'delayed')
          ]
        }).any().then(function(result) {
          t.equal(result, name + 'resolved', 'should not change the result')
        })
      })
    })
  })

  testAsCallbackBehavior('asCallback')

  ptap.test('Promise#bind', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve(name).bind({name: name})
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 2, function bindTest(Promise, p, name) {
        var foo = {what: 'test object'}
        return p.bind(foo).then(function(res) {
          t.equal(this, foo, name + 'should have correct this value')
          t.same(res, [1, 2, 3, name], name + 'parameters should be correct')
        })
      })
    })
  })

  ptap.skip('Promise#break')

  ptap.test('Promise#call', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve({
          foo: function() { return Promise.resolve(name) }
        }).call('foo')
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 3, function callTest(Promise, p, name) {
        var foo = {
          test: function() {
            t.equal(this, foo, name + 'should have correct this value')
            t.pass(name + 'should call the test method of foo')
            return 'foobar'
          }
        }
        return p.then(function() {
          return foo
        }).call('test').then(function(res) {
          t.same(res, 'foobar', name + 'parameters should be correct')
        })
      })
    })
  })

  ptap.skip('Promise#cancel')

  testCatchBehavior('catch')

  ptap.test('Promise#catchReturn', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.reject(new Error()).catchReturn(name)
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function catchReturnTest(Promise, p, name) {
        var foo = {what: 'catchReturn test object'}
        return p.throw(new Error('catchReturn test error'))
          .catchReturn(foo)
          .then(function(res) {
            t.equal(res, foo, name + 'should pass throught the correct object')
          })
      })
    })
  })

  ptap.test('Promise#catchThrow', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.reject(new Error()).catchThrow(new Error(name))
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function catchThrowTest(Promise, p, name) {
        var foo = {what: 'catchThrow test object'}
        return p.throw(new Error('catchThrow test error'))
          .catchThrow(foo)
          .catch(function(err) {
            t.equal(err, foo, name + 'should pass throught the correct object')
          })
        })
    })
  })

  testCatchBehavior('caught')

  ptap.test('Promise#delay', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve(name).delay(10)
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 3, function delayTest(Promise, p, name) {
        var DELAY = 500
        var MARGIN = 100
        var start = Date.now()
        return p.return(name).delay(DELAY).then(function(result) {
          var duration = Date.now() - start
          t.ok(duration < DELAY + MARGIN, 'should not take more than expected time')
          t.ok(duration > DELAY - MARGIN, 'should not take less than expected time')
          t.equal(result, name, 'should pass through resolve value')
        })
      })
    })
  })

  ptap.skip('Promise#disposer')
  ptap.skip('Promise#done')

  ptap.test('Promise#each', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve([
          Promise.delay(Math.random() * 10, name + '1'),
          Promise.delay(Math.random() * 10, name + '2'),
          Promise.delay(Math.random() * 10, name + '3'),
          Promise.delay(Math.random() * 10, name + '4')
        ]).each(function(value, i) { return Promise.delay(i, value) })
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 5, function(Promise, p, name) {
        return p.then(function() {
          return [
            Promise.delay(Math.random() * 10, name + '1'),
            Promise.delay(Math.random() * 10, name + '2'),
            Promise.delay(Math.random() * 10, name + '3'),
            Promise.delay(Math.random() * 10, name + '4')
          ]
        }).each(function(value, i) {
          t.equal(value, name + (i + 1), 'should not change input to iterator')
        }).then(function(result) {
          t.deepEqual(result, [
            name + '1',
            name + '2',
            name + '3',
            name + '4'
          ])
        })
      })
    })
  })


  ptap.test('Promise#error', function(t) {
    t.plan(2)

    function OperationalError(message) {
      this.message = message
      this.isOperational = true
    }

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.reject(new OperationalError(name)).error(function(err) {
          return err
        })
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 2, function catchTest(Promise, p, name) {
        return p.error(function(err) {
          t.error(
            err,
            name + 'should not go into error from a resolved promise'
          )
        }).then(function() {
          throw new OperationalError('Promise#error test error')
        }).error(function(err) {
          t.ok(err, name + 'should pass error into rejection handler')
          t.equal(
            err && err.message, 'Promise#error test error',
            name + 'should be correct error'
          )
        })
      })
    })
  })

  ptap.test('Promise#filter', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve([
          Promise.resolve(name + '1'),
          Promise.resolve(name + '2'),
          Promise.resolve(name + '3'),
          Promise.resolve(name + '4')
        ]).filter(function(value, i) {
          return Promise.delay(i, /[24]$/.test(value))
        })
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function(Promise, p, name) {
        return p.then(function() {
          return [
            Promise.resolve(name + '1'),
            Promise.resolve(name + '2'),
            Promise.resolve(name + '3'),
            Promise.resolve(name + '4')
          ]
        }).filter(function(value) {
          return Promise.resolve(/[24]$/.test(value))
        }).then(function(result) {
          t.deepEqual(result, [name + '2', name + '4'], 'should not change the result')
        })
      })
    })
  })

  testFinallyBehavior('finally')

  ptap.test('Promise#get', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve({name: Promise.resolve(name)}).get('name')
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function getTest(Promise, p, name) {
        return p.get('length').then(function(res) {
          t.equal(res, 4, name + 'should get the property specified')
        })
      })
    })
  })

  ptap.skip('Promise#isCancellable')
  ptap.skip('Promise#isCancelled')
  ptap.skip('Promise#isFulfilled')
  ptap.skip('Promise#isPending')
  ptap.skip('Promise#isRejected')
  ptap.skip('Promise#isResolved')

  testFinallyBehavior('lastly')

  ptap.test('Promise#map', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve([
          Promise.resolve('1'),
          Promise.resolve('2')
        ]).map(function(item) { return Promise.resolve(name + item) })
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function(Promise, p, name) {
        return p.then(function() {
          return [
            Promise.resolve('1'),
            Promise.resolve('2')
          ]
        }).map(function(item) {
          return Promise.resolve(name + item)
        }).then(function(result) {
          t.deepEqual(
            result, [name + '1', name + '2'],
            'should not change the result'
          )
        })
      })
    })
  })

  ptap.test('Promise#mapSeries', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve([
          Promise.resolve('1'),
          Promise.resolve('2')
        ]).mapSeries(function(item) {
          return Promise.resolve(name + item)
        })
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function(Promise, p, name) {
        return p.then(function() {
          return [
            Promise.resolve('1'),
            Promise.resolve('2')
          ]
        }).mapSeries(function(item) {
          return Promise.resolve(name + item)
        }).then(function(result) {
          t.deepEqual(
            result, [name + '1', name + '2'],
            'should not change the result'
          )
        })
      })
    })
  })

  testAsCallbackBehavior('nodeify')

  ptap.test('Promise#props', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve({
          first: Promise.delay(5, name + '1'),
          second: Promise.delay(5, name + '2')
        }).props()
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function(Promise, p, name) {
        return p.then(function() {
          return {
            first: Promise.resolve(name + '1'),
            second: Promise.resolve(name + '2')
          }
        }).props().then(function(result) {
          t.deepEqual(
            result, {first: name + '1', second: name + '2'},
            'should not change results'
          )
        })
      })
    })
  })

  ptap.test('Promise#race', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve([
          Promise.resolve(name + 'resolved'),
          Promise.delay(15, name + 'delayed')
        ]).race()
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function(Promise, p, name) {
        return p.then(function() {
          return [
            Promise.resolve(name + 'resolved'),
            Promise.delay(15, name + 'delayed')
          ]
        }).race().then(function(result) {
          t.equal(result, name + 'resolved', 'should not change the result')
        })
      })
    })
  })

  ptap.skip('Promise#reason')

  ptap.test('Promise#reduce', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve([
          Promise.resolve('1'),
          Promise.resolve('2'),
          Promise.resolve('3'),
          Promise.resolve('4')
        ]).reduce(function(a, b) {
          return Promise.resolve(name + a + b)
        })
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function(Promise, p, name) {
        return p.then(function() {
          return [
            Promise.resolve('1'),
            Promise.resolve('2'),
            Promise.resolve('3'),
            Promise.resolve('4')
          ]
        }).reduce(function(a, b) {
          return Promise.resolve(name + a + b)
        }).then(function(result) {
          t.equal(result, name + name + name + '1234', 'should not change the result')
        })
      })
    })
  })

  ptap.test('Promise#reflect', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve(name).reflect()
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 12, function(Promise, p, name) {
        return p.reflect().then(function(inspection) {
          // Inspection of a resolved promise.
          t.comment('resolved promise inspection')
          t.notOk(inspection.isPending(), name + 'should not be pending')
          t.notOk(inspection.isRejected(), name + 'should not be rejected')
          t.ok(inspection.isFulfilled(), name + 'should be fulfilled')
          t.notOk(inspection.isCancelled(), name + 'should not be cancelled')
          t.throws(function() {
            inspection.reason()
          }, name + 'should throw when accessing reason')
          t.ok(inspection.value(), name + 'should have the value')
        }).throw(new Error(name + 'test error')).reflect().then(function(inspection) {
          // Inspection of a rejected promise.
          t.comment('rejected promise inspection')
          t.notOk(inspection.isPending(), name + 'should not be pending')
          t.ok(inspection.isRejected(), name + 'should be rejected')
          t.notOk(inspection.isFulfilled(), name + 'should not be fulfilled')
          t.notOk(inspection.isCancelled(), name + 'should not be cancelled')
          t.ok(inspection.reason(), name + 'should have the reason for rejection')
          t.throws(function() {
            inspection.value()
          }, 'should throw accessing the value')
        })
      })
    })
  })

  ptap.test('Promise#return', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve().return(name)
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function returnTest(Promise, p, name) {
        var foo = {what: 'return test object'}
        return p.return(foo).then(function(res) {
          t.equal(res, foo, name + 'should pass throught the correct object')
        })
      })
    })
  })

  ptap.skip('Promise#settle')

  ptap.test('Promise#some', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve([
          Promise.resolve(name + 'resolved'),
          Promise.reject(name + 'rejection!'),
          Promise.delay(100, name + 'delayed more'),
          Promise.delay(5, name + 'delayed')
        ]).some(2)
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function(Promise, p, name) {
        return p.then(function() {
          return [
            Promise.resolve(name + 'resolved'),
            Promise.reject(name + 'rejection!'),
            Promise.delay(100, name + 'delayed more'),
            Promise.delay(5, name + 'delayed')
          ]
        }).some(2).then(function(result) {
          t.deepEqual(
            result, [name + 'resolved', name + 'delayed'],
            'should not change the result'
          )
        })
      })
    })
  })

  ptap.test('Promise#spread', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve([name, 1, 2, 3, 4]).spread(function() {})
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 1, function spreadTest(Promise, p, name) {
        return p.spread(function(a, b, c, d) {
          t.same([a, b, c, d], [1, 2, 3, name], name + 'parameters should be correct')
        })
      })
    })
  })

  ptap.skip('Promise#suppressUnhandledRejections')

  ptap.test('Promise#tap', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve(name).tap(function() {})
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 4, function tapTest(Promise, p, name) {
        return p.tap(function(res) {
          t.same(res, [1, 2, 3, name], name + 'should pass values into tap handler')
        }).then(function(res) {
          t.same(res, [1, 2, 3, name], name + 'should pass values beyond tap handler')
          throw new Error('Promise#tap test error')
        }).tap(function() {
          t.fail(name + 'should not call tap after rejected promises')
        }).catch(function(err) {
          t.ok(err, name + 'should pass error beyond tap handler')
          t.equal(
            err && err.message, 'Promise#tap test error',
            name + 'should be correct error'
          )
        })
      })
    })
  })

  ptap.test('Promise#tapCatch', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.reject(new Error(name)).tapCatch(function() {})
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 3, function tapTest(Promise, p, name) {
        return p.throw(new Error(name)).tapCatch(function(err) {
          t.equal(
            err && err.message, name,
            name + 'should pass values into tapCatch handler'
          )
        }).then(function() {
          t.fail('should not enter following resolve handler')
        }).catch(function(err) {
          t.equal(
            err && err.message, name,
            name + 'should pass values beyond tapCatch handler'
          )
          return name + 'resolve test'
        }).tapCatch(function() {
          t.fail(name + 'should not call tapCatch after resolved promises')
        }).then(function(value) {
          t.equal(
            value, name + 'resolve test',
            name + 'should pass error beyond tap handler'
          )
        })
      })
    })
  })

  ptap.test('Promise#then', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve().then(function() { return name })
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 3, function thenTest(Promise, p, name) {
        return p.then(function(res) {
          t.same(res, [1, 2, 3, name], name + 'should have the correct result value')
          throw new Error('Promise#then test error')
        }).then(function() {
          t.fail(name + 'should not go into resolve handler from rejected promise')
        }, function(err) {
          t.ok(err, name + 'should pass error into thenned rejection handler')
          t.equal(
            err && err.message, 'Promise#then test error',
            name + 'should be correct error'
          )
        })
      })
    })
  })

  ptap.test('Promise#thenReturn', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve().thenReturn(name)
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 3, function thenTest(Promise, p, name) {
        return p.thenReturn(name).then(function(res) {
          t.same(res, name, name + 'should have the correct result value')
          throw new Error('Promise#then test error')
        }).thenReturn('oops!').then(function() {
          t.fail(name + 'should not go into resolve handler from rejected promise')
        }, function(err) {
          t.ok(err, name + 'should pass error into thenned rejection handler')
          t.equal(
            err && err.message, 'Promise#then test error',
            name + 'should be correct error'
          )
        })
      })
    })
  })

  testThrowBehavior('thenThrow')

  ptap.test('Promise#timeout', function(t) {
    t.plan(2)

    t.test('context', function(t) {
      testPromiseContext(t, function(Promise, name) {
        return Promise.resolve(name).timeout(10)
      })
    })

    t.test('usage', function(t) {
      testPromiseInstanceMethod(t, 4, function(Promise, p, name) {
        var start = null
        return p.timeout(1000).then(function(res) {
          t.same(res, [1, 2, 3, name], name + 'should pass values into tap handler')
          start = Date.now()
        }, function(err) {
          t.error(err, name + 'should not have timed out')
        }).delay(1000, 'never see me').timeout(500, name + 'timed out').then(function() {
          t.fail(name + 'should have timed out long delay')
        }, function(err) {
          var duration = Date.now() - start
          t.ok(duration < 600, name + 'should not timeout slower than expected')
          t.ok(duration > 400, name + 'should not timeout faster than expected')
          t.equal(err.message, name + 'timed out', name + 'should have expected error')
        })
      })
    })
  })

  testThrowBehavior('throw')

  ptap.skip('Promise#toJSON')
  ptap.skip('Promise#toString')
  ptap.skip('Promise#value')

  // Check the tests against the library's own static and instance methods.
  ptap.check(loadLibrary)

  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //

  function testAsCallbackBehavior(methodName) {
    ptap.test('Promise#' + methodName, function(t) {
      t.plan(2)

      t.test('context', function(t) {
        testPromiseContext(t, function(Promise, name) {
          return Promise.resolve(name)[methodName](function() {})
        })
      })

      t.test('usage', function(t) {
        testPromiseInstanceMethod(t, 8, function asCallbackTest(Promise, p, name, agent) {
          var startTransaction = agent.getTransaction()
          return p[methodName](function(err, result) {
            var inCallbackTransaction = agent.getTransaction()
            t.equal(
              id(startTransaction),
              id(inCallbackTransaction),
              name + 'should have the same transaction inside the success callback'
            )
            t.notOk(err, name + 'should not have an error')
            t.same(result, [1, 2, 3, name], name + 'should have the correct result value')
          }).then(function() {
            throw new Error('Promise#' + methodName + ' test error')
          }).then(function() {
            t.fail(name + 'should have skipped then after rejection')
          })[methodName](function(err, result) {
            var inCallbackTransaction = agent.getTransaction()
            t.equal(
              id(startTransaction),
              id(inCallbackTransaction),
              name + 'should have the same transaction inside the error callback'
            )
            t.ok(err, name + 'should have error in ' + methodName)
            t.notOk(result, name + 'should not have a result')
            if (err) {
              t.equal(
                err.message,
                'Promise#' + methodName + ' test error',
                name + 'should be the correct error'
              )
            }
          }).catch(function(err) {
            t.ok(err, name + 'should have error in catch too')
            // Swallowing error that doesn't get caught in the asCallback/nodeify.
          })
        })
      })
    })
  }

  function testCatchBehavior(methodName) {
    ptap.test('Promise#' + methodName, function(t) {
      t.plan(2)

      t.test('context', function(t) {
        testPromiseContext(t, function(Promise, name) {
          return Promise.reject(new Error(name))[methodName](function(err) {
            return err
          })
        })
      })

      t.test('usage', function(t) {
        testPromiseInstanceMethod(t, 2, function catchTest(Promise, p, name) {
          return p[methodName](function(err) {
            t.error(
              err,
              name + 'should not go into ' + methodName + ' from a resolved promise'
            )
          }).then(function() {
            throw new Error('Promise#' + methodName + ' test error')
          })[methodName](function(err) {
            t.ok(err, name + 'should pass error into rejection handler')
            t.equal(
              err && err.message, 'Promise#' + methodName + ' test error',
              name + 'should be correct error'
            )
          })
        })
      })
    })
  }

  function testFinallyBehavior(methodName) {
    ptap.test('Promise#' + methodName, function(t) {
      t.plan(2)

      t.test('context', function(t) {
        testPromiseContext(t, function(Promise, name) {
          return Promise.resolve(name)[methodName](function() {})
        })
      })

      t.test('usage', function(t) {
        testPromiseInstanceMethod(t, 6, function finallyTest(Promise, p, name) {
          return p[methodName](function() {
            t.equal(arguments.length, 0, name + 'should not receive any parameters')
          }).then(function(res) {
            t.same(
              res, [1, 2, 3, name],
              name + 'should pass values beyond ' + methodName + ' handler'
            )
            throw new Error('Promise#' + methodName + ' test error')
          })[methodName](function() {
            t.equal(arguments.length, 0, name + 'should not receive any parameters')
            t.pass(
              name + 'should go into ' + methodName + ' handler from rejected promise'
            )
          }).catch(function(err) {
            t.ok(err, name + 'should pass error beyond ' + methodName + ' handler')
            if (err) {
              t.equal(
                err.message,
                'Promise#' + methodName + ' test error',
                name + 'should be correct error'
              )
            }
          })
        })
      })
    })
  }

  function testFromCallbackBehavior(methodName) {
    ptap.test('Promise.' + methodName, function(t) {
      t.plan(2)

      t.test('context', function(t) {
        testPromiseContext(t, function(Promise, name) {
          return Promise[methodName](function(cb) {
            addTask(cb, null, name)
          })
        })
      })

      t.test('usage', function(t) {
        testPromiseClassMethod(t, 3, function fromCallbackTest(Promise, name) {
          return Promise[methodName](function(cb) {
            addTask(cb, null, 'foobar ' + name)
          }).then(function(res) {
            t.equal(res, 'foobar ' + name, name + 'should pass result through')

            return Promise[methodName](function(cb) {
              addTask(cb, new Error('Promise.' + methodName + ' test error'))
            })
          }).then(function() {
            t.fail(name + 'should not resolve after rejecting')
          }, function(err) {
            t.ok(err, name + 'should have an error')
            if (err) {
              t.equal(
                err.message,
                'Promise.' + methodName + ' test error',
                name + 'should have correct error'
              )
            }
          })
        })
      })
    })
  }

  function testRejectBehavior(method) {
    ptap.test('Promise.' + method, function(t) {
      t.plan(2)

      t.test('context', function(t) {
        testPromiseContext(t, function(Promise, name) {
          return Promise[method](name)
        })
      })

      t.test('usage', function(t) {
        testPromiseClassMethod(t, 1, function rejectTest(Promise, name) {
          return Promise[method](name + ' ' + method + ' value')
            .then(function() {
              t.fail(name + 'should not resolve after a rejection')
            }, function(err) {
              t.equal(
                err, name + ' ' + method + ' value',
                name + 'should reject with the err'
              )
            })
        })
      })
    })
  }

  function testResolveBehavior(method) {
    ptap.test('Promise.' + method, function(t) {
      t.plan(2)

      t.test('context', function(t) {
        testPromiseContext(t, function(Promise, name) {
          return Promise[method](name)
        })
      })

      t.test('usage', function(t) {
        testPromiseClassMethod(t, 1, function resolveTest(Promise, name) {
          return Promise[method](name + ' ' + method + ' value')
            .then(function(res) {
              t.equal(res, name + ' ' + method + ' value', name + 'should pass the value')
            })
        })
      })
    })
  }

  function testThrowBehavior(methodName) {
    ptap.test('Promise#' + methodName, function(t) {
      t.plan(2)

      t.test('context', function(t) {
        testPromiseContext(t, function(Promise, name) {
          return Promise.resolve()[methodName](new Error(name))
        })
      })

      t.test('usage', function(t) {
        testPromiseInstanceMethod(t, 1, function throwTest(Promise, p, name) {
          var foo = {what: 'throw test object'}
          return p[methodName](foo).then(function() {
            t.fail(name + 'should not go into resolve handler after throw')
          })
          .catch(function(err) {
            t.equal(err, foo, name + 'should pass throught the correct object')
          })
        })
      })
    })
  }

  function testTryBehavior(method) {
    ptap.test('Promise.' + method, function(t) {
      t.plan(2)

      t.test('context', function(t) {
        testPromiseContext(t, function(Promise, name) {
          return Promise[method](function() { return name })
        })
      })

      t.test('usage', function(t) {
        testPromiseClassMethod(t, 3, function tryTest(Promise, name) {
          return Promise[method](function() {
            throw new Error('Promise.' + method + ' test error')
          }).then(function() {
            t.fail(name + 'should not go into resolve after throwing')
          }, function(err) {
            t.ok(err, name + 'should have error')
            if (err) {
              t.equal(
                err.message, 'Promise.' + method + ' test error',
                name + 'should be correct error'
              )
            }
          }).then(function() {
            var foo = {what: 'Promise.' + method + ' test object'}
            return Promise[method](function() {
              return foo
            }).then(function(obj) {
              t.equal(obj, foo, name + 'should also work on success')
            })
          })
        })
      })
    })
  }

  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //
  // ------------------------------------------------------------------------ //

  function testPromiseInstanceMethod(t, plan, testFunc) {
    var agent = helper.loadTestAgent(t)
    var Promise = loadLibrary()

    _testPromiseMethod(t, plan, agent, function(name) {
      var p = Promise.resolve([1, 2, 3, name])
      return testFunc(Promise, p, name, agent)
    })
  }

  function testPromiseClassMethod(t, plan, testFunc) {
    var agent = helper.loadTestAgent(t)
    var Promise = loadLibrary()

    _testPromiseMethod(t, plan, agent, function(name) {
      return testFunc(Promise, name)
    })
  }

  function testPromiseContext(t, factory) {
    var agent = helper.loadTestAgent(t)
    var Promise = loadLibrary()

    _testPromiseContext(t, agent, factory.bind(null, Promise))
  }
}


function addTask() {
  var args = [].slice.apply(arguments)
  var fn = args.shift() // Pop front.
  tasks.push(function() {
    fn.apply(null, args)
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
      .then(function() {
        t.notOk(agent.getTransaction(), name + 'has no transaction')
        testInTransaction()
      }, function(err) {
        if (err) {
          /* eslint-disable no-console */
          console.log((err && err.stack) || err)
          /* eslint-enable no-console */
        }
        t.notOk(err, name + 'should not result in error')
        t.end()
      })
    isAsync = true
  }, '[no tx] should not throw out of a transaction')

  function testInTransaction() {
    runMultiple(COUNT, function(i, cb) {
      helper.runInTransaction(agent, function transactionWrapper(transaction) {
        var name = '[tx ' + i + '] '
        t.doesNotThrow(function inTXPromiseThrowTest() {
          var isAsync = false
          testFunc(name)
            .finally(function() {
              t.ok(isAsync, name + 'should have executed asynchronously')
            })
            .then(function() {
              t.equal(
                id(agent.getTransaction()),
                id(transaction),
                name + 'has the right transaction'
              )
            }, function(err) {
              if (err) {
                /* eslint-disable no-console */
                console.log(err)
                console.log(err.stack)
                /* eslint-enable no-console */
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

function _testPromiseContext(t, agent, factory) {
  t.plan(4)

  // Create in tx a, continue in tx b
  t.test('context switch', function(t) {
    t.plan(2)

    var ctxA = helper.runInTransaction(agent, function(tx) {
      return {
        transaction: tx,
        promise: factory('[tx a] ')
      }
    })

    helper.runInTransaction(agent, function(txB) {
      t.tearDown(function() {
        ctxA.transaction.end()
        txB.end()
      })
      t.notEqual(id(ctxA.transaction), id(txB), 'should not be in transaction a')

      ctxA.promise.catch(function() {}).then(function() {
        var tx = agent.tracer.getTransaction()
        t.comment('A: ' + id(ctxA.transaction) + ' | B: ' + id(txB))
        t.equal(id(tx), id(ctxA.transaction), 'should be in expected context')
      })
    })
  })

  // Create in tx a, continue outside of tx
  t.test('context loss', function(t) {
    t.plan(2)

    var ctxA = helper.runInTransaction(agent, function(tx) {
      t.tearDown(function() {
        tx.end()
      })

      return {
        transaction: tx,
        promise: factory('[tx a] ')
      }
    })

    t.notOk(agent.tracer.getTransaction(), 'should not be in transaction')
    ctxA.promise.catch(function() {}).then(function() {
      var tx = agent.tracer.getTransaction()
      t.equal(id(tx), id(ctxA.transaction), 'should be in expected context')
    })
  })

  // Create outside tx, continue in tx a
  t.test('context gain', function(t) {
    t.plan(2)

    var promise = factory('[no tx] ')

    t.notOk(agent.tracer.getTransaction(), 'should not be in transaction')
    helper.runInTransaction(agent, function(tx) {
      promise.catch(function() {}).then(function() {
        var tx2 = agent.tracer.getTransaction()
        t.equal(id(tx2), id(tx), 'should be in expected context')
      })
    })
  })

  // Create test in tx a, end tx a, continue in tx b
  t.test('context expiration', function(t) {
    t.plan(2)

    var ctxA = helper.runInTransaction(agent, function(tx) {
      return {
        transaction: tx,
        promise: factory('[tx a] ')
      }
    })

    ctxA.transaction.end(function() {
      helper.runInTransaction(agent, function(txB) {
        t.tearDown(function() {
          ctxA.transaction.end()
          txB.end()
        })
        t.notEqual(id(ctxA.transaction), id(txB), 'should not be in transaction a')

        ctxA.promise.catch(function() {}).then(function() {
          var tx = agent.tracer.getTransaction()
          t.comment('A: ' + id(ctxA.transaction) + ' | B: ' + id(txB))
          t.equal(id(tx), id(txB), 'should be in expected context')
        })
      })
    })
  })
}

function PromiseTap(t, Promise) {
  this.t = t
  this.testedClassMethods = []
  this.testedInstanceMethods = []
  this.Promise = Promise
}

PromiseTap.prototype.test = function(name, test) {
  var match = name.match(/^Promise([#.])(.+)$/)
  if (match) {
    var location = match[1]
    var methodName = match[2]
    var exists = false

    if (location === '.') {
      exists = typeof this.Promise[methodName] === 'function'
      this.testedClassMethods.push(methodName)
    } else if (location === '#') {
      exists = typeof this.Promise.prototype[methodName] === 'function'
      this.testedInstanceMethods.push(methodName)
    }

    this.t.test(name, function(t) {
      if (exists) {
        test(t)
      } else {
        t.pass(name + ' not supported by library')
        t.end()
      }
    })
  } else {
    this.t.test(name, test)
  }
}

PromiseTap.prototype.skip = function(name) {
  this.test(name, function(t) {
    t.pass('Skipping ' + name)
    t.end()
  })
}

PromiseTap.prototype.check = function(loadLibrary) {
  var self = this
  this.t.test('check', function(t) {
    helper.loadTestAgent(t)
    var Promise = loadLibrary()

    var classMethods = Object.keys(self.Promise).sort()
    self._check(t, Promise, classMethods, self.testedClassMethods, '.')

    var instanceMethods = Object.keys(self.Promise.prototype).sort()
    self._check(t, Promise.prototype, instanceMethods, self.testedInstanceMethods, '#')

    t.end()
  })
}

PromiseTap.prototype._check = function(t, source, methods, tested, type) {
  var prefix = 'Promise' + type
  var originalSource = type === '.' ? this.Promise : this.Promise.prototype

  methods.forEach(function(method) {
    var wrapped = source[method]
    var original = wrapped.__NR_original || originalSource[method]

    // Skip this property if it is internal (starts or ends with underscore), is
    // a class (starts with a capital letter), or is not a function.
    if (/(?:^[_A-Z]|_$)/.test(method) || typeof original !== 'function') {
      return
    }

    var longName = prefix + method
    t.ok(tested.indexOf(method) > -1, 'should test ' + prefix + method)

    Object.keys(original).forEach(function(key) {
      t.ok(wrapped[key] != null, 'should copy ' + longName + '.' + key)
    })
  }, this)
}

function id(tx) {
  return tx && tx.id
}
