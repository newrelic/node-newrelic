/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Transaction = require('../index.js')
const logger = require('../../logger').child({ component: 'tracer' })
const symbols = require('../../symbols')
const INACTIVE_TRANSACTION_MESSAGE = 'Not creating segment "%s" because no transaction was active'
const SKIP_WRAPPING_FUNCTION_MESSAGE = 'Not wrapping "%s" because it was not a function'
const CREATE_SEGMENT_MESSAGE = 'Creating "%s" segment for transaction %s.'
const { addCLMAttributes: maybeAddCLMAttributes } = require('../../util/code-level-metrics')

module.exports = Tracer

function Tracer(agent, contextManager) {
  if (!agent) {
    throw new Error('Must be initialized with an agent.')
  }

  this.agent = agent
  this._contextManager = contextManager
}

Tracer.prototype.getTransaction = getTransaction
Tracer.prototype.getSegment = getSegment
Tracer.prototype.getSpanContext = getSpanContext
Tracer.prototype.createSegment = createSegment
Tracer.prototype.addSegment = addSegment
Tracer.prototype.transactionProxy = transactionProxy
Tracer.prototype.transactionNestProxy = transactionNestProxy
Tracer.prototype.bindFunction = bindFunction
Tracer.prototype.bindEmitter = bindEmitter
Tracer.prototype.getOriginal = getOriginal
Tracer.prototype.slice = argSlice
Tracer.prototype.wrapFunctionNoSegment = wrapFunctionNoSegment
Tracer.prototype.wrapFunctionFirstNoSegment = wrapFunctionFirstNoSegment
Tracer.prototype.wrapFunction = wrapFunction
Tracer.prototype.wrapFunctionLast = wrapFunctionLast
Tracer.prototype.wrapFunctionFirst = wrapFunctionFirst
Tracer.prototype.wrapSyncFunction = wrapSyncFunction
Tracer.prototype.wrapCallback = wrapCallback

function getTransaction() {
  const currentSegment = this._contextManager.getContext()
  if (currentSegment && currentSegment.transaction && currentSegment.transaction.isActive()) {
    return currentSegment.transaction
  }

  return null
}

// TODO: Remove/replace external uses to tracer.getSegment()
function getSegment() {
  return this._contextManager.getContext()
}

// TODO: Remove/replace external uses to tracer.getSpanContext()
function getSpanContext() {
  const currentSegment = this.getSegment()
  return currentSegment && currentSegment.getSpanContext()
}

function createSegment(name, recorder, _parent) {
  const parent = _parent || this.getSegment()
  if (!parent || !parent.transaction.isActive()) {
    logger.trace(
      {
        hasParent: !!parent,
        transactionActive: parent && parent.transaction.isActive()
      },
      'Not creating segment %s, no parent or active transaction available.',
      name
    )
    return null
  }
  return parent.add(name, recorder)
}

function addSegment(name, recorder, parent, full, task) {
  if (typeof task !== 'function') {
    throw new Error('task must be a function')
  }

  const segment = this.createSegment(name, recorder, parent)

  maybeAddCLMAttributes(task, segment)
  return this.bindFunction(task, segment, full)(segment)
}

function transactionProxy(handler) {
  // if there's no handler, there's nothing to proxy.
  if (typeof handler !== 'function') {
    return handler
  }

  const tracer = this
  const wrapped = function wrapTransactionInvocation() {
    if (!tracer.agent.canCollectData()) {
      return handler.apply(this, arguments)
    }

    // don't nest transactions, reuse existing ones
    const segment = tracer.getSegment()
    if (segment) {
      if (segment.transaction.traceStacks) {
        segment.probe('!!! Nested transaction creation !!!')
        segment.transaction.traceFlag = true // Will log the stacks when it ends.
      }
      logger.warn(
        {
          transaction: { id: segment.transaction.id, name: segment.transaction.getName() },
          segment: segment.name
        },
        'Active transaction when creating non-nested transaction'
      )
      tracer.agent.recordSupportability('Nodejs/Transactions/Nested')
      return handler.apply(this, arguments)
    }
    const transaction = new Transaction(tracer.agent)
    return tracer.bindFunction(handler, transaction.trace.root, true).apply(this, arguments)
  }

  wrapped[symbols.original] = handler

  return wrapped
}

/**
 * Use transactionNestProxy to wrap a closure that is a top-level handler that
 * is meant to start transactions. This wraps the first half of asynchronous
 * handlers. Use bindFunction to wrap handler callbacks. This detects to see
 * if there is an in play segment and uses that as the root instead of
 * transaction.trace.root.
 *
 * @param {string} type - Type of transaction to create. 'web' or 'bg'.
 * @param {Function} handler - Generator to proxy.
 * @returns {Function} Proxy.
 */
function transactionNestProxy(type, handler) {
  if (handler === undefined && typeof type === 'function') {
    handler = type
    type = undefined
  }
  // if there's no handler, there's nothing to proxy.
  if (typeof handler !== 'function') {
    return handler
  }

  const tracer = this
  const wrapped = function wrapTransactionInvocation() {
    if (!tracer.agent.canCollectData()) {
      return handler.apply(this, arguments)
    }

    // don't nest transactions, reuse existing ones
    let transaction = tracer.getTransaction()
    let segment = tracer.getSegment()

    let createNew = false

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

  wrapped[symbols.original] = handler

  return wrapped
}

function bindFunction(handler, segment, full) {
  if (typeof handler !== 'function') {
    return handler
  }

  return _makeWrapped(this, handler, segment || this.getSegment(), !!full)
}
function _makeWrapped(tracer, handler, active, full) {
  wrapped[symbols.original] = getOriginal(handler)
  wrapped[symbols.segment] = active

  return wrapped

  function wrapped() {
    const prev = tracer.getSegment()

    if (active && full) {
      active.start()
    }

    try {
      return tracer._contextManager.runInContext(active, handler, this, arguments)
    } catch (err) {
      logger.trace(err, 'Error from wrapped function:')

      if (prev === null && process.domain != null) {
        process.domain[symbols.segment] = tracer.getSegment()
      }

      throw err // Re-throwing application error, this is not an agent error.
    } finally {
      if (active && full) {
        active.touch()
      }
    }
  }
}

function getOriginal(fn) {
  const original = fn[symbols.original]
  if (original) {
    return original
  }
  return fn
}

function bindEmitter(emitter, segment) {
  if (!emitter || !emitter.emit) {
    return emitter
  }

  const emit = getOriginal(emitter.emit)
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
  const length = args.length
  const array = new Array(length)

  for (let i = 0; i < length; i++) {
    array[i] = args[i]
  }

  return array
}

function wrapFunctionNoSegment(original, name, wrapper) {
  if (typeof original !== 'function') {
    return original
  }

  logger.trace('Wrapping function %s (no segment)', name || original.name || 'anonymous')
  const tracer = this

  return wrappedFunction

  function wrappedFunction() {
    if (!tracer.getTransaction()) {
      return original.apply(this, arguments)
    }
    let args = tracer.slice(arguments)

    if (wrapper === undefined) {
      const last = args.length - 1
      const cb = args[last]
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
  if (typeof original !== 'function') {
    return original
  }

  logger.trace('Wrapping function %s (no segment)', name || original.name || 'anonymous')
  const tracer = this

  return wrappedFunction

  function wrappedFunction() {
    if (!tracer.getTransaction()) {
      return original.apply(this, arguments)
    }
    const args = tracer.slice(arguments)
    const cb = args[0]
    if (typeof cb === 'function') {
      args[0] = tracer.bindFunction(cb)
    }
    return original.apply(this, args)
  }
}

function wrapFunctionLast(name, recorder, original) {
  if (typeof original !== 'function') {
    logger.trace(SKIP_WRAPPING_FUNCTION_MESSAGE, name)
    return original
  }

  logger.trace('Wrapping %s as a callback-last function', name)
  const tracer = this

  return wrappedFunction

  function wrappedFunction() {
    const transaction = tracer.getTransaction()
    if (!transaction) {
      logger.trace(INACTIVE_TRANSACTION_MESSAGE, name)
      return original.apply(this, arguments)
    }

    logger.trace(CREATE_SEGMENT_MESSAGE, name, transaction.id)
    const args = tracer.slice(arguments)
    const last = args.length - 1
    const cb = args[last]
    if (typeof cb !== 'function') {
      return original.apply(this, arguments)
    }
    const child = tracer.createSegment(name, recorder)
    args[last] = tracer.wrapCallback(cb, child, function wrappedCallback() {
      logger.trace('Ending "%s" segment for transaction %s.', name, transaction.id)
      child.touch()
      return cb.apply(this, arguments)
    })
    child.start()
    return tracer.bindFunction(original, child).apply(this, args)
  }
}

function wrapFunctionFirst(name, recorder, original) {
  if (typeof original !== 'function') {
    logger.trace(SKIP_WRAPPING_FUNCTION_MESSAGE, name)
    return original
  }

  logger.trace('Wrapping %s as a callback-first function', name)
  const tracer = this

  return wrappedFunction

  function wrappedFunction() {
    const transaction = tracer.getTransaction()
    if (!transaction) {
      logger.trace(INACTIVE_TRANSACTION_MESSAGE, name)
      return original.apply(this, arguments)
    }

    logger.trace(CREATE_SEGMENT_MESSAGE, name, transaction.id)
    const args = tracer.slice(arguments)
    const cb = args[0]
    if (typeof cb !== 'function') {
      return original.apply(this, arguments)
    }
    const child = tracer.createSegment(name, recorder)
    args[0] = tracer.wrapCallback(cb, child, function wrappedCallback() {
      logger.trace('Ending "%s" segment for transaction %s.', name, transaction.id)
      child.touch()
      return cb.apply(this, arguments)
    })
    child.start()
    return tracer.bindFunction(original, child).apply(this, args)
  }
}

function wrapFunction(name, recorder, original, wrapper, resp) {
  if (typeof original !== 'function' || !wrapper) {
    logger.trace(SKIP_WRAPPING_FUNCTION_MESSAGE, name)
    return original
  }

  logger.trace('Wrapping %s using a custom wrapper', name)

  const tracer = this

  return wrappedFunction

  function wrappedFunction() {
    const transaction = tracer.getTransaction()
    if (!transaction) {
      logger.trace(INACTIVE_TRANSACTION_MESSAGE, name)
      return original.apply(this, arguments)
    }

    logger.trace(CREATE_SEGMENT_MESSAGE, name, transaction.id)

    const child = tracer.createSegment(name, recorder)
    const args = wrapper.call(this, child, tracer.slice(arguments), bind)
    child.start()
    let result = tracer.bindFunction(original, child).apply(this, args)
    if (resp) {
      result = resp.call(this, child, result, bind)
    }
    return result

    function bind(fn) {
      if (!fn) {
        return fn
      }
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
    logger.trace(SKIP_WRAPPING_FUNCTION_MESSAGE, name)
    return original
  }

  logger.trace('Wrapping "%s" as a synchronous function', name)

  const tracer = this

  return wrappedFunction

  function wrappedFunction() {
    const transaction = tracer.getTransaction()
    if (!transaction) {
      logger.trace(INACTIVE_TRANSACTION_MESSAGE, name)
      return original.apply(this, arguments)
    }
    logger.trace('Creating "%s" sync segment for transaction %s.', name, transaction.id)
    const child = tracer.createSegment(name, recorder)
    if (child) {
      child.async = false
    }
    return tracer.bindFunction(original, child, true).apply(this, arguments)
  }
}

function wrapCallback(original, segment, wrapped) {
  const tracer = this

  if (typeof original !== 'function') {
    return original
  }

  logger.trace('Wrapping callback for "%s" segment', segment ? segment.name : 'unknown')

  return tracer.bindFunction(
    function wrappedCallback() {
      if (wrapped) {
        wrapped[symbols.original] = original
      }

      const child = tracer.createSegment(
        'Callback: ' + (original.name || 'anonymous'),
        null,
        segment
      )

      if (child) {
        child.async = false
      }

      return tracer.bindFunction(wrapped || original, child, true).apply(this, arguments)
    },
    segment,
    false
  )
}
