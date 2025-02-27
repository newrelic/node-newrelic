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
const AsyncLocalContextManager = require('../../context-manager/async-local-context-manager')
const TraceSegment = require('../trace/segment')

module.exports = Tracer

function Tracer(agent) {
  if (!agent) {
    throw new Error('Must be initialized with an agent.')
  }

  this.agent = agent
  this._contextManager = new AsyncLocalContextManager(agent.config.feature_flag.opentelemetry_bridge)
}

Tracer.prototype.getContext = getContext
Tracer.prototype.getTransaction = getTransaction
Tracer.prototype.getSegment = getSegment
Tracer.prototype.setSegment = setSegment
Tracer.prototype.getSpanContext = getSpanContext
Tracer.prototype.createSegment = createSegment
Tracer.prototype.addSegment = addSegment
Tracer.prototype.transactionProxy = transactionProxy
Tracer.prototype.transactionNestProxy = transactionNestProxy
Tracer.prototype.bindFunction = bindFunction
Tracer.prototype.bindEmitter = bindEmitter
Tracer.prototype.getOriginal = getOriginal
Tracer.prototype.slice = argSlice
Tracer.prototype.wrapFunctionFirstNoSegment = wrapFunctionFirstNoSegment
Tracer.prototype.wrapFunction = wrapFunction
Tracer.prototype.wrapFunctionLast = wrapFunctionLast
Tracer.prototype.wrapFunctionFirst = wrapFunctionFirst
Tracer.prototype.wrapSyncFunction = wrapSyncFunction
Tracer.prototype.wrapCallback = wrapCallback

function getContext() {
  return this._contextManager.getContext()
}

function getTransaction() {
  const context = this.getContext()
  if (context?.transaction && context?.transaction?.isActive()) {
    return context.transaction
  }

  return null
}

// TODO: Remove/replace external uses to tracer.getSegment()
function getSegment() {
  const context = this.getContext()
  return context?.segment || null
}

// TODO: update to setNewContext or something like that
function setSegment({ transaction, segment } = {}) {
  const context = this.getContext()
  const newContext = context.enterSegment({
    transaction: transaction !== undefined ? transaction : context.transaction,
    segment: segment !== undefined ? segment : context.segment
  })

  this._contextManager.setContext(newContext)
}

// TODO: Remove/replace external uses to tracer.getSpanContext()
function getSpanContext() {
  const currentSegment = this.getSegment()
  return currentSegment && currentSegment.getSpanContext()
}

/**
 * Create segment and assign recorder to transaction. This also increments counters of
 * segments.
 * Does not create segment if there is no parent, transaction is active or parent
 * is opaque.
 *
 * @param {object} params to fn
 * @param {string} params.id if present, it will use id as segment.id. only used in otel bridge mode.
 * @param {string} params.name name of segment
 * @param {function} params.recorder time slice metrics recorder for segment
 * @param {TraceSegment} params.parent parent segment of segment being created
 * @param {Transaction} params.transaction active transaction
 * @returns {TraceSegment|null} returns new segment, existing parent if opaque or null(no parent or transaction inactive)
 */
function createSegment({ id, name, recorder, parent, transaction }) {
  if (!parent || !transaction?.isActive()) {
    logger.trace(
      {
        hasParent: !!parent,
        transactionActive: transaction?.isActive()
      },
      'Not creating segment %s, no parent or active transaction available.',
      name
    )
    return null
  }

  if (parent.opaque) {
    logger.trace('Skipping child addition on opaque segment')
    return parent
  }

  logger.trace('Adding segment %s to %s in %s', name, parent.name, transaction.id)

  let collect = true

  if (transaction.numSegments >= this.agent.config.max_trace_segments) {
    collect = false
  }
  transaction.incrementCounters()

  const segment = new TraceSegment({
    id,
    config: this.agent.config,
    name,
    collect,
    root: transaction.trace.root,
    parentId: parent.id
  })

  if (recorder) {
    transaction.addRecorder(recorder.bind(null, segment))
  }
  transaction.trace.segments.add(segment)

  return segment
}

function addSegment(name, recorder, parent, full, task) {
  if (typeof task !== 'function') {
    throw new Error('task must be a function')
  }

  const context = this.getContext()
  const segment = this.createSegment({ name, recorder, parent, transaction: context.transaction })
  let newContext = context
  if (segment) {
    newContext = context.enterSegment({ segment })
  }
  maybeAddCLMAttributes(task, segment)
  return this.bindFunction(task, newContext, full)(segment, context?.transaction)
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
    const context = tracer.getContext()
    const segment = context?.segment
    const currentTx = context?.transaction
    if (segment) {
      logger.warn(
        {
          transaction: { id: currentTx.id, name: currentTx.getName() },
          segment: segment.name
        },
        'Active transaction when creating non-nested transaction'
      )
      tracer.agent.recordSupportability('Nodejs/Transactions/Nested')
      return handler.apply(this, arguments)
    }

    const transaction = new Transaction(tracer.agent)
    const newContext = context.enterTransaction(transaction)
    return tracer.bindFunction(handler, newContext, true).apply(this, arguments)
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
    let context = tracer.getContext()

    let createNew = false

    if (!context?.transaction || context?.transaction.type !== type) {
      createNew = true
    }

    if (createNew) {
      const transaction = new Transaction(tracer.agent)
      transaction.type = type
      context = context.enterTransaction(transaction)
    }

    return tracer.bindFunction(handler, context).apply(this, arguments)
  }

  wrapped[symbols.original] = handler

  return wrapped
}

function bindFunction(handler, context, full) {
  if (typeof handler !== 'function') {
    return handler
  }

  return _makeWrapped({ tracer: this, handler, context, full: !!full })
}
function _makeWrapped({ tracer, handler, context, full }) {
  const { segment } = context
  wrapped[symbols.original] = getOriginal(handler)
  wrapped[symbols.segment] = segment

  return wrapped

  function wrapped() {
    if (segment && full) {
      segment.start()
    }

    try {
      return tracer._contextManager.runInContext(context, handler, this, arguments)
    } catch (err) {
      logger.trace(err, 'Error from wrapped function:')
      throw err // Re-throwing application error, this is not an agent error.
    } finally {
      if (segment && full) {
        segment.touch()
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
  const context = this.getContext()
  const newContext = context.enterSegment({ segment })
  emitter.emit = this.bindFunction(emit, newContext)

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
    const context = tracer.getContext()
    const args = tracer.slice(arguments)
    const cb = args[0]
    if (typeof cb === 'function') {
      args[0] = tracer.bindFunction(cb, context)
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
    const context = tracer.getContext()
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
    const child = tracer.createSegment({
      name,
      recorder,
      parent: context.segment,
      transaction: context.transaction
    })
    args[last] = tracer.wrapCallback(cb, child, function wrappedCallback() {
      logger.trace('Ending "%s" segment for transaction %s.', name, transaction.id)
      child.touch()
      return cb.apply(this, arguments)
    })
    child.start()
    const newContext = context.enterSegment({ segment: child })
    return tracer.bindFunction(original, newContext).apply(this, args)
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
    const context = tracer.getContext()
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
    const child = tracer.createSegment({
      name,
      recorder,
      parent: context.segment,
      transaction: context.transaction
    })
    args[0] = tracer.wrapCallback(cb, child, function wrappedCallback() {
      logger.trace('Ending "%s" segment for transaction %s.', name, transaction.id)
      child.touch()
      return cb.apply(this, arguments)
    })
    child.start()
    const newContext = context.enterSegment({ segment: child })
    return tracer.bindFunction(original, newContext).apply(this, args)
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
    const context = tracer.getContext()
    const transaction = tracer.getTransaction()
    if (!transaction) {
      logger.trace(INACTIVE_TRANSACTION_MESSAGE, name)
      return original.apply(this, arguments)
    }

    logger.trace(CREATE_SEGMENT_MESSAGE, name, transaction.id)

    const child = tracer.createSegment({ name, recorder, parent: context.segment, transaction })
    const args = wrapper.call(this, child, tracer.slice(arguments), bind)
    child.start()
    const newContext = context.enterSegment({ segment: child })
    let result = tracer.bindFunction(original, newContext).apply(this, args)
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
    const context = tracer.getContext()
    const transaction = tracer.getTransaction()
    if (!transaction) {
      logger.trace(INACTIVE_TRANSACTION_MESSAGE, name)
      return original.apply(this, arguments)
    }
    logger.trace('Creating "%s" sync segment for transaction %s.', name, transaction.id)
    const child = tracer.createSegment({ name, recorder, parent: context.segment, transaction })
    if (child) {
      child.async = false
    }
    const newContext = context.enterSegment({ segment: child })
    return tracer.bindFunction(original, newContext, true).apply(this, arguments)
  }
}

function wrapCallback(original, segment, wrapped) {
  const tracer = this
  const context = this.getContext()

  if (typeof original !== 'function') {
    return original
  }

  logger.trace('Wrapping callback for "%s" segment', segment ? segment.name : 'unknown')

  return tracer.bindFunction(
    function wrappedCallback() {
      if (wrapped) {
        wrapped[symbols.original] = original
      }

      const child = tracer.createSegment({
        name: 'Callback: ' + (original.name || 'anonymous'),
        parent: segment,
        transaction: context.transaction
      })

      if (child) {
        child.async = false
      }

      const newContext = context.enterSegment({ segment: child })
      return tracer.bindFunction(wrapped || original, newContext, true).apply(this, arguments)
    },
    context,
    false
  )
}
