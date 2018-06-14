'use strict'

const logger = require('../logger').child({component: 'PromiseShim'})
const Shim = require('./shim')

class PromiseShim extends Shim {
  constructor(agent, moduleName, resolvedName) {
    super(agent, moduleName, resolvedName)
    this._logger = logger.child({module: moduleName})
    this._class = null
  }

  static get Contextualizer() {
    return Contextualizer
  }

  setClass(clss) {
    this._class = clss
  }

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
        if (!context || !shim.isFunction(executor)) {
          return
        }

        context.promise = this
        Contextualizer.link(null, this, shim.getSegment())
        try {
          // Must run after promise is defined so that `__NR_wrapper` can be set.
          executor.apply(context.self, context.args)
        } catch (e) {
          context.args[1](e)
        }
      }
    })
  }

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
          context.args[1](e)
        }
        return ret
      }
    })
  }

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

  wrapThen(nodule, properties) {
    return this.wrap(nodule, properties, _wrapThen, [true])
  }

  wrapCatch(nodule, properties) {
    return this.wrap(nodule, properties, _wrapThen, [false])
  }

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
          const segment = shim.getSegment()
          const prom = shim.applySegment(promisified, segment, true, this, arguments)

          if (segment) {
            Contextualizer.link(null, prom, segment)
          }

          return prom
        }
      }
    })
  }
}

function _wrapExecutorContext(shim, args) {
  const context = {
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

function _wrapResolver(context, fn) {
  return function wrappedResolveReject(val) {
    const promise = context.promise
    if (promise && promise.__NR_context) {
      promise.__NR_context.getSegment().touch()
    }
    fn(val)
  }
}

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

module.exports = PromiseShim

class Context {
  constructor(segment) {
    this.segments = [segment]
  }

  branch() {
    return this.segments.push(null) - 1
  }
}

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
