'use strict'

var Transaction = require('../index.js')
var logger = require('../../logger').child({component: 'tracer'})

/*
 * CONSTANTS
 */
var ORIGINAL = '__NR_original'
var SEGMENT = '__NR_segment'


module.exports = Tracer

function Tracer(agent) {
  if (!agent) throw new Error("Must be initialized with an agent.")

  this.agent = agent
  this._segment = null
}

Tracer.prototype.getTransaction = getTransaction
Tracer.prototype.getSegment = getSegment
Tracer.prototype.createSegment = createSegment
Tracer.prototype.addSegment = addSegment
Tracer.prototype.transactionProxy = transactionProxy
Tracer.prototype.transactionNestProxy = transactionNestProxy
Tracer.prototype.bindFunction = bindFunction
Tracer.prototype.bindEmitter = bindEmitter
Tracer.prototype.getOriginal = getOriginal
Tracer.prototype.getSegmentFromWrapped = getSegmentFromWrapped
Tracer.prototype.slice = argSlice
Tracer.prototype.wrapFunctionNoSegment = wrapFunctionNoSegment
Tracer.prototype.wrapFunctionFirstNoSegment = wrapFunctionFirstNoSegment
Tracer.prototype.wrapFunction = wrapFunction
Tracer.prototype.wrapFunctionLast = wrapFunctionLast
Tracer.prototype.wrapFunctionFirst = wrapFunctionFirst
Tracer.prototype.wrapSyncFunction = wrapSyncFunction
Tracer.prototype.wrapCallback = wrapCallback

Object.defineProperty(Tracer.prototype, 'segment', {
  get: function segmentGetter() {
    return this._segment
  },
  set: function segmentSetter(segment) {
    this._segment && this._segment.probe('Segment removed from tracer')
    segment && segment.probe('Set tracer.segment')
    return this._segment = segment
  }
})

function getTransaction() {
  if (this.segment && this.segment.transaction && typeof this.segment.transaction.isActive === 'function' && this.segment.transaction.isActive()) {
    return this.segment.transaction
  }

  return null
}

function getSegment() {
  return this.segment
}

function createSegment(name, recorder, _parent) {
  var parent = _parent || this.segment
  if (!parent || !parent.transaction.isActive()) {
    logger.trace({
      hasParent: !!parent,
      transactionActive: (parent && parent.transaction.isActive())
    }, 'Not creating segment %s, no parent or active transaction available.', name)
    return null
  }
  return parent.add(name, recorder)
}

function addSegment(name, recorder, parent, full, task) {
  if (typeof task !== 'function') {
    throw new Error('task must be a function')
  }

  var segment = this.createSegment(name, recorder, parent)

  return this.bindFunction(task, segment, full)(segment)
}

function transactionProxy(handler) {
  // if there's no handler, there's nothing to proxy.
  if (typeof handler !== 'function') return handler

  var tracer = this
  var wrapped = function wrapTransactionInvocation() {
    if (!tracer.agent.canCollectData()) {
      return handler.apply(this, arguments)
    }

    // don't nest transactions, reuse existing ones
    var segment = tracer.segment
    if (segment) {
      if (segment.transaction.traceStacks) {
        segment.probe('!!! Nested transaction creation !!!')
        segment.transaction.traceFlag = true // Will log the stacks when it ends.
      }
      logger.warn({
        transaction: {id: segment.transaction.id, name: segment.transaction.getName()},
        segment: segment.name
      }, 'Active transaction when creating non-nested transaction')
      tracer.agent.recordSupportability('Nodejs/Transactions/Nested')
      return handler.apply(this, arguments)
    }
    var transaction = new Transaction(tracer.agent)
    return tracer.bindFunction(handler, transaction.trace.root, true)
      .apply(this, arguments)
  }

  wrapped[ORIGINAL] = handler

  return wrapped
}


/**
 * Use transactionNestProxy to wrap a closure that is a top-level handler that
 * is meant to start transactions. This wraps the first half of asynchronous
 * handlers. Use bindFunction to wrap handler callbacks. This detects to see
 * if there is an in play segment and uses that as the root instead of
 * transaction.trace.root.
 *
 * @param {Function} handler - Generator to be proxied.
 *
 * @return {Function} Proxy.
 */
function transactionNestProxy(type, handler) {
  if (handler === undefined && typeof type === 'function') {
    handler = type
    type = undefined
  }
  // if there's no handler, there's nothing to proxy.
  if (typeof handler !== 'function') return handler

  var tracer = this
  var wrapped = function wrapTransactionInvocation() {
    if (!tracer.agent.canCollectData()) {
      return handler.apply(this, arguments)
    }

    // don't nest transactions, reuse existing ones
    var transaction = tracer.getTransaction()
    var segment = tracer.segment

    var createNew = false

    if (!transaction || transaction.type !== type) {
      createNew = true
    }

    if (createNew) {
      transaction = new Transaction(tracer.agent)
      transaction.type = type
      segment = transaction.trace.root
    }

    return tracer.bindFunction(handler, segment).apply(this, arguments)
  }

  wrapped[ORIGINAL] = handler

  return wrapped
}

function bindFunction(handler, segment, full) {
  if (typeof handler !== 'function') {
    return handler
  }

  return _makeWrapped(this, handler, segment || this.segment, !!full)
}
function _makeWrapped(tracer, handler, active, full) {
  wrapped[ORIGINAL] = getOriginal(handler)
  wrapped[SEGMENT] = active

  return wrapped

  function wrapped() {
    var prev = tracer.segment
    tracer.segment = active
    if (active && full) active.start()
    try {
      return handler.apply(this, arguments)
    } catch (err) {
      logger.trace(err, "Error from wrapped function:")

      if (prev === null && process.domain != null) {
        process.domain.__NR_transactionSegment = tracer.segment
      }

      throw err // Re-throwing application error, this is not an agent error.
    } finally {
      if (active && full) active.touch()
      tracer.segment = prev
    }
  }
}

function getOriginal(fn) {
  return fn && fn[ORIGINAL] ? fn[ORIGINAL] : fn
}

function getSegmentFromWrapped(fn) {
  return fn && fn[SEGMENT] ? fn[SEGMENT] : null
}

function bindEmitter(emitter, segment) {
  if (!emitter || !emitter.emit) {
    return emitter
  }

  var emit = getOriginal(emitter.emit)
  emitter.emit = this.bindFunction(emit, segment)

  return emitter
}

function argSlice(args) {
  /**
   * Usefully nerfed version of slice for use in instrumentation. Way faster
   * than using [].slice.call, and maybe putting it in here (instead of the
   * same module context where it will be used) will make it faster by
   * defeating inlining.
   *
   *   http://jsperf.com/array-slice-call-arguments-2
   *
   *  for untrustworthy benchmark numbers. Only useful for copying whole
   *  arrays, and really only meant to be used with the arguments array like.
   *
   *  Also putting this comment inside the function in an effort to defeat
   *  inlining.
   *
   */
  var length = args.length
  var array = new Array(length)

  for (var i = 0; i < length; i++) {
    array[i] = args[i]
  }

  return array
}

function wrapFunctionNoSegment(original, name, wrapper) {
  if (typeof original !== 'function') return original

  logger.trace('Wrapping function %s (no segment)', name || original.name || 'anonymous')
  var tracer = this

  return wrappedFunction

  function wrappedFunction() {
    if (!tracer.getTransaction()) return original.apply(this, arguments)
    var args = tracer.slice(arguments)

    if (wrapper === undefined) {
      var last = args.length - 1
      var cb = args[last]
      if (typeof cb === 'function') {
        args[last] = tracer.bindFunction(cb)
      }
    } else {
      args = wrapper(args)
    }
    return original.apply(this, args)
  }
}

function wrapFunctionFirstNoSegment(original, name) {
  if (typeof original !== 'function') return original

  logger.trace('Wrapping function %s (no segment)', name || original.name || 'anonymous')
  var tracer = this

  return wrappedFunction

  function wrappedFunction() {
    if (!tracer.getTransaction()) return original.apply(this, arguments)
    var args = tracer.slice(arguments)
    var cb = args[0]
    if (typeof cb === 'function') {
      args[0] = tracer.bindFunction(cb)
    }
    return original.apply(this, args)
  }
}

function wrapFunctionLast(name, recorder, original) {
  if (typeof original !== 'function') {
    logger.trace('Not wrapping "%s" because it was not a function', name)
    return original
  }

  logger.trace('Wrapping %s as a callback-last function', name)
  var tracer = this

  return wrappedFunction

  function wrappedFunction() {
    var transaction = tracer.getTransaction()
    if (!transaction) {
      logger.trace('Not creating segment "%s" because no transaction was active', name)
      return original.apply(this, arguments)
    }

    logger.trace('Creating "%s" segment for transaction %s.', name, transaction.id)
    var args = tracer.slice(arguments)
    var last = args.length - 1
    var cb = args[last]
    if (typeof cb !== 'function') return original.apply(this, arguments)
    var child = tracer.createSegment(name, recorder)
    args[last] = tracer.wrapCallback(cb, child, wrappedCallback)
    child.start()
    return tracer.bindFunction(original, child).apply(this, args)

    function wrappedCallback() {
      logger.trace('Ending "%s" segment for transaction %s.', name, transaction.id)
      child.touch()
      return cb.apply(this, arguments)
    }
  }
}

function wrapFunctionFirst(name, recorder, original) {
  if (typeof original !== 'function') {
    logger.trace('Not wrapping "%s" because it was not a function', name)
    return original
  }

  logger.trace('Wrapping %s as a callback-first function', name)
  var tracer = this

  return wrappedFunction

  function wrappedFunction() {
    var transaction = tracer.getTransaction()
    if (!transaction) {
      logger.trace('Not creating segment "%s" because no transaction was active', name)
      return original.apply(this, arguments)
    }

    logger.trace('Creating "%s" segment for transaction %s.', name, transaction.id)
    var args = tracer.slice(arguments)
    var cb = args[0]
    if (typeof cb !== 'function') return original.apply(this, arguments)
    var child = tracer.createSegment(name, recorder)
    args[0] = tracer.wrapCallback(cb, child, wrappedCallback)
    child.start()
    return tracer.bindFunction(original, child).apply(this, args)

    function wrappedCallback() {
      logger.trace('Ending "%s" segment for transaction %s.', name, transaction.id)
      child.touch()
      var result = cb.apply(this, arguments)
      return result
    }
  }
}

function wrapFunction(name, recorder, original, wrapper, resp) {
  if (typeof original !== 'function' || !wrapper) {
    logger.trace('Not wrapping "%s" because it was not a function', name)
    return original
  }

  logger.trace('Wrapping %s using a custom wrapper', name)

  var tracer = this

  return wrappedFunction

  function wrappedFunction() {
    var transaction = tracer.getTransaction()
    if (!transaction) {
      logger.trace('Not creating segment "%s" because no transaction was active', name)
      return original.apply(this, arguments)
    }

    logger.trace('Creating "%s" segment for transaction %s.', name, transaction.id)

    var child = tracer.createSegment(name, recorder)
    var args = wrapper.call(this, child, tracer.slice(arguments), bind)
    child.start()
    var result = tracer.bindFunction(original, child).apply(this, args)
    if (resp) result = resp.call(this, child, result, bind)
    return result

    function bind(fn) {
      if (!fn) return fn
      return tracer.wrapCallback(fn, child, function nrWrappedHandler() {
        logger.trace('Touching "%s" segment for transaction %s.', name, transaction.id)
        child.touch()
        return fn.apply(this, arguments)
      })
    }
  }
}

function wrapSyncFunction(name, recorder, original) {
  if (typeof original !== 'function') {
    logger.trace('Not wrapping "%s" because it was not a function', name)
    return original
  }

  logger.trace('Wrapping "%s" as a synchronous function', name)

  var tracer = this

  return wrappedFunction

  function wrappedFunction() {
    var transaction = tracer.getTransaction()
    if (!transaction) {
      logger.trace('Not creating segment "%s" because no transaction was active', name)
      return original.apply(this, arguments)
    }
    logger.trace('Creating "%s" sync segment for transaction %s.', name, transaction.id)
    var child = tracer.createSegment(name, recorder)
    if (child) child.async = false
    return tracer.bindFunction(original, child, true).apply(this, arguments)
  }
}

function wrapCallback(original, segment, wrapped) {
  var tracer = this

  if (typeof original !== 'function') return original

  logger.trace(
    'Wrapping callback for "%s" segment',
    segment ? segment.name : 'unknown'
  )

  return tracer.bindFunction(function wrappedCallback() {
    if (wrapped) wrapped[ORIGINAL] = original

    var child = tracer.createSegment(
      'Callback: ' + (original.name || 'anonymous'),
      null,
      segment
    )

    if (child) child.async = false

    return tracer.bindFunction(wrapped || original, child, true).apply(this, arguments)
  }, segment, false)
}
