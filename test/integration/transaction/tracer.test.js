/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const { tspl } = require('@matteo.collina/tspl')
const helper = require('../../lib/agent_helper')
const { EventEmitter } = require('events')
const symbols = require('../../../lib/symbols')
const tempRemoveListeners = require('../../lib/temp-remove-listeners')
const Context = require('../../../lib/context-manager/context')

test.beforeEach((ctx) => {
  const agent = helper.instrumentMockedAgent()
  const tracer = helper.getTracer()
  ctx.nr = {
    agent,
    tracer
  }
})

test.afterEach((ctx) => {
  helper.unloadAgent(ctx.nr.agent)
})

test('bind in transaction', async function testBind(t) {
  const { agent, tracer } = t.nr

  const context = {}
  const plan = tspl(t, { plan: 10 })

  helper.runInTransaction(agent, function inTrans(transaction) {
    const root = transaction.trace.root
    const ctx = tracer.getContext()
    const other = tracer.createSegment({ name: 'other', parent: root, transaction })
    const otherCtx = ctx.enterSegment({ segment: other })
    plan.equal(tracer.getTransaction(), transaction, 'should start in transaction')

    plan.equal(tracer.getSegment(), root, 'should start at root segment')
    let bound = tracer.bindFunction(compare, ctx)

    tracer.setSegment({ transaction: null, segment: null })
    bound.call(context, root)
    plan.equal(tracer.getSegment(), null, 'should reset segment after being called')

    bound = tracer.bindFunction(compare, otherCtx)
    bound.call(context, other)

    tracer.setSegment({ transaction, segment: root })
    bound = tracer.bindFunction(compare, new Context())

    plan.equal(tracer.getSegment(), root, 'should be back to root segment')
    bound.call(context, null)

    function compare(expected) {
      plan.equal(this, context, 'should pass through context')
      plan.equal(tracer.getSegment(), expected, 'should have expected segment')
    }
  })

  await plan.completed
})

test('bind outside transaction', async function testBind(t) {
  const { agent, tracer } = t.nr

  let root
  let rootCtx
  const plan = tspl(t, { plan: 5 })

  const context = tracer.getContext()
  let bound = tracer.bindFunction(compare, context)
  compare(null)
  bound(null)

  helper.runInTransaction(agent, function inTrans(transaction) {
    rootCtx = tracer.getContext()
    root = transaction.trace.root
    bound(null)
  })

  bound = tracer.bindFunction(compare, rootCtx)
  bound(root)
  compare(null)

  function compare(expected) {
    plan.equal(tracer.getSegment(), expected)
  }

  await plan.completed
})

test('bind + throw', async function testThrows(t) {
  const { agent, tracer } = t.nr

  const error = new Error('oh no!!')
  const plan = tspl(t, { plan: 12 })

  helper.runInTransaction(agent, function inTrans(transaction) {
    const root = transaction.trace.root
    const rootCtx = tracer.getContext()
    compare(dangerous(rootCtx, root), root)
    compare(dangerous(new Context(), null), root)

    tracer.setSegment({ transaction: null, segment: null })
    compare(dangerous(rootCtx, root), null)
    compare(dangerous(new Context(), null), null)
  })

  function compare(run, expected) {
    try {
      run()
    } catch (err) {
      plan.equal(err, error, 'should have expected error')
      plan.equal(tracer.getSegment(), expected, 'should catch in context')
    }
  }

  function dangerous(ctx, expected) {
    return tracer.bindFunction(function bound() {
      plan.equal(tracer.getSegment(), expected, 'should have expected segment')
      throw error
    }, ctx)
  }
  await plan.completed
})

test('bind + capture error', async function testThrows(t) {
  const { agent, tracer } = t.nr
  tempRemoveListeners({ t, emitter: process, event: 'uncaughtException' })
  const error = new Error('oh no!!')
  const name = 'some custom transaction name'
  const plan = tspl(t, { plan: 8 })

  helper.runOutOfContext(function () {
    helper.runInTransaction(agent, inTrans)
  })

  function inTrans(transaction) {
    const other = tracer.createSegment({
      name: 'other',
      transaction,
      parent: transaction.trace.root
    })
    const context = tracer.getContext()
    const otherCtx = context.enterSegment({ segment: other })
    transaction.name = name
    process.once('uncaughtException', function onUncaughtException(err) {
      const logged = agent.errors.traceAggregator.errors[0]
      plan.ok(!tracer.getSegment(), 'should not leak transaction into handler')
      plan.equal(err, error, 'should have expected error')
      plan.equal(Object.keys(error).length, 0, 'error should not have extra properties')
      plan.ok(!err[symbols.transaction], 'should not hold onto transaction')
      // global error is not tied to a transaction, so its name should not be
      // the transaction name
      plan.ok(logged, 'should have a logged error')
      plan.notEqual(name, logged[1], 'should not have a transaction with the error')
      plan.equal(error.message, logged[2], 'should have the error message')
    })
    dangerous(otherCtx, other)()
  }

  function dangerous(ctx, segment) {
    return tracer.bindFunction(function bound() {
      plan.equal(tracer.getSegment(), segment)
      throw error
    }, ctx)
  }
  await plan.completed
})

test('bind + full', async function testThrows(t) {
  const { agent, tracer } = t.nr

  const plan = tspl(t, { plan: 10 })

  helper.runInTransaction(agent, function inTrans(transaction) {
    const segment = tracer.createSegment({
      name: 'segment',
      transaction,
      parent: transaction.trace.root
    })
    const context = tracer.getContext()
    const ctx = context.enterSegment({ segment })
    const notStarted = tracer.createSegment({
      name: 'notStarted',
      transaction,
      parent: transaction.trace.root
    })
    const notStartedCtx = ctx.enterSegment({ segment: notStarted })
    let bound = tracer.bindFunction(check, ctx, true)

    plan.ok(!segment.timer.hrstart)
    bound()
    plan.ok(segment.timer.hrDuration)

    bound = tracer.bindFunction(checkNotStarted, notStartedCtx, false)

    plan.ok(!notStarted.timer.hrstart)
    bound()
    plan.ok(!notStarted.timer.hrDuration)

    function check() {
      plan.ok(segment.timer.hrstart)
      plan.equal(tracer.getSegment(), segment)
      plan.ok(!segment.timer.hrDuration)
    }

    function checkNotStarted() {
      plan.ok(!notStarted.timer.hrstart)
      plan.equal(tracer.getSegment(), notStarted)
      plan.ok(!notStarted.timer.hrDuration)
    }
  })

  await plan.completed
})

test('bind + bad function', async function testThrows(t) {
  const { agent, tracer } = t.nr

  const plan = tspl(t, { plan: 5 })

  helper.runInTransaction(agent, function inTrans() {
    const obj = {}
    plan.equal(tracer.bindFunction(false), false)
    plan.equal(tracer.bindFunction(true), true)
    plan.equal(tracer.bindFunction('foo'), 'foo')
    plan.equal(tracer.bindFunction(25), 25)
    plan.equal(tracer.bindFunction(obj), obj)
  })

  await plan.completed
})

test('bind + args', async function testThrows(t) {
  const { agent, tracer } = t.nr

  let bound
  const plan = tspl(t, { plan: 1 })

  helper.runInTransaction(agent, function inTrans() {
    const ctx = tracer.getContext()
    bound = tracer.bindFunction(function withArgs() {
      plan.deepEqual([].slice.call(arguments), [1, 2, 3])
    }, ctx)
  })

  bound(1, 2, 3)
  await plan.completed
})

test('getTransaction', async function testGetTransaction(t) {
  const { agent, tracer } = t.nr

  const plan = tspl(t, { plan: 3 })

  plan.ok(!tracer.getTransaction())

  helper.runInTransaction(agent, function inTrans(transaction) {
    plan.equal(tracer.getTransaction(), transaction)
    transaction.end()
    plan.ok(!tracer.getTransaction())
  })

  await plan.completed
})

test('getSegment', async function testGetTransaction(t) {
  const { agent, tracer } = t.nr

  const plan = tspl(t, { plan: 4 })

  plan.ok(!tracer.getSegment())
  helper.runInTransaction(agent, function inTrans(transaction) {
    const root = transaction.trace.root
    plan.equal(tracer.getSegment(), root)

    setTimeout(function onTimeout() {
      const segment = root.children[0].children[0]
      plan.equal(tracer.getSegment(), segment)
      plan.equal(tracer.getSegment().name, 'Callback: onTimeout')
    }, 0)
  })

  await plan.completed
})

test('createSegment', async function testCreateSegment(t) {
  const { agent, tracer } = t.nr

  let root
  const plan = tspl(t, { plan: 10 })

  const noSegment = tracer.createSegment({ name: 'outside transaction' })
  plan.equal(noSegment, null)

  helper.runInTransaction(agent, function inTrans(transaction) {
    const segment = tracer.createSegment({
      name: 'inside transaction',
      transaction,
      parent: transaction.trace.root
    })
    const context = tracer.getContext()
    const ctx = context.enterSegment({ segment })
    root = transaction.trace.root
    plan.equal(tracer.getSegment(), root)
    plan.equal(segment.name, 'inside transaction')

    tracer.bindFunction(function bound() {
      plan.equal(segment.timer.hrstart, null)
      plan.equal(segment.timer.hrDuration, null)
      plan.equal(tracer.getSegment(), segment)
    }, ctx)()

    const outerSegment = tracer.createSegment({
      name: 'outside with parent',
      transaction: transaction,
      parent: root
    })
    const outerCtx = context.enterSegment({ segment: outerSegment })
    tracer.bindFunction(function bound() {
      plan.equal(outerSegment.name, 'outside with parent')
      plan.equal(outerSegment.timer.hrstart, null)
      plan.equal(outerSegment.timer.hrDuration, null)
      plan.equal(tracer.getSegment(), outerSegment)
    }, outerCtx)()
  })



  await plan.completed
})

test('createSegment + recorder', async function testCreateSegment(t) {
  const { agent, tracer } = t.nr

  const plan = tspl(t, { plan: 2 })

  helper.runInTransaction(agent, function inTrans(transaction) {
    const segment = tracer.createSegment({
      name: 'inside transaction',
      recorder,
      transaction,
      parent: transaction.trace.root
    })
    plan.equal(segment.name, 'inside transaction')
    transaction.end()

    function recorder(seg) {
      plan.equal(seg, segment)
    }
  })

  await plan.completed
})

test('addSegment', async function addSegmentTest(t) {
  const { agent, tracer } = t.nr

  let root
  const plan = tspl(t, { plan: 8 })

  plan.equal(tracer.addSegment('outside', null, null, false, check), null)

  helper.runInTransaction(agent, function inTrans(transaction) {
    const segment = tracer.addSegment('inside', null, transaction.trace.root, false, check)

    plan.equal(segment.name, 'inside')
    root = transaction.trace.root
    plan.equal(root.children[0], segment)

    const outside = tracer.addSegment('outside', null, root, false, check)

    plan.equal(outside.name, 'outside')
    plan.equal(root.children[1], outside)
  })

  function check(segment) {
    plan.equal(segment, tracer.getSegment())
    return tracer.getSegment()
  }

  await plan.completed
})

test('addSegment + recorder', async function addSegmentTest(t) {
  const { agent, tracer } = t.nr

  let segment
  const plan = tspl(t, { plan: 7 })

  helper.runInTransaction(agent, function inTrans(transaction) {
    segment = tracer.addSegment('inside', record, transaction.trace.root, false, check)
    const root = transaction.trace.root

    plan.equal(segment.name, 'inside')
    plan.equal(segment.timer.hrDuration, null)
    plan.equal(root.children[0], segment)
    transaction.end()
  })

  function check(seg) {
    plan.equal(seg, tracer.getSegment())
    plan.equal(seg.timer.hrstart, null)
    plan.equal(seg.timer.hrDuration, null)
    return tracer.getSegment()
  }

  function record(seg) {
    plan.equal(seg, segment)
    return tracer.getSegment()
  }

  await plan.completed
})

test('addSegment + full', async function addSegmentTest(t) {
  const { agent, tracer } = t.nr

  const plan = tspl(t, { plan: 6 })

  helper.runInTransaction(agent, function inTrans(transaction) {
    const segment = tracer.addSegment('inside', null, transaction.trace.root, true, check)
    const root = transaction.trace.root

    plan.equal(segment.name, 'inside')
    plan.ok(segment.timer.hrDuration)
    plan.equal(root.children[0], segment)
    transaction.end()
  })

  function check(segment) {
    plan.equal(segment, tracer.getSegment())
    plan.ok(segment.timer.hrstart)
    plan.equal(segment.timer.hrDuration, null)
    return tracer.getSegment()
  }

  await plan.completed
})

test('transactionProxy', async function testTransactionProxy(t) {
  const { tracer } = t.nr

  const plan = tspl(t, { plan: 10 })

  plan.equal(tracer.transactionProxy(null), null)
  plan.equal(tracer.transactionProxy(5), 5)
  plan.equal(tracer.transactionProxy(), undefined)
  plan.equal(tracer.transactionProxy('test'), 'test')
  tracer.transactionProxy(handler)(1, 2, 3)

  function handler() {
    const transaction = tracer.getTransaction()
    const root = transaction.trace.root

    plan.deepEqual([].slice.call(arguments), [1, 2, 3])
    plan.equal(root.name, 'ROOT')
    plan.equal(root, tracer.getSegment())
    plan.ok(transaction)
    tracer.transactionProxy(handler2)()

    function handler2() {
      plan.equal(tracer.getTransaction(), transaction)
      plan.equal(root, tracer.getSegment())
    }
  }

  await plan.completed
})

test('transactionNestProxy', async function testTransactionNestProxy(t) {
  const { tracer } = t.nr

  const plan = tspl(t, { plan: 20 })

  plan.equal(tracer.transactionNestProxy('web', null), null, 'should not wrap null')
  plan.equal(tracer.transactionNestProxy('web', 5), 5, 'should not wrap numbers')
  plan.equal(tracer.transactionNestProxy('web'), undefined, 'should not wrap undefined')
  plan.equal(tracer.transactionNestProxy('web', 'test'), 'test', 'should not wrap strings')
  tracer.transactionNestProxy('web', handler)(1, 2, 3)

  function handler() {
    const transaction = tracer.getTransaction()
    const root = transaction.trace.root

    plan.deepEqual([].slice.call(arguments), [1, 2, 3])
    plan.equal(root.name, 'ROOT')
    plan.equal(root, tracer.getSegment())
    plan.ok(transaction)
    transaction.type = 'web'
    transaction.baseSegment = root

    tracer.transactionNestProxy('web', handler2)()
    tracer.transactionNestProxy('bg', handler3)()
    transaction.type = 'bg'
    transaction.baseSegment = root
    tracer.transactionNestProxy('web', handler3)()

    function handler2() {
      plan.equal(tracer.getTransaction(), transaction)
      plan.equal(root, tracer.getSegment())
    }

    function handler3() {
      const transaction3 = tracer.getTransaction()
      const root3 = transaction3.trace.root
      plan.equal(root.name, 'ROOT')
      plan.equal(root3, tracer.getSegment())
      plan.ok(transaction3)
      plan.notEqual(tracer.getTransaction(), transaction)
      plan.notEqual(tracer.getSegment(), root)
    }
  }

  await plan.completed
})

test('bindEmitter', async function testbindEmitter(t) {
  const { agent, tracer } = t.nr

  const emitter = new EventEmitter()
  const emitter2 = new EventEmitter()
  const data = {}
  let root

  const plan = tspl(t, { plan: 20 })

  emitter.on('before', check(null))
  tracer.bindEmitter(emitter)
  emitter.on('after', check(null))

  emitter.emit('before', data)
  emitter.emit('after', data)

  tracer.bindEmitter(emitter2, null)

  helper.runInTransaction(agent, function inTrans() {
    root = tracer.getSegment()
    emitter.emit('before', data)
    emitter.emit('after', data)

    emitter2.on('before', check(root))
    tracer.bindEmitter(emitter2, root)
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

  function check(expected) {
    return function onEvent(eventData) {
      plan.equal(eventData, data, 'should pass through event data')
      plan.equal(tracer.getSegment(), expected, 'should have expected segment')
    }
  }

  await plan.completed
})

test('tracer.slice', async function testSlice(t) {
  const { tracer } = t.nr

  const plan = tspl(t, { plan: 3 })

  check(1, 2, 3)

  function check() {
    const args = tracer.slice(arguments)
    plan.deepEqual(args, [1, 2, 3])
    plan.ok(Array.isArray(args))
    plan.equal(typeof args.forEach, 'function')
  }

  await plan.completed
})

test('wrapFunction', async function testwrapFunction(t) {
  const { agent, tracer } = t.nr

  const outer = {}
  const inner = {}
  const returnVal = {}

  const args = ['a', 'b', 'c'].map(makeCallback)
  const wrapped = tracer.wrapFunction('my segment', record, callAll, wrapArgs, wrapReturn)

  const plan = tspl(t, { plan: 61 })

  plan.equal(wrapped.apply(outer, [null].concat(args)), returnVal)

  helper.runInTransaction(agent, function inTransaction() {
    plan.equal(Object.getPrototypeOf(wrapped.apply(outer, ['my segment'].concat(args))), returnVal)
  })

  plan.equal(wrapped.apply(outer, [null].concat(args)), returnVal)
  await plan.completed

  function makeCallback(val) {
    return function callback(parent, arg) {
      const segment = tracer.getSegment()
      plan.equal(arg, val)
      plan.equal(this, inner)
      if (parent) {
        plan.ok(segment.timer.hrstart)
        plan.ok(!segment.timer.hrDuration)
        plan.notEqual(parent.children.indexOf(segment), -1)
      }

      return val
    }
  }

  function callAll(name, a, b, c) {
    const segment = tracer.getSegment()
    const transaction = tracer.getTransaction()

    if (name) {
      plan.equal(segment.name, name)
      plan.ok(segment.timer.hrstart)
      plan.ok(!segment.timer.hrDuration)
    } else {
      plan.equal(segment, null)
    }

    plan.equal(this, outer)
    process.nextTick(function next() {
      if (segment) {
        plan.equal(segment.children.length, 0)
      }

      plan.equal(a.call(inner, segment, 'a'), 'a')
      plan.equal(b.call(inner, segment, 'b'), 'b')
      plan.equal(c.call(inner, segment, 'c'), 'c')

      if (segment) {
        segment.children.forEach(function (child) {
          plan.ok(child.timer.hrstart)
          plan.ok(child.timer.hrDuration)
        })
        plan.ok(segment.timer.hrDuration)
        transaction.end()
      }
    })

    return returnVal
  }

  function record(seg) {
    plan.ok(seg.timer.hrDuration)
    plan.equal(seg.name, 'my segment')
  }

  function wrapArgs(seg, callbacks, bindFunction) {
    plan.equal(this, outer)
    plan.equal(seg.name, 'my segment')
    return callbacks.map(function transfrom(arg) {
      if (typeof arg === 'function') {
        return bindFunction(arg)
      }
      return arg
    })
  }

  function wrapReturn(seg, value) {
    plan.equal(this, outer)
    plan.equal(seg.name, 'my segment')
    return Object.create(value)
  }
})

test('wrapFunctionLast', async function testwrapFunctionLast(t) {
  const { agent, tracer } = t.nr

  const outer = {}
  const inner = {}
  const returnVal = {}
  const innerReturn = {}

  const args = [1, 2, 3, callback]
  const wrapped = tracer.wrapFunctionLast('my segment', record, takesCallback)

  const plan = tspl(t, { plan: 30 })

  plan.equal(wrapped.apply(outer, [null].concat(args)), returnVal)

  helper.runInTransaction(agent, function inTransaction() {
    plan.equal(wrapped.apply(outer, ['my segment'].concat(args)), returnVal)
  })

  plan.equal(wrapped.apply(outer, [null].concat(args)), returnVal)
  await plan.completed

  function callback(parent, callbackArgs) {
    const segment = tracer.getSegment()
    plan.deepEqual(callbackArgs, [1, 2, 3])
    plan.equal(this, inner)

    if (parent) {
      plan.ok(segment.timer.hrstart)
      plan.ok(!segment.timer.hrDuration)
      plan.equal(parent.children[0], segment)
    }

    return innerReturn
  }

  function takesCallback(name) {
    const segment = tracer.getSegment()
    const transaction = tracer.getTransaction()
    const cbArgs = [].slice.call(arguments, 1, -1)
    const cb = arguments[arguments.length - 1]

    if (name) {
      plan.equal(segment.name, name)
      plan.ok(segment.timer.hrstart)
      plan.ok(!segment.timer.hrDuration)
    } else {
      plan.equal(segment, null)
    }

    plan.equal(this, outer)
    process.nextTick(function next() {
      if (segment) {
        plan.equal(segment.children.length, 0)
      }

      plan.equal(cb.call(inner, segment, cbArgs), innerReturn)

      if (segment) {
        plan.equal(segment.children.length, 1)
        plan.ok(segment.children[0].timer.hrstart)
        plan.ok(segment.children[0].timer.hrDuration)
        plan.ok(segment.timer.hrDuration)
        transaction.end()
      }
    })

    return returnVal
  }

  function record(seg) {
    plan.ok(seg.timer.hrDuration)
    plan.equal(seg.name, 'my segment')
  }
})

test('wrapFunctionFirst', async function testwrapFunctionFirst(t) {
  const { agent, tracer } = t.nr

  const outer = {}
  const inner = {}
  const returnVal = {}
  const innerReturn = {}

  const wrapped = tracer.wrapFunctionFirst('my segment', record, takesCallback)

  const plan = tspl(t, { plan: 30 })

  plan.equal(wrapped.call(outer, callback, null, 1, 2, 3), returnVal)

  helper.runInTransaction(agent, function inTransaction() {
    plan.equal(wrapped.call(outer, callback, 'my segment', 1, 2, 3), returnVal)
  })

  plan.equal(wrapped.call(outer, callback, null, 1, 2, 3), returnVal)
  await plan.completed

  function callback(parent, args) {
    const segment = tracer.getSegment()
    plan.deepEqual(args, [1, 2, 3])
    plan.equal(this, inner)

    if (parent) {
      plan.ok(segment.timer.hrstart)
      plan.ok(!segment.timer.hrDuration)
      plan.equal(parent.children[0], segment)
    }

    return innerReturn
  }

  function takesCallback(cb, name) {
    const segment = tracer.getSegment()
    const transaction = tracer.getTransaction()
    const args = [].slice.call(arguments, 2)

    if (name) {
      plan.equal(segment.name, name)
      plan.ok(segment.timer.hrstart)
      plan.ok(!segment.timer.hrDuration)
    } else {
      plan.equal(segment, null)
    }

    plan.equal(this, outer)
    process.nextTick(function next() {
      if (segment) {
        plan.equal(segment.children.length, 0)
      }

      plan.equal(cb.call(inner, segment, args), innerReturn)

      if (segment) {
        plan.equal(segment.children.length, 1)
        plan.ok(segment.children[0].timer.hrstart)
        plan.ok(segment.children[0].timer.hrDuration)
        plan.ok(segment.timer.hrDuration)
        transaction.end()
      }
    })

    return returnVal
  }

  function record(seg) {
    plan.ok(seg.timer.hrDuration)
    plan.equal(seg.name, 'my segment')
  }
})

test('wrapSyncFunction', async function testwrapSyncFunction(t) {
  const { agent, tracer } = t.nr

  const plan = tspl(t, { plan: 9 })

  const wrapped = tracer.wrapSyncFunction('my segment', record, doSomething)

  wrapped(null, [1, 2, 3], 1, 2, 3)

  helper.runInTransaction(agent, function inTrans(transaction) {
    wrapped(transaction, [4], 4)
    plan.ok(transaction.trace.root.children[0].timer.hrstart)
    plan.ok(transaction.trace.root.children[0].timer.hrDuration)
    transaction.end()
  })

  await plan.completed

  function doSomething(trans, expected) {
    plan.deepEqual([].slice.call(arguments, 2), expected)
    plan.equal(tracer.getTransaction(), trans)
    if (trans) {
      plan.equal(tracer.getSegment().name, 'my segment')
    }
  }

  function record(segment, scope, transaction) {
    plan.equal(segment, transaction.trace.root.children[0])
    plan.equal(segment.name, 'my segment')
  }
})
