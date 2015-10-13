'use strict'

var tap = require('tap')
var test = tap.test
var helper = require('../../lib/agent_helper')
var EE = require('events').EventEmitter

test('bind in transaction', function testBind(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var context = {}
  t.plan(15)

  helper.runInTransaction(agent, function inTrans(transaction) {
    var root = transaction.trace.root
    var other = tracer.createSegment('other')
    t.equal(tracer.getTransaction(), transaction)

    var bound = tracer.bindFunction(compare)
    compare.call(context, root)

    tracer.segment = null
    compare.call(context, null)

    bound.call(context, root)
    compare.call(context, null)

    bound = tracer.bindFunction(compare, other)
    bound.call(context, other)

    tracer.segment = root
    bound = tracer.bindFunction(compare, null)
    compare.call(context, root)
    bound.call(context, null)

    t.end()

    function compare(expected) {
      t.equal(this, context)
      t.equal(tracer.getSegment(), expected)
    }
  })
})

test('bind outside transaction', function testBind(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var root
  t.plan(5)

  var bound = tracer.bindFunction(compare)
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
    t.equal(tracer.getSegment(), expected)
  }
})

test('bind + throw', function testThrows(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var error = new Error('oh no!!')
  t.plan(12)

  helper.runInTransaction(agent, function inTrans(transaction) {
    var root = transaction.trace.root
    compare(dangerous(root), root)
    compare(dangerous(null), root)
    tracer.segment = null
    compare(dangerous(root), null)
    compare(dangerous(null), null)
    t.end()
  })

  function compare(run, expected) {
    try {
      run()
    } catch(err) {
      t.equal(err, error)
      t.equal(tracer.getSegment(), expected)
    }
  }

  function dangerous(segment) {
    return tracer.bindFunction(function bound() {
      t.equal(tracer.getSegment(), segment)
      throw error
    }, segment)
  }
})

test('bind + capture error', function testThrows(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var error = new Error('oh no!!')
  var name = 'some custom transaction name'
  t.plan(7)

  helper.runInTransaction(agent, function inTrans(transaction) {
    var other = tracer.createSegment('other')
    transaction.name = name
    process.once('uncaughtException', function onUncaughtException(err) {
      var logged = agent.errors.errors[0]
      t.equal(tracer.getSegment(), null)
      t.equal(err, error)
      t.equal(Object.keys(error).length, 0, 'error should not have any extra properties')
      t.notOk(err.__NR_transaction, 'should not hold onto transaction')
      // global error is not tied to a transaction, so its name should not be the transaction name
      t.notEqual(name, logged[1])
      t.equal(error.message, logged[2])
      t.end()
    })
    dangerous(other)()
  })

  function dangerous(segment) {
    return tracer.bindFunction(function bound() {
      // next tick to avoid tap error handler
      process.nextTick(function ohno() {
        t.equal(tracer.getSegment(), segment)
        throw error
      })
    }, segment)
  }
})

test('bind + full', function testThrows(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  t.plan(10)

  helper.runInTransaction(agent, function inTrans() {
    var segment = tracer.createSegment('segment')
    var notStarted = tracer.createSegment('notStarted')
    var bound = tracer.bindFunction(check, segment, true)

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
      t.equal(tracer.getSegment(), segment)
      t.notOk(segment.timer.hrDuration)
    }

    function checkNotStarted() {
      t.notOk(notStarted.timer.hrstart)
      t.equal(tracer.getSegment(), notStarted)
      t.notOk(notStarted.timer.hrDuration)
    }
  })
})

test('bind + bad function', function testThrows(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  t.plan(5)

  helper.runInTransaction(agent, function inTrans() {
    var obj = {}
    t.equal(tracer.bindFunction(false), false)
    t.equal(tracer.bindFunction(true), true)
    t.equal(tracer.bindFunction('foo'), 'foo')
    t.equal(tracer.bindFunction(25), 25)
    t.equal(tracer.bindFunction(obj), obj)
    t.end()
  })
})

test('bind + args', function testThrows(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var bound
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
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer

  t.plan(5)

  t.notOk(tracer.getTransaction())

  helper.runInTransaction(agent, function inTrans(transaction) {
    t.equal(tracer.getTransaction(), transaction)
    t.equal(tracer.segment.transaction, transaction)
    transaction.end(function ended() {
      t.notOk(tracer.getTransaction())
      t.equal(tracer.segment.transaction, transaction)
      t.end()
    })
  })
})

test('getSegment', function testGetTransaction(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  t.plan(5)

  t.notOk(tracer.getSegment())
  helper.runInTransaction(agent, function inTrans(transaction) {
    var root = transaction.trace.root
    t.equal(tracer.getSegment(), root)
    t.equal(tracer.segment, tracer.getSegment())

    setTimeout(function onTimeout() {
      var segment = root.children[0].children[0]
      t.equal(tracer.getSegment(), segment)
      t.equal(tracer.getSegment().name, 'Callback: onTimeout')
    }, 0)
  })
})

test('createSegment', function testCreateSegment(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var root
  t.plan(10)

  var noSegment = tracer.createSegment('outside transaction')
  t.equal(noSegment, null)

  helper.runInTransaction(agent, function inTrans(transaction) {
    var segment = tracer.createSegment('inside transaction')
    root = transaction.trace.root
    t.equal(tracer.getSegment(), root)
    t.equal(segment.name, 'inside transaction')

    tracer.bindFunction(function bound() {
      t.equal(segment.timer.hrstart,  null)
      t.equal(segment.timer.hrDuration,  null)
      t.equal(tracer.getSegment(), segment)
    }, segment)()
  })

  var outerSegment = tracer.createSegment('outside with parent', null, root)

  tracer.bindFunction(function bound() {
    t.equal(outerSegment.name, 'outside with parent')
    t.equal(outerSegment.timer.hrstart,  null)
    t.equal(outerSegment.timer.hrDuration,  null)
    t.equal(tracer.getSegment(), outerSegment)
  }, outerSegment)()

  t.end()
})

test('createSegment + recorder', function testCreateSegment(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  t.plan(2)

  helper.runInTransaction(agent, function inTrans(transaction) {
    var segment = tracer.createSegment('inside transaction', recorder)
    t.equal(segment.name, 'inside transaction')

    transaction.end(function onEnd() {
      t.end()
    })

    function recorder(seg) {
      t.equal(seg, segment)
    }
  })
})

test('addSegment', function addSegmentTest(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var root
  t.plan(8)

  t.equal(
    tracer.addSegment('outside', null, null, false, check),
    null
  )

  helper.runInTransaction(agent, function inTrans(transaction) {
    var segment = tracer.addSegment('inside', null, null, false, check)

    t.equal(segment.name, 'inside')
    root = transaction.trace.root
    t.equal(root.children[0], segment)
  })

  var outside = tracer.addSegment('outside', null, root, false, check)

  t.equal(outside.name, 'outside')
  t.equal(root.children[1], outside)

  t.end()

  function check(segment) {
    t.equal(segment, tracer.getSegment())
    return tracer.getSegment()
  }
})

test('addSegment + recorder', function addSegmentTest(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var segment
  t.plan(7)

  helper.runInTransaction(agent, function inTrans(transaction) {
    segment = tracer.addSegment('inside', record, null, false, check)
    var root = transaction.trace.root

    t.equal(segment.name, 'inside')
    t.equal(segment.timer.hrDuration, null)
    t.equal(root.children[0], segment)

    transaction.end(function onEnd() {
      t.end()
    })
  })

  function check(seg) {
    t.equal(seg, tracer.getSegment())
    t.equal(seg.timer.hrstart, null)
    t.equal(seg.timer.hrDuration, null)
    return tracer.getSegment()
  }

  function record(seg) {
    t.equal(seg, segment)
    return tracer.getSegment()
  }
})

test('addSegment + full', function addSegmentTest(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  t.plan(7)

  helper.runInTransaction(agent, function inTrans(transaction) {
    var segment = tracer.addSegment('inside', null, null, true, check)
    var root = transaction.trace.root

    t.equal(segment.name, 'inside')
    t.ok(segment.timer.hrDuration)
    t.equal(root.children[0], segment)

    transaction.end(function onEnd() {
      // because having plan + end after async causes issues
      t.ok(true)
      t.end()
    })
  })

  function check(segment) {
    t.equal(segment, tracer.getSegment())
    t.ok(segment.timer.hrstart)
    t.equal(segment.timer.hrDuration, null)
    return tracer.getSegment()
  }
})

test('transactionProxy', function testTransactionProxy(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  t.plan(10)

  t.equal(tracer.transactionProxy(null), null)
  t.equal(tracer.transactionProxy(5), 5)
  t.equal(tracer.transactionProxy())
  t.equal(tracer.transactionProxy('test'), 'test')
  tracer.transactionProxy(handler)(1, 2, 3)
  t.end()

  function handler() {
    var transaction = tracer.getTransaction()
    var root = transaction.trace.root

    t.deepEqual([].slice.call(arguments), [1, 2, 3])
    t.equal(root.name, 'ROOT')
    t.equal(root, tracer.getSegment())
    t.ok(transaction)

    tracer.transactionProxy(handler2)()

    function handler2() {
      t.equal(tracer.getTransaction(), transaction)
      t.equal(root, tracer.getSegment())
    }
  }
})

test('transactionNestProxy', function testTransactionNestProxy(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  t.plan(20)

  t.equal(tracer.transactionNestProxy('web', null), null)
  t.equal(tracer.transactionNestProxy('web', 5), 5)
  t.equal(tracer.transactionNestProxy('web'))
  t.equal(tracer.transactionNestProxy('web', 'test'), 'test')
  tracer.transactionNestProxy('web', handler)(1, 2, 3)
  t.end()

  function handler() {
    var transaction = tracer.getTransaction()
    var root = transaction.trace.root

    t.deepEqual([].slice.call(arguments), [1, 2, 3])
    t.equal(root.name, 'ROOT')
    t.equal(root, tracer.getSegment())
    t.ok(transaction)
    transaction.webSegment = root

    tracer.transactionNestProxy('web', handler2)()
    tracer.transactionNestProxy('bg', handler3)()
    tracer.webSegment = null
    transaction.bgSegment = root
    tracer.transactionNestProxy('web', handler3)()

    function handler2() {
      t.equal(tracer.getTransaction(), transaction)
      t.equal(root, tracer.getSegment())
    }

    function handler3() {
      var transaction3 = tracer.getTransaction()
      var root3 = transaction3.trace.root

      t.equal(root.name, 'ROOT')
      t.equal(root3, tracer.getSegment())
      t.ok(transaction3)
      t.notEqual(tracer.getTransaction(), transaction)
      t.notEqual(tracer.getSegment(), root)
    }
  }
})

test('bindEmitter', function testbindEmitter(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var emitter = new EE()
  var emitter2 = new EE()
  var data = {}
  var root

  t.plan(20)

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
    tracer.bindEmitter(emitter2)
    emitter2.on('after', check(root))
    emitter2.emit('before', data)
    emitter2.emit('after', data)
  })

  emitter2.emit('before', data)
  emitter2.emit('after', data)

  var emitter3 = new EE()
  emitter3.on('before', check(root))
  tracer.bindEmitter(emitter3, root)
  emitter3.on('after', check(root))
  emitter3.emit('before', data)
  emitter3.emit('after', data)
  t.end()

  function check(expected) {
    return function onEvent(eventData) {
      t.equal(eventData, data)
      t.equal(tracer.getSegment(), expected)
    }
  }
})

test('tracer.slice', function testSlice(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  t.plan(3)

  check(1, 2, 3)

  function check() {
    var args = tracer.slice(arguments)
    t.deepEqual(args, [1, 2, 3])
    t.ok(Array.isArray(args))
    t.equal(typeof args.forEach, 'function')
  }
  t.end()
})

test('wrapFunctionNoSegment', function testwrapFunctionNoSegment(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var outer = {}
  var inner = {}
  var segment = null

  t.plan(15)

  var wrapped = tracer.wrapFunctionNoSegment(doSomething)

  wrapped.call(outer, segment, [4], 4, check)

  helper.runInTransaction(agent, function runInTransaction(transaction) {
    segment = transaction.trace.root
    wrapped.call(outer, segment, [1, 2, 3], 1, 2, 3, check)
  })

  wrapped.call(outer, null, [4, 5], 4, 5, check)

  function doSomething(seg) {
    var args = tracer.slice(arguments)
    var callback = args.pop()
    t.equal(this, outer)
    t.equal(tracer.getSegment(), seg)
    process.nextTick(function next() {
      tracer.segment = null
      callback.apply(inner, args)
    })
  }

  function check(seg, expected) {
    t.deepEqual([].slice.call(arguments, 2), expected)
    t.equal(tracer.getSegment(), seg)
    t.equal(this, inner)
  }
})

test('wrapFunction', function testwrapFunction(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var outer = {}
  var inner = {}
  var returnVal = {}

  var args = ['a', 'b', 'c'].map(makeCallback)
  var wrapped = tracer.wrapFunction(
    'my segment',
    record,
    callAll,
    wrapArgs,
    wrapReturn
  )

  t.plan(61)

  t.equal(wrapped.apply(outer, [null].concat(args)), returnVal)

  helper.runInTransaction(agent, function inTransaction() {
    t.equal(
      Object.getPrototypeOf(wrapped.apply(outer, ['my segment'].concat(args))),
      returnVal
    )
  })

  t.equal(wrapped.apply(outer, [null].concat(args)), returnVal)

  function makeCallback(val) {
    return function callback(parent, arg) {
      var segment = tracer.getSegment()
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
    var segment = tracer.getSegment()

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
        segment.children.forEach(function(child) {
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
      if (typeof arg === 'function') return bindFunction(arg)
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
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var outer = {}
  var inner = {}
  var returnVal = {}
  var innerReturn = {}

  var args = [1, 2, 3, callback]
  var wrapped = tracer.wrapFunctionLast(
    'my segment',
    record,
    takesCallback
  )

  t.plan(30)

  t.equal(wrapped.apply(outer, [null].concat(args)), returnVal)

  helper.runInTransaction(agent, function inTransaction() {
    t.equal(wrapped.apply(outer, ['my segment'].concat(args)), returnVal)
  })

  t.equal(wrapped.apply(outer, [null].concat(args)), returnVal)

  function callback(parent, args) {
    var segment = tracer.getSegment()
    t.deepEqual(args, [1, 2, 3])
    t.equal(this, inner)

    if (parent) {
      t.ok(segment.timer.hrstart)
      t.notOk(segment.timer.hrDuration)
      t.equal(parent.children[0], segment)
    }

    return innerReturn
  }

  function takesCallback(name) {
    var segment = tracer.getSegment()
    var args = [].slice.call(arguments, 1, -1)
    var callback = arguments[arguments.length - 1]

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

      t.equal(callback.call(inner, segment, args), innerReturn)

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
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  var outer = {}
  var inner = {}
  var returnVal = {}
  var innerReturn = {}

  var args = [callback, 1, 2, 3]
  var wrapped = tracer.wrapFunctionFirst(
    'my segment',
    record,
    takesCallback
  )

  t.plan(30)

  t.equal(wrapped.call(outer, callback, null, 1, 2, 3), returnVal)

  helper.runInTransaction(agent, function inTransaction() {
    t.equal(wrapped.call(outer, callback, 'my segment', 1, 2, 3), returnVal)
  })

  t.equal(wrapped.call(outer, callback, null, 1, 2, 3), returnVal)

  function callback(parent, args) {
    var segment = tracer.getSegment()
    t.deepEqual(args, [1, 2, 3])
    t.equal(this, inner)

    if (parent) {
      t.ok(segment.timer.hrstart)
      t.notOk(segment.timer.hrDuration)
      t.equal(parent.children[0], segment)
    }

    return innerReturn
  }

  function takesCallback(callback, name) {
    var segment = tracer.getSegment()
    var args = [].slice.call(arguments, 2)

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

      t.equal(callback.call(inner, segment, args), innerReturn)

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
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer

  t.plan(9)

  var wrapped = tracer.wrapSyncFunction('my segment', record, doSomething)

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
      t.equal(tracer.getSegment().name, 'my segment')
    }
  }

  function record(segment) {
    t.equal(segment, segment.transaction.trace.root.children[0])
    t.equal(segment.name, 'my segment')
    t.end()
  }
})

test('wrapCallback', function testwrapCallback(t) {
  var agent = helper.loadTestAgent(t)
  var tracer = agent.tracer
  t.end()
})
