/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const util = require('util')
const properties = require('../../util/properties')
const shimmer = require('../../shimmer')
const symbols = require('../../symbols')
const ANONYMOUS = '<anonymous>'
const { WHEN_SPEC } = require('./constants')
const Contextualizer = require('./contextualizer')

/**
 * Instruments when.js
 *
 * @param {Shim} shim instance of shim
 * @param {Function} when the exported when.js library.
 */
module.exports = function initialize(shim, when) {
  const agent = shim.agent
  const contextManager = agent._contextManager
  const spec = WHEN_SPEC

  // Wrap library-level methods.
  wrapStaticMethods(when, spec.name, spec.$library)

  // Wrap prototype methods.
  const Promise = when[spec.constructor]
  wrapPrototype(Promise.prototype)
  wrapStaticMethods(Promise, spec.constructor, spec.$static)

  // See if we are wrapping the class itself.
  shimmer.wrapMethod(when, spec.name, spec.constructor, wrapPromise)

  /**
   * Wraps every method of when.js and also defines properties on
   * the $passThrough methods.
   *
   * @returns {Function} our wrapped promise
   */
  function wrapPromise() {
    spec.$static.$copy.forEach(function copyKeys(key) {
      if (!wrappedPromise[key]) {
        wrappedPromise[key] = Promise[key]
      }
    })

    spec.$static.$passThrough.forEach(function assignProxy(proxyProp) {
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

    // Inherit to pass `instanceof` checks.
    util.inherits(wrappedPromise, Promise)

    // Make the wrapper.
    return wrappedPromise
  }

  /**
   * Wraps the promise handler and binds to the
   * agent async context manager
   *
   * @param {Function} executor promise handler
   * @returns {Function} wrapped handler
   */
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
      const segmentName = 'Promise ' + (executor.name || ANONYMOUS)
      const context = {
        promise: null,
        self: null,
        args: null
      }
      promise = new Promise(wrapExecutorContext(context))
      context.promise = promise
      const segment = _createSegment(segmentName)
      Contextualizer.link(null, promise, segment)

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

  /**
   * Wraps then and catch on the when.js prototype
   *
   * @param {Function} PromiseProto when.js prototype
   * @returns {void}
   */
  function wrapPrototype(PromiseProto) {
    const name = spec.constructor + '.prototype'

    // Wrap up instance methods.
    _safeWrap(PromiseProto, name, spec.$proto.then, wrapThen)
    _safeWrap(PromiseProto, name, spec.$proto.catch, wrapCatch)
  }

  /**
   * Wraps all the static methods on when.js
   * See: constants.STATIC_PROMISE_METHODS
   *
   * @param {Function} lib when.Promise
   * @param {string} name `Promise`
   * @param {object} staticSpec see WHEN_SPEC.$static
   * @returns {void}
   */
  function wrapStaticMethods(lib, name, staticSpec) {
    _safeWrap(lib, name, staticSpec.cast, wrapCast)
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

  /**
   * Wraps the resolve/reject functions of a when.js Promise
   *
   * @param {object} context object to update execution context
   * @param {Function} fn function reference `resolve` or `rejct`
   * @returns {Function} wrapped function
   */
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
   * @param {Function} then function reference to instrument
   * @param {string} name `then`
   * @returns {Function} A wrapped version of `Promise#then`.
   */
  function wrapThen(then, name) {
    return _wrapThen(then, name, true)
  }

  /**
   * Creates a wrapper for `Promise#catch` that extends the transaction context.
   *
   * @param {Function} catchMethod function reference to instrument
   * @param {string} name `catch`
   * @returns {Function} A wrapped version of `Promise#catch`.
   */
  function wrapCatch(catchMethod, name) {
    return _wrapThen(catchMethod, name, false)
  }

  /**
   * Creates a wrapper for promise chain extending methods.
   *
   * @param {Function} then
   *  The function we are to wrap as a chain extender.
   * @param {string} name name of function being wrapped
   * @param {boolean} useAllParams
   *  When true, all parameters which are functions will be wrapped. Otherwise,
   *  only the last parameter will be wrapped.
   * @returns {Function} A wrapped version of the function.
   */
  function _wrapThen(then, name, useAllParams) {
    // Don't wrap non-functions.
    if (typeof then !== 'function' || then.name === '__NR_wrappedThen') {
      return then
    }

    // eslint-disable-next-line camelcase
    return function __NR_wrappedThen() {
      if (!(this instanceof Promise)) {
        return then.apply(this, arguments)
      }

      const segmentNamePrefix = 'Promise#' + name + ' '
      const thenSegment = agent.tracer.getSegment()
      const promise = this
      const ctx = { next: undefined, useAllParams, isWrapped: false, segmentNamePrefix }

      // Wrap up the arguments and execute the real then.
      const args = [].map.call(arguments, wrapHandler.bind(this, ctx))
      ctx.next = then.apply(this, args)

      // If we got a promise (which we should have), link the parent's context.
      if (!ctx.isWrapped && ctx.next instanceof Promise && ctx.next !== promise) {
        Contextualizer.link(promise, ctx.next, thenSegment)
      }
      return ctx.next
    }
  }

  /**
   * Wraps every function passed to .then
   *
   * @param {object} ctx context to pass data from caller to callee and back
   * @param {Function} fn function reference
   * @param {number} i position of function in .then handler
   * @param {Array} arr all args passed to .then
   * @returns {Function} wraps every function pass to then
   */
  function wrapHandler(ctx, fn, i, arr) {
    if (
      typeof fn !== 'function' || // Not a function
      fn.name === '__NR_wrappedThenHandler' || // Already wrapped
      (!ctx.useAllParams && i !== arr.length - 1) // Don't want all and not last
    ) {
      ctx.isWrapped = fn && fn.name === '__NR_wrappedThenHandler'
      return fn
    }

    // eslint-disable-next-line camelcase
    return function __NR_wrappedThenHandler() {
      if (!ctx.next || !ctx.next[symbols.context]) {
        return fn.apply(this, arguments)
      }

      let promSegment = ctx.next[symbols.context].getSegment()
      const segmentName = ctx.segmentNamePrefix + (fn.name || ANONYMOUS)
      const segment = _createSegment(segmentName, promSegment)
      if (segment && segment !== promSegment) {
        ctx.next[symbols.context].setSegment(segment)
        promSegment = segment
      }

      let ret = null
      try {
        ret = agent.tracer.bindFunction(fn, promSegment, true).apply(this, arguments)
      } finally {
        if (ret && typeof ret.then === 'function') {
          ret = ctx.next[symbols.context].continue(ret)
        }
      }
      return ret
    }
  }

  /**
   * Creates a wrapper around the static `Promise` factory method.
   *
   * @param {Function} cast reference of function to wrap
   * @param {string} name name of the function being wrapped
   * @returns {Function} wrapped function
   */
  function wrapCast(cast, name) {
    if (typeof cast !== 'function' || cast.name === '__NR_wrappedCast') {
      return cast
    }

    const CAST_SEGMENT_NAME = 'Promise.' + name
    // eslint-disable-next-line camelcase
    return function __NR_wrappedCast() {
      const segment = _createSegment(CAST_SEGMENT_NAME)
      const prom = cast.apply(this, arguments)
      if (segment) {
        Contextualizer.link(null, prom, segment)
      }
      return prom
    }
  }

  /**
   * Creates a segment for a given handler in promise chain
   * if `config.feature_flag.promise_segments` is true
   * Otherwise it just returns the current if existing or gets the current
   *
   * @param {string} name name of segment to create
   * @param {object} parent current parent segment
   * @returns {object} segment
   */
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
