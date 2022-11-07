/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('util')
const properties = require('../util/properties')
const shimmer = require('../shimmer')
const symbols = require('../symbols')

/**
 * @namespace Library.Spec
 * @property {string} name
 *  The name of this promise library.
 * @property {?string} constructor
 *  Optional. The name of the property that is the Promise constructor. Default
 *  is to use the library itself as the Promise constructor.
 * @property {?bool} executor
 *  Optional. If true, the Promise constructor itself will be wrapped for the
 *  executor. If false then `_proto`, `_static`, or `_library` must have an
 *  `executor` field whose value is the name of the executor function. Default
 *  is false.
 * @property {Library.Spec.Mapping} $proto
 *  The mapping for Promise instance method concepts (i.e. `then`). These are
 *  mapped on the Promise class' prototype.
 * @property {Library.Spec.Mapping} $static
 *  The mapping for Promise static method concepts (i.e. `all`, `race`). These
 *  are mapped on the Promise class itself.
 * @property {?Library.Spec.Mapping} $library
 *  The mapping for library-level static method concepts (i.e. `fcall`, `when`).
 *  These are mapped on the library containing the Promise class. NOTE: in most
 *  promise implementations, the Promise class is itself the library thus this
 *  property is unnecessary.
 */

/**
 * @namespace Library.Spec.Mapping
 * @description
 *   A mapping of promise concepts (i.e. `then`) to this library's implementation
 *   name(s) (i.e. `["then", "chain"]`). Each value can by either a single string
 *   or an array of strings if the concept exists under multiple keys. If any
 *   given concept doesn't exist in this library, it is simply skipped.
 * @property {Array} $copy
 *  An array of properties or methods to just directly copy without wrapping.
 *  This field only matters when `Library.Spec.executor` is `true`.
 * @property {string | Array} executor
 * @property {string | Array} then
 * @property {string | Array} all
 * @property {string | Array} race
 * @property {string | Array} resolve
 *  Indicates methods to wrap which are resolve factories. This method only
 *  requires wrapping if the library doesn't use an executor internally to
 *  implement it.
 * @property {string | Array} reject
 *  Indicates methods to wrap which are reject factories. Like `resolve`, this
 *  method only requires wrapping if the library doesn't use an executor
 *  internally to implement it.
 */

/**
 * Instruments a promise library.
 *
 * @param {Agent}         agent   - The New Relic APM agent.
 * @param {Function}      library - The promise library.
 * @param {?Library.Spec} spec    - Spec for this promise library mapping.
 */
/* eslint-disable camelcase */
module.exports = function initialize(agent, library, spec) {
  const contextManager = agent._contextManager

  if (spec.useFinally == null) {
    spec.useFinally = true
  }
  // Wrap library-level methods.
  wrapStaticMethods(library, spec.name, spec.$library)

  // Wrap prototype methods.
  const Promise = library[spec.constructor]
  wrapPrototype(Promise.prototype)
  wrapStaticMethods(Promise, spec.constructor, spec.$static)

  // See if we are wrapping the class itself.
  if (spec.executor) {
    shimmer.wrapMethod(library, spec.name, spec.constructor, wrapPromise)
  }

  /**
   * Wraps the Promise constructor as the executor.
   */
  function wrapPromise() {
    // Copy all unwrapped properties over.
    if (spec.$static && spec.$static.$copy) {
      spec.$static.$copy.forEach(function copyKeys(key) {
        if (!wrappedPromise[key]) {
          wrappedPromise[key] = Promise[key]
        }
      })
    }

    const passThrough = spec.$static && spec.$static.$passThrough
    if (passThrough) {
      passThrough.forEach(function assignProxy(proxyProp) {
        if (!properties.hasOwn(wrappedPromise, proxyProp)) {
          Object.defineProperty(wrappedPromise, proxyProp, {
            enumerable: true,
            configurable: true,
            get: function getOriginal() {
              return Promise[proxyProp]
            },
            set: function setOriginal(newValue) {
              Promise[proxyProp] = newValue
            }
          })
        }
      })
    }

    // Inherit to pass `instanceof` checks.
    util.inherits(wrappedPromise, Promise)

    // Make the wrapper.
    return wrappedPromise
  }

  function wrappedPromise(executor) {
    if (!(this instanceof wrappedPromise)) {
      return Promise(executor) // eslint-disable-line new-cap
    }

    const parent = contextManager.getContext()
    let promise = null
    if (
      !parent ||
      !parent.transaction.isActive() ||
      typeof executor !== 'function' ||
      arguments.length !== 1
    ) {
      // We are expecting one function argument for executor, anything else is
      // non-standard, do not attempt to wrap. Also do not attempt to wrap if we
      // are not in a transaction.
      const cnstrctArgs = agent.tracer.slice(arguments)
      cnstrctArgs.unshift(Promise) // `unshift` === `push_front`
      promise = new (Promise.bind.apply(Promise, cnstrctArgs))()
    } else {
      const segmentName = 'Promise ' + (executor.name || '<anonymous>')
      const context = {
        promise: null,
        self: null,
        args: null
      }
      promise = new Promise(wrapExecutorContext(context))
      context.promise = promise
      const segment = _createSegment(segmentName)
      Contextualizer.link(null, promise, segment, spec.useFinally)

      segment.start()
      try {
        // Must run after promise is defined so that `__NR_wrapper` can be set.
        contextManager.runInContext(segment, executor, context.self, context.args)
      } catch (e) {
        context.args[1](e)
      } finally {
        segment.touch()
      }
    }

    // The Promise must be created using the "real" Promise constructor (using
    // normal Promise.apply(this) method does not work). But the prototype
    // chain must include the wrappedPromise.prototype, V8's promise
    // implementation uses promise.constructor to create new Promises for
    // calls to `then`, `chain` and `catch` which allows these Promises to
    // also be instrumented.
    promise.__proto__ = wrappedPromise.prototype // eslint-disable-line no-proto

    return promise
  }

  function wrapPrototype(PromiseProto, name) {
    // Don't wrap the proto if there is no spec for it.
    if (!spec.$proto) {
      return
    }

    name = name || spec.constructor + '.prototype'

    // Wrap up instance methods.
    _safeWrap(PromiseProto, name, spec.$proto.executor, wrapExecutorCaller)
    _safeWrap(PromiseProto, name, spec.$proto.then, wrapThen)
    _safeWrap(PromiseProto, name, spec.$proto.cast, wrapCast)
    _safeWrap(PromiseProto, name, spec.$proto.catch, wrapCatch)
  }

  function wrapStaticMethods(lib, name, staticSpec) {
    // Don't bother with empty specs.
    if (!staticSpec) {
      return
    }

    _safeWrap(lib, name, staticSpec.cast, wrapCast)
    _safeWrap(lib, name, staticSpec.promisify, wrapPromisifiy)
  }

  function wrapExecutorCaller(caller) {
    return function wrappedExecutorCaller(executor) {
      const parent = agent.tracer.getSegment()
      if (!(this instanceof Promise) || !parent || !parent.transaction.isActive()) {
        return caller.apply(this, arguments)
      }

      const context = {
        promise: this,
        self: null,
        args: null
      }
      if (!this[symbols.context]) {
        const segmentName = 'Promise ' + executor.name || '<anonymous>'
        const segment = _createSegment(segmentName)
        Contextualizer.link(null, this, segment, spec.useFinally)
      }
      const args = [].slice.call(arguments)
      args[0] = wrapExecutorContext(context, this[symbols.context].getSegment())
      const ret = caller.apply(this, args)

      // Bluebird catches executor errors and auto-rejects when it catches them,
      // thus we need to do so as well.
      //
      // When adding new libraries, make sure to check that they behave the same
      // way. We may need to enhance the promise spec to handle this variance.
      try {
        executor.apply(context.self, context.args)
      } catch (e) {
        context.args[1](e)
      }
      return ret
    }
  }

  /**
   * Creates a function which will export the context and arguments of its
   * execution.
   *
   * @param {object} context - The object to export the execution context with.
   * @returns {Function} A function which, when executed, will add its context
   *  and arguments to the `context` parameter.
   */
  function wrapExecutorContext(context) {
    return function contextExporter(resolve, reject) {
      context.self = this
      context.args = [].slice.call(arguments)
      context.args[0] = wrapResolver(context, resolve)
      context.args[1] = wrapResolver(context, reject)
    }
  }

  function wrapResolver(context, fn) {
    return function wrappedResolveReject(val) {
      const promise = context.promise
      if (promise && promise[symbols.context]) {
        promise[symbols.context].getSegment().touch()
      }
      fn(val)
    }
  }

  /**
   * Creates a wrapper for `Promise#then` that extends the transaction context.
   *
   * @param then
   * @param name
   * @returns {Function} A wrapped version of `Promise#then`.
   */
  function wrapThen(then, name) {
    return _wrapThen(then, name, true)
  }

  /**
   * Creates a wrapper for `Promise#catch` that extends the transaction context.
   *
   * @param cach
   * @param name
   * @returns {Function} A wrapped version of `Promise#catch`.
   */
  function wrapCatch(cach, name) {
    return _wrapThen(cach, name, false)
  }

  /**
   * Creates a wrapper for promise chain extending methods.
   *
   * @param {Function} then
   *  The function we are to wrap as a chain extender.
   * @param name
   * @param {bool} useAllParams
   *  When true, all parameters which are functions will be wrapped. Otherwise,
   *  only the last parameter will be wrapped.
   * @returns {Function} A wrapped version of the function.
   */
  function _wrapThen(then, name, useAllParams) {
    // Don't wrap non-functions.
    if (typeof then !== 'function' || then.name === '__NR_wrappedThen') {
      return then
    }

    return function __NR_wrappedThen() {
      if (!(this instanceof Promise)) {
        return then.apply(this, arguments)
      }

      const segmentNamePrefix = 'Promise#' + name + ' '
      const thenSegment = agent.tracer.getSegment()
      const promise = this

      // Wrap up the arguments and execute the real then.
      let isWrapped = false
      const args = [].map.call(arguments, wrapHandler)
      const next = then.apply(this, args)

      // If we got a promise (which we should have), link the parent's context.
      if (!isWrapped && next instanceof Promise && next !== promise) {
        Contextualizer.link(promise, next, thenSegment, spec.useFinally)
      }
      return next

      function wrapHandler(fn, i, arr) {
        if (
          typeof fn !== 'function' || // Not a function
          fn.name === '__NR_wrappedThenHandler' || // Already wrapped
          (!useAllParams && i !== arr.length - 1) // Don't want all and not last
        ) {
          isWrapped = fn && fn.name === '__NR_wrappedThenHandler'
          return fn
        }

        return function __NR_wrappedThenHandler() {
          if (!next || !next[symbols.context]) {
            return fn.apply(this, arguments)
          }

          let promSegment = next[symbols.context].getSegment()
          const segmentName = segmentNamePrefix + (fn.name || '<anonymous>')
          const segment = _createSegment(segmentName, promSegment)
          if (segment && segment !== promSegment) {
            next[symbols.context].setSegment(segment)
            promSegment = segment
          }

          let ret = null
          try {
            ret = agent.tracer.bindFunction(fn, promSegment, true).apply(this, arguments)
          } finally {
            if (ret && typeof ret.then === 'function') {
              ret = next[symbols.context].continue(ret)
            }
          }
          return ret
        }
      }
    }
  }

  /**
   * Creates a wrapper around the static `Promise` factory method.
   *
   * @param cast
   * @param name
   */
  function wrapCast(cast, name) {
    if (typeof cast !== 'function' || cast.name === '__NR_wrappedCast') {
      return cast
    }

    const CAST_SEGMENT_NAME = 'Promise.' + name
    return function __NR_wrappedCast() {
      const segment = _createSegment(CAST_SEGMENT_NAME)
      const prom = cast.apply(this, arguments)
      if (segment) {
        Contextualizer.link(null, prom, segment, spec.useFinally)
      }
      return prom
    }
  }

  function wrapPromisifiy(promisify, name) {
    if (typeof promisify !== 'function' || promisify.name === '__NR_wrappedPromisify') {
      return promisify
    }

    const WRAP_SEGMENT_NAME = 'Promise.' + name
    return function __NR_wrappedPromisify() {
      const promisified = promisify.apply(this, arguments)
      if (typeof promisified !== 'function') {
        return promisified
      }

      Object.keys(promisified).forEach(function forEachProperty(prop) {
        __NR_wrappedPromisified[prop] = promisified[prop]
      })

      return __NR_wrappedPromisified
      function __NR_wrappedPromisified() {
        const segment = _createSegment(WRAP_SEGMENT_NAME)
        const prom = agent.tracer.bindFunction(promisified, segment, true).apply(this, arguments)

        if (segment) {
          Contextualizer.link(null, prom, segment, spec.useFinally)
        }

        return prom
      }
    }
  }

  function _createSegment(name, parent) {
    return agent.config.feature_flag.promise_segments === true
      ? agent.tracer.createSegment(name, null, parent)
      : parent || agent.tracer.getSegment()
  }
}

/**
 * Performs a `wrapMethod` if and only if `methods` is truthy and has a length
 * greater than zero.
 *
 * @param {object}        obj     - The source of the methods to wrap.
 * @param {string}        name    - The name of this source.
 * @param {string | Array}  methods - The names of the methods to wrap.
 * @param {Function}      wrapper - The function which wraps the methods.
 */
function _safeWrap(obj, name, methods, wrapper) {
  if (methods && methods.length) {
    shimmer.wrapMethod(obj, name, methods, wrapper)
  }
}

function Context(segment) {
  this.segments = [segment]
}

Context.prototype = Object.create(null)

Context.prototype.branch = function branch() {
  return this.segments.push(null) - 1
}

function Contextualizer(idx, context, useFinally) {
  this.parentIdx = -1
  this.idx = idx
  this.context = context
  this.child = null
  this.useFinally = useFinally
}
module.exports.Contextualizer = Contextualizer

Contextualizer.link = function link(prev, next, segment, useFinally) {
  let ctxlzr = prev && prev[symbols.context]
  if (ctxlzr && !ctxlzr.isActive()) {
    ctxlzr = prev[symbols.context] = null
  }

  if (ctxlzr) {
    // If prev has one child already, branch the context and update the child.
    if (ctxlzr.child) {
      // When the branch-point is the 2nd through nth link in the chain, it is
      // necessary to track its segment separately so the branches can parent
      // their segments on the branch-point.
      if (ctxlzr.parentIdx !== -1) {
        ctxlzr.idx = ctxlzr.context.branch()
      }

      // The first child needs to be updated to have its own branch as well. And
      // each of that child's children must be updated with the new parent index.
      // This is the only non-constant-time action for linking, but it only
      // happens with branching promise chains specifically when the 2nd branch
      // is added.
      //
      // Note: This does not account for branches of branches. That may result
      // in improperly parented segments.
      let parent = ctxlzr
      let child = ctxlzr.child
      const branchIdx = ctxlzr.context.branch()
      do {
        child.parentIdx = parent.idx
        child.idx = branchIdx
        parent = child
        child = child.child
      } while (child)

      // We set the child to something falsey that isn't `null` so we can
      // distinguish between having no child, having one child, and having
      // multiple children.
      ctxlzr.child = false
    }

    // If this is a branching link then create a new branch for the next promise.
    // Otherwise, we can just piggy-back on the previous link's spot.
    const idx = ctxlzr.child === false ? ctxlzr.context.branch() : ctxlzr.idx

    // Create a new context for this next promise.
    next[symbols.context] = new Contextualizer(idx, ctxlzr.context, ctxlzr.useFinally)
    next[symbols.context].parentIdx = ctxlzr.idx

    // If this was our first child, remember it in case we have a 2nd.
    if (ctxlzr.child === null) {
      ctxlzr.child = next[symbols.context]
    }
  } else if (segment) {
    // This next promise is the root of a chain. Either there was no previous
    // promise or the promise was created out of context.
    next[symbols.context] = new Contextualizer(0, new Context(segment), useFinally)
  }
}

Contextualizer.prototype = Object.create(null)

Contextualizer.prototype.isActive = function isActive() {
  const segments = this.context.segments
  const segment = segments[this.idx] || segments[this.parentIdx] || segments[0]
  return segment && segment.transaction.isActive()
}

Contextualizer.prototype.getSegment = function getSegment() {
  const segments = this.context.segments
  let segment = segments[this.idx]
  if (segment == null) {
    segment = segments[this.idx] = segments[this.parentIdx] || segments[0]
  }
  return segment
}

Contextualizer.prototype.setSegment = function setSegment(segment) {
  return (this.context.segments[this.idx] = segment)
}

Contextualizer.prototype.toJSON = function toJSON() {
  // No-op.
}

Contextualizer.prototype.continue = function continueContext(prom) {
  const self = this
  const nextContext = prom[symbols.context]
  if (!nextContext) {
    return prom
  }

  // If we have `finally`, use that to sneak our context update.
  if (typeof prom.finally === 'function' && nextContext.useFinally) {
    return prom.finally(__NR_continueContext)
  }

  // No `finally` means we need to hook into resolve and reject individually and
  // pass through whatever happened.
  return prom.then(
    function __NR_thenContext(val) {
      __NR_continueContext()
      return val
    },
    function __NR_catchContext(err) {
      __NR_continueContext()
      throw err // Re-throwing promise rejection, this is not New Relic's error.
    }
  )

  function __NR_continueContext() {
    self.setSegment(nextContext.getSegment())
  }
}
/* eslint-disable camelcase */
