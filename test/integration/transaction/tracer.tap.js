/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const test = tap.test
const helper = require('../../lib/agent_helper')
const EventEmitter = require('events').EventEmitter

test('bind in transaction', function testBind(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  const context = {}
  t.plan(10)

  helper.runInTransaction(agent, function inTrans(transaction) {
    const root = transaction.trace.root
    const other = tracer.createSegment('other')
    t.equal(tracer.getTransaction(), transaction, 'should start in transaction')

    t.comment('implicit segment bind')
    t.equal(contextManager.getContext(), root, 'should start at root segment')
    let bound = tracer.bindFunction(compare)

    contextManager.setContext(null)
    bound.call(context, root)
    t.equal(contextManager.getContext(), null, 'should reset segment after being called')

    t.comment('explicit segment bind')
    bound = tracer.bindFunction(compare, other)
    bound.call(context, other)

    t.comment('null segment bind')
    contextManager.setContext(root)
    bound = tracer.bindFunction(compare, null)

    t.equal(contextManager.getContext(), root, 'should be back to root segment')
    bound.call(context, root)

    t.end()

    function compare(expected) {
      t.equal(this, context, 'should pass through context')
      t.equal(contextManager.getContext(), expected, 'should have expected segment')
    }
  })
})

test('bind outside transaction', function testBind(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  let root
  t.plan(5)

  let bound = tracer.bindFunction(compare)
  compare(null)
  bound(null)

  helper.runInTransaction(agent, function inTrans(transaction) {
    root = transaction.trace.root
    bound(null)
  })

  bound = tracer.bindFunction(compare, root)
  bound(root)
  compare(null)

  t.end()

  function compare(expected) {
    t.equal(contextManager.getContext(), expected)
  }
})

test('bind + throw', function testThrows(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  const error = new Error('oh no!!')
  t.plan(12)

  helper.runInTransaction(agent, function inTrans(transaction) {
    t.comment('root is active')
    const root = transaction.trace.root
    compare(dangerous(root, root), root)
    compare(dangerous(null, root), root)

    t.comment('null is active')
    contextManager.setContext(null)
    compare(dangerous(root, root), null)
    compare(dangerous(null, null), null)

    t.end()
  })

  function compare(run, expected) {
    try {
      run()
    } catch (err) {
      t.equal(err, error, 'should have expected error')
      t.equal(contextManager.getContext(), expected, 'should catch in context')
    }
  }

  function dangerous(segment, expected) {
    return tracer.bindFunction(function bound() {
      t.equal(contextManager.getContext(), expected, 'should have expected segment')
      throw error
    }, segment)
  }
})

test('bind + capture error', function testThrows(t) {
  helper.temporarilyOverrideTapUncaughtBehavior(tap, t)

  const { agent, contextManager, tracer } = setupAgent(t)

  const error = new Error('oh no!!')
  const name = 'some custom transaction name'
  t.plan(8)

  // These don't really do anything with newest tap but leaving
  // for now in cases changes in future.
  helper.temporarilyRemoveListeners(t, process, 'uncaughtException')
  helper.temporarilyRemoveListeners(t, t.domain, 'error')

  // Need to break out of tap's domain so the error is truly uncaught.
  const pin = setTimeout(function () {}, 5000)
  helper.runOutOfContext(function () {
    clearTimeout(pin)

    helper.runInTransaction(agent, inTrans)
  })

  function inTrans(transaction) {
    const other = tracer.createSegment('other')
    transaction.name = name
    process.once('uncaughtException', function onUncaughtException(err) {
      const logged = agent.errors.traceAggregator.errors[0]
      t.notOk(contextManager.getContext(), 'should not leak transaction into handler')

      t.equal(err, error, 'should have expected error')
      t.equal(Object.keys(error).length, 0, 'error should not have extra properties')
      t.notOk(err.__NR_transaction, 'should not hold onto transaction')

      // global error is not tied to a transaction, so its name should not be
      // the transaction name
      if (t.ok(logged, 'should have a logged error')) {
        t.notEqual(name, logged[1], 'should not have a transaction with the error')
        t.equal(error.message, logged[2], 'should have the error message')
      }
      t.end()
    })
    dangerous(other)()
  }

  function dangerous(segment) {
    return tracer.bindFunction(function bound() {
      // next tick to avoid tap error handler
      process.nextTick(function ohno() {
        t.equal(contextManager.getContext(), segment)
        throw error
      })
    }, segment)
  }
})

test('bind + full', function testThrows(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  t.plan(10)

  helper.runInTransaction(agent, function inTrans() {
    const segment = tracer.createSegment('segment')
    const notStarted = tracer.createSegment('notStarted')
    let bound = tracer.bindFunction(check, segment, true)

    t.notOk(segment.timer.hrstart)
    bound()
    t.ok(segment.timer.hrDuration)

    bound = tracer.bindFunction(checkNotStarted, notStarted, false)

    t.notOk(notStarted.timer.hrstart)
    bound()
    t.notOk(notStarted.timer.hrDuration)

    t.end()

    function check() {
      t.ok(segment.timer.hrstart)
      t.equal(contextManager.getContext(), segment)
      t.notOk(segment.timer.hrDuration)
    }

    function checkNotStarted() {
      t.notOk(notStarted.timer.hrstart)
      t.equal(contextManager.getContext(), notStarted)
      t.notOk(notStarted.timer.hrDuration)
    }
  })
})

test('bind + bad function', function testThrows(t) {
  const { agent, tracer } = setupAgent(t)

  t.plan(5)

  helper.runInTransaction(agent, function inTrans() {
    const obj = {}
    t.equal(tracer.bindFunction(false), false)
    t.equal(tracer.bindFunction(true), true)
    t.equal(tracer.bindFunction('foo'), 'foo')
    t.equal(tracer.bindFunction(25), 25)
    t.equal(tracer.bindFunction(obj), obj)
    t.end()
  })
})

test('bind + args', function testThrows(t) {
  const { agent, tracer } = setupAgent(t)

  let bound
  t.plan(1)

  helper.runInTransaction(agent, function inTrans() {
    bound = tracer.bindFunction(function withArgs() {
      t.deepEqual([].slice.call(arguments), [1, 2, 3])
    })
  })

  bound(1, 2, 3)
  t.end()
})

test('getTransaction', function testGetTransaction(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  t.plan(5)

  t.notOk(tracer.getTransaction())

  helper.runInTransaction(agent, function inTrans(transaction) {
    t.equal(tracer.getTransaction(), transaction)
    t.equal(contextManager.getContext().transaction, transaction)
    transaction.end()
    t.notOk(tracer.getTransaction())
    t.equal(contextManager.getContext().transaction, transaction)
    t.end()
  })
})

test('getSegment', function testGetTransaction(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  t.plan(5)

  t.notOk(tracer.getSegment())
  helper.runInTransaction(agent, function inTrans(transaction) {
    const root = transaction.trace.root
    t.equal(tracer.getSegment(), root)
    t.equal(contextManager.getContext(), tracer.getSegment())

    setTimeout(function onTimeout() {
      const segment = root.children[0].children[0]
      t.equal(tracer.getSegment(), segment)
      t.equal(tracer.getSegment().name, 'Callback: onTimeout')
    }, 0)
  })
})

test('createSegment', function testCreateSegment(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  let root
  t.plan(10)

  const noSegment = tracer.createSegment('outside transaction')
  t.equal(noSegment, null)

  helper.runInTransaction(agent, function inTrans(transaction) {
    const segment = tracer.createSegment('inside transaction')
    root = transaction.trace.root
    t.equal(contextManager.getContext(), root)
    t.equal(segment.name, 'inside transaction')

    tracer.bindFunction(function bound() {
      t.equal(segment.timer.hrstart, null)
      t.equal(segment.timer.hrDuration, null)
      t.equal(contextManager.getContext(), segment)
    }, segment)()
  })

  const outerSegment = tracer.createSegment('outside with parent', null, root)

  tracer.bindFunction(function bound() {
    t.equal(outerSegment.name, 'outside with parent')
    t.equal(outerSegment.timer.hrstart, null)
    t.equal(outerSegment.timer.hrDuration, null)
    t.equal(contextManager.getContext(), outerSegment)
  }, outerSegment)()

  t.end()
})

test('createSegment + recorder', function testCreateSegment(t) {
  const { agent, tracer } = setupAgent(t)

  t.plan(2)

  helper.runInTransaction(agent, function inTrans(transaction) {
    const segment = tracer.createSegment('inside transaction', recorder)
    t.equal(segment.name, 'inside transaction')

    transaction.end()
    t.end()

    function recorder(seg) {
      t.equal(seg, segment)
    }
  })
})

test('addSegment', function addSegmentTest(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  let root
  t.plan(8)

  t.equal(tracer.addSegment('outside', null, null, false, check), null)

  helper.runInTransaction(agent, function inTrans(transaction) {
    const segment = tracer.addSegment('inside', null, null, false, check)

    t.equal(segment.name, 'inside')
    root = transaction.trace.root
    t.equal(root.children[0], segment)
  })

  const outside = tracer.addSegment('outside', null, root, false, check)

  t.equal(outside.name, 'outside')
  t.equal(root.children[1], outside)

  t.end()

  function check(segment) {
    t.equal(segment, contextManager.getContext())
    return contextManager.getContext()
  }
})

test('addSegment + recorder', function addSegmentTest(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  let segment
  t.plan(7)

  helper.runInTransaction(agent, function inTrans(transaction) {
    segment = tracer.addSegment('inside', record, null, false, check)
    const root = transaction.trace.root

    t.equal(segment.name, 'inside')
    t.equal(segment.timer.hrDuration, null)
    t.equal(root.children[0], segment)

    transaction.end()
    t.end()
  })

  function check(seg) {
    t.equal(seg, contextManager.getContext())
    t.equal(seg.timer.hrstart, null)
    t.equal(seg.timer.hrDuration, null)
    return contextManager.getContext()
  }

  function record(seg) {
    t.equal(seg, segment)
    return contextManager.getContext()
  }
})

test('addSegment + full', function addSegmentTest(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  t.plan(7)

  helper.runInTransaction(agent, function inTrans(transaction) {
    const segment = tracer.addSegment('inside', null, null, true, check)
    const root = transaction.trace.root

    t.equal(segment.name, 'inside')
    t.ok(segment.timer.hrDuration)
    t.equal(root.children[0], segment)

    transaction.end()
    // because having plan + end after async causes issues
    t.ok(true)
    t.end()
  })

  function check(segment) {
    t.equal(segment, contextManager.getContext())
    t.ok(segment.timer.hrstart)
    t.equal(segment.timer.hrDuration, null)
    return contextManager.getContext()
  }
})

test('transactionProxy', function testTransactionProxy(t) {
  const { contextManager, tracer } = setupAgent(t)

  t.plan(10)

  t.equal(tracer.transactionProxy(null), null)
  t.equal(tracer.transactionProxy(5), 5)
  t.equal(tracer.transactionProxy())
  t.equal(tracer.transactionProxy('test'), 'test')
  tracer.transactionProxy(handler)(1, 2, 3)
  t.end()

  function handler() {
    const transaction = tracer.getTransaction()
    const root = transaction.trace.root

    t.deepEqual([].slice.call(arguments), [1, 2, 3])
    t.equal(root.name, 'ROOT')
    t.equal(root, contextManager.getContext())
    t.ok(transaction)

    tracer.transactionProxy(handler2)()

    function handler2() {
      t.equal(tracer.getTransaction(), transaction)
      t.equal(root, contextManager.getContext())
    }
  }
})

test('transactionNestProxy', function testTransactionNestProxy(t) {
  const { contextManager, tracer } = setupAgent(t)

  t.plan(20)

  t.equal(tracer.transactionNestProxy('web', null), null, 'should not wrap null')
  t.equal(tracer.transactionNestProxy('web', 5), 5, 'should not wrap numbers')
  t.equal(tracer.transactionNestProxy('web'), undefined, 'should not wrap undefined')
  t.equal(tracer.transactionNestProxy('web', 'test'), 'test', 'should not wrap strings')
  tracer.transactionNestProxy('web', handler)(1, 2, 3)
  t.end()

  function handler() {
    const transaction = tracer.getTransaction()
    const root = transaction.trace.root

    t.deepEqual([].slice.call(arguments), [1, 2, 3])
    t.equal(root.name, 'ROOT')
    t.equal(root, contextManager.getContext())
    t.ok(transaction)
    transaction.type = 'web'
    transaction.baseSegment = root

    tracer.transactionNestProxy('web', handler2)()
    tracer.transactionNestProxy('bg', handler3)()
    transaction.type = 'bg'
    transaction.baseSegment = root
    tracer.transactionNestProxy('web', handler3)()

    function handler2() {
      t.equal(tracer.getTransaction(), transaction)
      t.equal(root, contextManager.getContext())
    }

    function handler3() {
      const transaction3 = tracer.getTransaction()
      const root3 = transaction3.trace.root

      t.equal(root.name, 'ROOT')
      t.equal(root3, contextManager.getContext())
      t.ok(transaction3)
      t.notEqual(tracer.getTransaction(), transaction)
      t.notEqual(contextManager.getContext(), root)
    }
  }
})

test('bindEmitter', function testbindEmitter(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  const emitter = new EventEmitter()
  const emitter2 = new EventEmitter()
  const data = {}
  let root

  t.plan(20)

  emitter.on('before', check(null))
  tracer.bindEmitter(emitter)
  emitter.on('after', check(null))

  emitter.emit('before', data)
  emitter.emit('after', data)

  tracer.bindEmitter(emitter2, null)

  helper.runInTransaction(agent, function inTrans() {
    root = contextManager.getContext()
    emitter.emit('before', data)
    emitter.emit('after', data)

    emitter2.on('before', check(root))
    tracer.bindEmitter(emitter2)
    emitter2.on('after', check(root))
    emitter2.emit('before', data)
    emitter2.emit('after', data)
  })

  emitter2.emit('before', data)
  emitter2.emit('after', data)

  const emitter3 = new EventEmitter()
  emitter3.on('before', check(root))
  tracer.bindEmitter(emitter3, root)
  emitter3.on('after', check(root))
  emitter3.emit('before', data)
  emitter3.emit('after', data)
  t.end()

  function check(expected) {
    return function onEvent(eventData) {
      t.equal(eventData, data, 'should pass through event data')
      t.equal(contextManager.getContext(), expected, 'should have expected segment')
    }
  }
})

test('tracer.slice', function testSlice(t) {
  const { tracer } = setupAgent(t)

  t.plan(3)

  check(1, 2, 3)

  function check() {
    const args = tracer.slice(arguments)
    t.deepEqual(args, [1, 2, 3])
    t.ok(Array.isArray(args))
    t.equal(typeof args.forEach, 'function')
  }
  t.end()
})

test('wrapFunctionNoSegment', function testwrapFunctionNoSegment(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  const outer = {}
  const inner = {}
  let segment = null

  t.plan(15)

  const wrapped = tracer.wrapFunctionNoSegment(doSomething)

  wrapped.call(outer, segment, [4], 4, check)

  helper.runInTransaction(agent, function runInTransaction(transaction) {
    segment = transaction.trace.root
    wrapped.call(outer, segment, [1, 2, 3], 1, 2, 3, check)
  })

  wrapped.call(outer, null, [4, 5], 4, 5, check)

  function doSomething(seg) {
    const args = tracer.slice(arguments)
    const callback = args.pop()
    t.equal(this, outer)
    t.equal(contextManager.getContext(), seg)
    process.nextTick(function next() {
      contextManager.setContext(null)
      callback.apply(inner, args)
    })
  }

  function check(seg, expected) {
    t.deepEqual([].slice.call(arguments, 2), expected)
    t.equal(contextManager.getContext(), seg)
    t.equal(this, inner)
  }
})

test('wrapFunction', function testwrapFunction(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  const outer = {}
  const inner = {}
  const returnVal = {}

  const args = ['a', 'b', 'c'].map(makeCallback)
  const wrapped = tracer.wrapFunction('my segment', record, callAll, wrapArgs, wrapReturn)

  t.plan(61)

  t.equal(wrapped.apply(outer, [null].concat(args)), returnVal)

  helper.runInTransaction(agent, function inTransaction() {
    t.equal(Object.getPrototypeOf(wrapped.apply(outer, ['my segment'].concat(args))), returnVal)
  })

  t.equal(wrapped.apply(outer, [null].concat(args)), returnVal)

  function makeCallback(val) {
    return function callback(parent, arg) {
      const segment = contextManager.getContext()
      t.equal(arg, val)
      t.equal(this, inner)
      if (parent) {
        t.ok(segment.timer.hrstart)
        t.notOk(segment.timer.hrDuration)
        t.notEqual(parent.children.indexOf(segment), -1)
      }

      return val
    }
  }

  function callAll(name, a, b, c) {
    const segment = contextManager.getContext()

    if (name) {
      t.equal(segment.name, name)
      t.ok(segment.timer.hrstart)
      t.notOk(segment.timer.hrDuration)
    } else {
      t.equal(segment, null)
    }

    t.equal(this, outer)
    process.nextTick(function next() {
      if (segment) {
        t.equal(segment.children.length, 0)
      }

      t.equal(a.call(inner, segment, 'a'), 'a')
      t.equal(b.call(inner, segment, 'b'), 'b')
      t.equal(c.call(inner, segment, 'c'), 'c')

      if (segment) {
        segment.children.forEach(function (child) {
          t.ok(child.timer.hrstart)
          t.ok(child.timer.hrDuration)
        })
        t.ok(segment.timer.hrDuration)
        segment.transaction.end()
      }
    })

    return returnVal
  }

  function record(seg) {
    t.ok(seg.timer.hrDuration)
    t.equal(seg.name, 'my segment')
  }

  function wrapArgs(seg, callbacks, bindFunction) {
    t.equal(this, outer)
    t.equal(seg.name, 'my segment')
    return callbacks.map(function transfrom(arg) {
      if (typeof arg === 'function') {
        return bindFunction(arg)
      }
      return arg
    })
  }

  function wrapReturn(seg, value) {
    t.equal(this, outer)
    t.equal(seg.name, 'my segment')
    return Object.create(value)
  }
})

test('wrapFunctionLast', function testwrapFunctionLast(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  const outer = {}
  const inner = {}
  const returnVal = {}
  const innerReturn = {}

  const args = [1, 2, 3, callback]
  const wrapped = tracer.wrapFunctionLast('my segment', record, takesCallback)

  t.plan(30)

  t.equal(wrapped.apply(outer, [null].concat(args)), returnVal)

  helper.runInTransaction(agent, function inTransaction() {
    t.equal(wrapped.apply(outer, ['my segment'].concat(args)), returnVal)
  })

  t.equal(wrapped.apply(outer, [null].concat(args)), returnVal)

  function callback(parent, callbackArgs) {
    const segment = contextManager.getContext()
    t.deepEqual(callbackArgs, [1, 2, 3])
    t.equal(this, inner)

    if (parent) {
      t.ok(segment.timer.hrstart)
      t.notOk(segment.timer.hrDuration)
      t.equal(parent.children[0], segment)
    }

    return innerReturn
  }

  function takesCallback(name) {
    const segment = contextManager.getContext()
    const cbArgs = [].slice.call(arguments, 1, -1)
    const cb = arguments[arguments.length - 1]

    if (name) {
      t.equal(segment.name, name)
      t.ok(segment.timer.hrstart)
      t.notOk(segment.timer.hrDuration)
    } else {
      t.equal(segment, null)
    }

    t.equal(this, outer)
    process.nextTick(function next() {
      if (segment) {
        t.equal(segment.children.length, 0)
      }

      t.equal(cb.call(inner, segment, cbArgs), innerReturn)

      if (segment) {
        t.equal(segment.children.length, 1)
        t.ok(segment.children[0].timer.hrstart)
        t.ok(segment.children[0].timer.hrDuration)
        t.ok(segment.timer.hrDuration)
        segment.transaction.end()
      }
    })

    return returnVal
  }

  function record(seg) {
    t.ok(seg.timer.hrDuration)
    t.equal(seg.name, 'my segment')
  }
})

test('wrapFunctionFirst', function testwrapFunctionFirst(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  const outer = {}
  const inner = {}
  const returnVal = {}
  const innerReturn = {}

  const wrapped = tracer.wrapFunctionFirst('my segment', record, takesCallback)

  t.plan(30)

  t.equal(wrapped.call(outer, callback, null, 1, 2, 3), returnVal)

  helper.runInTransaction(agent, function inTransaction() {
    t.equal(wrapped.call(outer, callback, 'my segment', 1, 2, 3), returnVal)
  })

  t.equal(wrapped.call(outer, callback, null, 1, 2, 3), returnVal)

  function callback(parent, args) {
    const segment = contextManager.getContext()
    t.deepEqual(args, [1, 2, 3])
    t.equal(this, inner)

    if (parent) {
      t.ok(segment.timer.hrstart)
      t.notOk(segment.timer.hrDuration)
      t.equal(parent.children[0], segment)
    }

    return innerReturn
  }

  function takesCallback(cb, name) {
    const segment = contextManager.getContext()
    const args = [].slice.call(arguments, 2)

    if (name) {
      t.equal(segment.name, name)
      t.ok(segment.timer.hrstart)
      t.notOk(segment.timer.hrDuration)
    } else {
      t.equal(segment, null)
    }

    t.equal(this, outer)
    process.nextTick(function next() {
      if (segment) {
        t.equal(segment.children.length, 0)
      }

      t.equal(cb.call(inner, segment, args), innerReturn)

      if (segment) {
        t.equal(segment.children.length, 1)
        t.ok(segment.children[0].timer.hrstart)
        t.ok(segment.children[0].timer.hrDuration)
        t.ok(segment.timer.hrDuration)
        segment.transaction.end()
      }
    })

    return returnVal
  }

  function record(seg) {
    t.ok(seg.timer.hrDuration)
    t.equal(seg.name, 'my segment')
  }
})

test('wrapSyncFunction', function testwrapSyncFunction(t) {
  const { agent, contextManager, tracer } = setupAgent(t)

  t.plan(9)

  const wrapped = tracer.wrapSyncFunction('my segment', record, doSomething)

  wrapped(null, [1, 2, 3], 1, 2, 3)

  helper.runInTransaction(agent, function inTrans(transaction) {
    wrapped(transaction, [4], 4)
    t.ok(transaction.trace.root.children[0].timer.hrstart)
    t.ok(transaction.trace.root.children[0].timer.hrDuration)
    transaction.end()
  })

  function doSomething(trans, expected) {
    t.deepEqual([].slice.call(arguments, 2), expected)
    t.equal(tracer.getTransaction(), trans)
    if (trans) {
      t.equal(contextManager.getContext().name, 'my segment')
    }
  }

  function record(segment) {
    t.equal(segment, segment.transaction.trace.root.children[0])
    t.equal(segment.name, 'my segment')
    t.end()
  }
})

function setupAgent(t) {
  const agent = helper.loadTestAgent(t)
  const contextManager = helper.getContextManager()
  const tracer = agent.tracer

  t.teardown(() => {
    helper.unloadAgent(agent)
  })

  return {
    agent,
    contextManager,
    tracer
  }
}
