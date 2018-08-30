'use strict'

const logger = require('../logger').child({component: 'PromiseShim'})
const Shim = require('./shim')

/**
 * A helper class for wrapping promise modules.
 *
 * @extends Shim
 */
class PromiseShim extends Shim {
  /**
   * Constructs a shim associated with the given agent instance, specialized for
   * instrumenting promise libraries.
   *
   * @param {Agent} agent
   *  The agent this shim will use.
   *
   * @param {string} moduleName
   *  The name of the module being instrumented.
   *
   * @param {string} resolvedName
   *  The full path to the loaded module.
   *
   * @see Shim
   */
  constructor(agent, moduleName, resolvedName) {
    super(agent, moduleName, resolvedName)
    this._logger = logger.child({module: moduleName})
    this._class = null
  }

  /**
   * Grants access to the `Contextualizer` class used by the `PromiseShim` to
   * propagate context down promise chains.
   *
   * @private
   */
  static get Contextualizer() {
    return Contextualizer
  }

  /**
   * Sets the class used to indentify promises from the wrapped promise library.
   *
   * @param {function} clss - The promise library's class.
   */
  setClass(clss) {
    this._class = clss
  }

  /**
   * Checks if the given object is an instance of a promise from the promise
   * library being wrapped.
   *
   * @param {*} obj - The object to check the instance type of.
   *
   * @return {bool} True if the provided object is an instance of a promise from
   *  this promise library.
   *
   * @see PromiseShim#setClass
   */
  isPromiseInstance(obj) {
    return !!this._class && obj instanceof this._class
  }

  /**
   * Wraps the given properties as constructors for the promise library.
   *
   * - `wrapConstructor(nodule, properties)`
   * - `wrapConstructor(func)`
   *
   * It is only necessary to wrap the constructor for the class if there is no
   * other way to access the executor function. Some libraries expose a separate
   * method which is called to execute the executor. If that is available, it is
   * better to wrap that using {@link PromiseShim#wrapExecutorCaller} than to
   * use this method.
   *
   * @param {object|function} nodule
   *  The source of the properties to wrap, or a single function to wrap.
   *
   * @param {string|array.<string>} [properties]
   *  One or more properties to wrap. If omitted, the `nodule` parameter is
   *  assumed to be the constructor to wrap.
   *
   * @return {object|function} The first parameter to this function, after
   *  wrapping it or its properties.
   *
   * @see PromiseShim#wrapExecutorCaller
   */
  wrapConstructor(nodule, properties) {
    return this.wrapClass(nodule, properties, {
      pre: function prePromise(shim, Promise, name, args) {
        // We are expecting one function argument for executor, anything else is
        // non-standard, do not attempt to wrap. Also do not attempt to wrap if
        // we are not in a transaction.
        if (args.length !== 1 || !shim.isFunction(args[0]) || !shim.getActiveSegment()) {
          return
        }
        _wrapExecutorContext(shim, args)
      },
      post: function postPromise(shim, Promise, name, args) {
        // This extra property is added by `_wrapExecutorContext` in the pre step.
        const executor = args[0]
        const context = executor && executor.__NR_executorContext
        if (!context || !shim.isFunction(context.executor)) {
          return
        }

        context.promise = this
        Contextualizer.link(null, this, shim.getSegment())
        try {
          // Must run after promise is defined so that `__NR_wrapper` can be set.
          context.executor.apply(context.self, context.args)
        } catch (e) {
          const reject = context.args[1]
          reject(e)
        }
      }
    })
  }

  /**
   * Wraps the given properties as the caller of promise executors.
   *
   * - `wrapExecutorCaller(nodule, properties)`
   * - `wrapExecutorCaller(func)`
   *
   * Wrapping the executor caller method directly is preferable to wrapping
   * the constructor of the promise class.
   *
   * @param {object|function} nodule
   *  The source of the properties to wrap, or a single function to wrap.
   *
   * @param {string|array.<string>} [properties]
   *  One or more properties to wrap. If omitted, the `nodule` parameter is
   *  assumed to be the function to wrap.
   *
   * @return {object|function} The first parameter to this function, after
   *  wrapping it or its properties.
   *
   * @see PromiseShim#wrapConstructor
   */
  wrapExecutorCaller(nodule, properties) {
    return this.wrap(nodule, properties, function executorWrapper(shim, caller) {
      if (!shim.isFunction(caller) || shim.isWrapped(caller)) {
        return
      }

      return function wrappedExecutorCaller(executor) {
        var parent = shim.getActiveSegment()
        if (!this || !parent) {
          return caller.apply(this, arguments)
        }

        if (!this.__NR_context) {
          Contextualizer.link(null, this, parent)
        }

        const args = shim.argsToArray.apply(shim, arguments)
        _wrapExecutorContext(shim, args)
        const ret = caller.apply(this, args)
        const context = args[0].__NR_executorContext
        context.promise = this

        // Bluebird catches executor errors and auto-rejects when it catches them,
        // thus we need to do so as well.
        //
        // When adding new libraries, make sure to check that they behave the same
        // way. We may need to enhance the promise spec to handle this variance.
        try {
          executor.apply(context.self, context.args)
        } catch (e) {
          const reject = context.args[1]
          reject(e)
        }
        return ret
      }
    })
  }

  /**
   * Wraps the given properties as methods which take is some value other than
   * a function to call and return a promise.
   *
   * - `wrapCast(nodule, properties)`
   * - `wrapCast(func)`
   *
   * Examples of promise cast methods include `Promise.resolve`, `Promise.all`,
   * and Bluebird's `Promise.delay`. These are static methods which accept some
   * arbitrary value and return a Promise instance.
   *
   * @param {object|function} nodule
   *  The source of the properties to wrap, or a single function to wrap.
   *
   * @param {string|array.<string>} [properties]
   *  One or more properties to wrap. If omitted, the `nodule` parameter is
   *  assumed to be the function to wrap.
   *
   * @return {object|function} The first parameter to this function, after
   *  wrapping it or its properties.
   */
  wrapCast(nodule, properties) {
    return this.wrap(nodule, properties, function castWrapper(shim, cast) {
      if (!shim.isFunction(cast) || shim.isWrapped(cast)) {
        return
      }

      return function __NR_wrappedCast() {
        const segment = shim.getSegment()
        const prom = cast.apply(this, arguments)
        if (segment) {
          Contextualizer.link(null, prom, segment)
        }
        return prom
      }
    })
  }

  /**
   * Wraps the given properties as promise chaining methods.
   *
   * - `wrapThen(nodule, properties)`
   * - `wrapThen(func)`
   *
   * NOTE: You must set class used by the library before wrapping then-methods.
   *
   * Examples of promise then methods include `Promise#then`, `Promise#finally`,
   * and Bluebird's `Promise#map`. These are methods which take a function to
   * execute once the promise resolves and hands back a new promise.
   *
   * @param {object|function} nodule
   *  The source of the properties to wrap, or a single function to wrap.
   *
   * @param {string|array.<string>} [properties]
   *  One or more properties to wrap. If omitted, the `nodule` parameter is
   *  assumed to be the function to wrap.
   *
   * @return {object|function} The first parameter to this function, after
   *  wrapping it or its properties.
   *
   * @see PromiseShim#setClass
   * @see PromiseShim#wrapCatch
   */
  wrapThen(nodule, properties) {
    return this.wrap(nodule, properties, _wrapThen, [true])
  }

  /**
   * Wraps the given properties as rejected promise chaining methods.
   *
   * - `wrapCatch(nodule, properties)`
   * - `wrapCatch(func)`
   *
   * NOTE: You must set class used by the library before wrapping catch-methods.
   *
   * Promise catch methods differ from then methods in that only one function
   * will be executed and only if the promise is rejected. Some libraries accept
   * an additional argument to `Promise#catch` which is usually an error class
   * to filter rejections by. This wrap method will handle that case.
   *
   * @param {object|function} nodule
   *  The source of the properties to wrap, or a single function to wrap.
   *
   * @param {string|array.<string>} [properties]
   *  One or more properties to wrap. If omitted, the `nodule` parameter is
   *  assumed to be the function to wrap.
   *
   * @return {object|function} The first parameter to this function, after
   *  wrapping it or its properties.
   *
   * @see PromiseShim#setClass
   * @see PromiseShim#wrapThen
   */
  wrapCatch(nodule, properties) {
    return this.wrap(nodule, properties, _wrapThen, [false])
  }

  /**
   * Wraps the given properties as callback-to-promise conversion methods.
   *
   * - `wrapPromisify(nodule, properties)`
   * - `wrapPromisify(func)`
   *
   * @param {object|function} nodule
   *  The source of the properties to wrap, or a single function to wrap.
   *
   * @param {string|array.<string>} [properties]
   *  One or more properties to wrap. If omitted, the `nodule` parameter is
   *  assumed to be the function to wrap.
   *
   * @return {object|function} The first parameter to this function, after
   *  wrapping it or its properties.
   */
  wrapPromisify(nodule, properties) {
    return this.wrap(nodule, properties, function promisifyWrapper(shim, promisify) {
      if (!shim.isFunction(promisify) || shim.isWrapped(promisify)) {
        return
      }

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
          const segment = shim.getActiveSegment()
          if (!segment) {
            return promisified.apply(this, arguments)
          }

          const prom = shim.applySegment(promisified, segment, true, this, arguments)
          Contextualizer.link(null, prom, segment)
          return prom
        }
      }
    })
  }
}
module.exports = PromiseShim

// -------------------------------------------------------------------------- //

/**
 * @private
 */
function _wrapExecutorContext(shim, args) {
  const context = {
    executor: args[0],
    promise: null,
    self: null,
    args: null
  }
  contextExporter.__NR_executorContext = context
  args[0] = contextExporter

  function contextExporter(resolve, reject) {
    context.self = this
    context.args = shim.argsToArray.apply(shim, arguments)
    context.args[0] = _wrapResolver(context, resolve)
    context.args[1] = _wrapResolver(context, reject)
  }
}

/**
 * @private
 */
function _wrapResolver(context, fn) {
  return function wrappedResolveReject(val) {
    const promise = context.promise
    if (promise && promise.__NR_context) {
      promise.__NR_context.getSegment().touch()
    }
    fn(val)
  }
}

/**
 * @private
 */
function _wrapThen(shim, fn, name, useAllParams) {
  // Don't wrap non-functions.
  if (shim.isWrapped(fn) || !shim.isFunction(fn)) {
    return
  }

  return function __NR_wrappedThen() {
    if (!(this instanceof shim._class)) {
      return fn.apply(this, arguments)
    }

    const thenSegment = shim.getSegment()
    const promise = this

    // Wrap up the arguments and execute the real then.
    let isWrapped = false
    const args = new Array(arguments.length)
    for (let i = 0; i < arguments.length; ++i) {
      args[i] = wrapHandler(arguments[i], i, arguments.length)
    }
    const next = fn.apply(this, args)

    // If we got a promise (which we should have), link the parent's context.
    if (!isWrapped && next instanceof shim._class && next !== promise) {
      Contextualizer.link(promise, next, thenSegment)
    }
    return next

    function wrapHandler(handler, i, length) {
      if (
        !shim.isFunction(handler) ||          // Not a function
        shim.isWrapped(handler)   ||          // Already wrapped
        (!useAllParams && i !== (length - 1)) // Don't want all and not last
      ) {
        isWrapped = shim.isWrapped(handler)
        return handler
      }

      return function __NR_wrappedThenHandler() {
        if (!next || !next.__NR_context) {
          return handler.apply(this, arguments)
        }

        let promSegment = next.__NR_context.getSegment()
        const segment = promSegment || shim.getSegment()
        if (segment && segment !== promSegment) {
          next.__NR_context.setSegment(segment)
          promSegment = segment
        }

        let ret = null
        try {
          ret = shim.applySegment(handler, promSegment, true, this, arguments)
        } finally {
          if (ret && typeof ret.then === 'function') {
            ret = next.__NR_context.continueContext(ret)
          }
        }
        return ret
      }
    }
  }
}

/**
 * @private
 */
class Context {
  constructor(segment) {
    this.segments = [segment]
  }

  branch() {
    return this.segments.push(null) - 1
  }
}

/**
 * @private
 */
class Contextualizer {
  constructor(idx, context) {
    this.parentIdx = -1
    this.idx = idx
    this.context = context
    this.child = null
  }

  static link(prev, next, segment) {
    let ctxlzr = prev && prev.__NR_context
    if (ctxlzr && !ctxlzr.isActive()) {
      ctxlzr = prev.__NR_context = null
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
      next.__NR_context = new Contextualizer(idx, ctxlzr.context)
      next.__NR_context.parentIdx = ctxlzr.idx

      // If this was our first child, remember it in case we have a 2nd.
      if (ctxlzr.child === null) {
        ctxlzr.child = next.__NR_context
      }
    } else if (segment) {
      // This next promise is the root of a chain. Either there was no previous
      // promise or the promise was created out of context.
      next.__NR_context = new Contextualizer(0, new Context(segment))
    }
  }

  isActive() {
    const segments = this.context.segments
    const segment = segments[this.idx] || segments[this.parentIdx] || segments[0]
    return segment && segment.transaction.isActive()
  }

  getSegment() {
    const segments = this.context.segments
    let segment = segments[this.idx]
    if (segment == null) {
      segment = segments[this.idx] = segments[this.parentIdx] || segments[0]
    }
    return segment
  }

  setSegment(segment) {
    return this.context.segments[this.idx] = segment
  }

  toJSON() {
    // No-op.
  }

  continueContext(prom) {
    const self = this
    const nextContext = prom.__NR_context
    if (!nextContext) {
      return prom
    }

    // If we have `finally`, use that to sneak our context update.
    if (typeof prom.finally === 'function') {
      return prom.finally(__NR_continueContext)
    }

    // No `finally` means we need to hook into resolve and reject individually and
    // pass through whatever happened.
    return prom.then(function __NR_thenContext(val) {
      __NR_continueContext()
      return val
    }, function __NR_catchContext(err) {
      __NR_continueContext()
      throw err // Re-throwing promise rejection, this is not New Relic's error.
    })

    function __NR_continueContext() {
      self.setSegment(nextContext.getSegment())
    }
  }
}
