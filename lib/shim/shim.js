/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const arity = require('../util/arity')
const hasOwnProperty = require('../util/properties').hasOwn
const logger = require('../logger').child({ component: 'Shim' })
const path = require('path')
const specs = require('./specs')
const util = require('util')
const symbols = require('../symbols')
const { addCLMAttributes: maybeAddCLMAttributes } = require('../util/code-level-metrics')
const { makeId } = require('../util/hashes')
const { isBuiltin } = require('module')
const TraceSegment = require('../transaction/trace/segment')

// Some modules do terrible things, like change the prototype of functions. To
// avoid crashing things we'll use a cached copy of apply everywhere.
const fnApply = Function.prototype.apply

/**
 * Constructs a shim associated with the given agent instance.
 *
 * @class
 * @classdesc A helper class for wrapping modules with segments.
 * @param {Agent}   agent         - The agent this shim will use.
 * @param {string}  moduleName    - The name of the module being instrumented.
 * @param {string}  resolvedName  - The full path to the loaded module.
 * @param {string}  shimName      - Used to persist shim ids across different instances. This is
 * @param {string} pkgVersion     - version of package getting instrumented
 * applicable to instrument that compliments each other across libraries(i.e - koa + koa-route/koa-router)
 */
function Shim(agent, moduleName, resolvedName, shimName, pkgVersion) {
  if (!agent || !moduleName) {
    throw new Error('Shim must be initialized with an agent and module name.')
  }

  this._logger = logger.child({ module: moduleName })
  this._agent = agent
  this._toExport = null
  this._debug = false
  this.defineProperty(this, 'moduleName', moduleName)
  this.assignId(shimName)
  this.pkgVersion = pkgVersion

  // Used in `shim.require`
  // If this is a built-in the root is set as `.`
  this._moduleRoot = isBuiltin(resolvedName || moduleName) ? '.' : resolvedName
}
module.exports = Shim

Shim.defineProperty = defineProperty
Shim.defineProperties = defineProperties

// Copy the argument index enumeration onto the shim.
Shim.prototype.ARG_INDEXES = specs.ARG_INDEXES
defineProperties(Shim.prototype, specs.ARG_INDEXES)

// Define other miscellaneous properties of the shim.
defineProperties(Shim.prototype, {
  /**
   * The agent associated with this shim.
   *
   * @readonly
   * @member {Agent} Shim.prototype.agent
   * @returns {Agent} The instance of the agent.
   */
  agent: function getAgent() {
    return this._agent
  },

  /**
   * The transaction tracer in use by the agent for the shim.
   *
   * @readonly
   * @member {Tracer} Shim.prototype.tracer
   * @returns {Tracer} The agent's instance of the tracer
   */
  tracer: function getTracer() {
    return this._agent.tracer
  },

  /**
   * The logger for this shim.
   *
   * @readonly
   * @member {Logger} Shim.prototype.logger
   * @returns {Logger} The logger.
   */
  logger: function getLogger() {
    return this._logger
  }
})

Shim.prototype.wrap = wrap
Shim.prototype.bindSegment = bindSegment
Shim.prototype.bindContext = bindContext
Shim.prototype.bindPromise = bindPromise

Shim.prototype.execute = execute
Shim.prototype.wrapReturn = wrapReturn
Shim.prototype.wrapClass = wrapClass
Shim.prototype.wrapExport = wrapExport
Shim.prototype.record = record
Shim.prototype.isWrapped = isWrapped
Shim.prototype.unwrap = unwrap
Shim.prototype.unwrapOnce = unwrap
Shim.prototype.getOriginal = getOriginal
Shim.prototype.getOriginalOnce = getOriginalOnce
Shim.prototype.assignOriginal = assignOriginal
Shim.prototype.getSegment = getSegment
Shim.prototype.getActiveSegment = getActiveSegment
Shim.prototype.setActiveSegment = setActiveSegment
Shim.prototype.storeSegment = storeSegment
Shim.prototype.bindCallbackSegment = bindCallbackSegment
Shim.prototype.applySegment = applySegment
Shim.prototype.applyContext = applyContext
Shim.prototype.createSegment = createSegment
Shim.prototype.getName = getName
Shim.prototype.isObject = isObject
Shim.prototype.isFunction = isFunction
Shim.prototype.isPromise = isPromise
Shim.prototype.isAsyncFunction = isAsyncFunction
Shim.prototype.isString = isString
Shim.prototype.isNumber = isNumber
Shim.prototype.isBoolean = isBoolean
Shim.prototype.isArray = isArray
Shim.prototype.isNull = isNull
Shim.prototype.toArray = toArray
Shim.prototype.argsToArray = argsToArray
Shim.prototype.normalizeIndex = normalizeIndex
Shim.prototype.once = once

Shim.prototype.defineProperty = defineProperty
Shim.prototype.defineProperties = defineProperties
Shim.prototype.setDefaults = setDefaults
Shim.prototype.proxy = proxy
Shim.prototype.require = shimRequire
Shim.prototype.copySegmentParameters = copySegmentParameters
Shim.prototype.prefixRouteParameters = prefixRouteParameters
Shim.prototype.interceptPromise = interceptPromise
Shim.prototype.fixArity = arity.fixArity
Shim.prototype.assignId = assignId
Shim.prototype.specs = specs

// Internal methods.
Shim.prototype.getExport = getExport
Shim.prototype.enableDebug = enableDebug
Shim.prototype[symbols.unwrap] = unwrapAll

// -------------------------------------------------------------------------- //

/**
 * @callback WrapFunction
 * @summary
 *  A function which performs the actual wrapping logic.
 * @description
 *  If the return value of this function is not `original` then the return value
 *  will be marked as a wrapper.
 * @param {Shim} shim
 *  The shim this function was passed to.
 * @param {object|Function} original
 *  The item which needs wrapping. Most of the time this will be a function.
 * @param {string} name
 *  The name of `original` if it can be determined, otherwise `'<anonymous>'`.
 * @returns {*} The wrapper for the original, or the original value itself.
 */

/**
 * @private
 * @callback ArrayWrapFunction
 * @description
 *   A wrap function used on elements of an array. In addition to the parameters
 *   of `WrapFunction`, these also receive an `index` and `total` as described
 *   below.
 * @see WrapFunction
 * @param {number} index - The index of the current element in the array.
 * @param {number} total - The total number of items in the array.
 */

/**
 * @private
 * @callback ArgumentsFunction
 * @param {Shim} shim
 *  The shim this function was passed to.
 * @param {Function} func
 *  The function these arguments were passed to.
 * @param {*} context
 *  The context the function is executing under (i.e. `this`).
 * @param {Array.<*>} args
 *  The arguments being passed into the function.
 */

/**
 * @callback SegmentFunction
 * @summary
 *  A function which is called to compose a segment.
 * @param {Shim} shim
 *  The shim this function was passed to.
 * @param {Function} func
 *  The function the segment is created for.
 * @param {string} name
 *  The name of the function.
 * @param {Array.<*>} args
 *  The arguments being passed into the function.
 * @returns {string|SegmentSpec} The desired properties for the new segment.
 */

/**
 * @callback RecorderFunction
 * @summary
 *  A function which is called to compose a segment for recording.
 * @param {Shim} shim
 *  The shim this function was passed to.
 * @param {Function} func
 *  The function being recorded.
 * @param {string} name
 *  The name of the function.
 * @param {Array.<*>} args
 *  The arguments being passed into the function.
 * @returns {string|RecorderSpec} The desired properties for the new segment.
 */

/**
 * @callback CallbackBindFunction
 * @summary
 *  Performs segment binding on a callback function. Useful when identifying a
 *  callback is more complex than a simple argument offset.
 * @param {Shim} shim
 *  The shim this function was passed to.
 * @param {Function} func
 *  The function being recorded.
 * @param {string} name
 *  The name of the function.
 * @param {TraceSegment} segment
 *  The segment that the callback should be bound to.
 * @param {Array.<*>} args
 *  The arguments being passed into the function.
 */

/**
 * Measures all the necessary metrics for the given segment. This functionality
 * is meant to be used by Shim subclasses; instrumentations should never create
 * their own recorders.
 *
 * @private
 * @callback MetricFunction
 * @param {TraceSegment}  segment - The segment to record.
 * @param {string}        [scope] - The scope of the recording.
 */

// -------------------------------------------------------------------------- //

/**
 * Entry point for executing a spec.
 *
 * @param {object|Function} nodule Class or module containing the function to wrap.
 * @param {Spec} spec {@link Spec}
 * @memberof Shim.prototype
 */
function execute(nodule, spec) {
  if (this.isFunction(spec)) {
    spec(this, nodule)
  } else {
    _specToFunction(spec)
  }
}

/**
 * Executes the provided spec on one or more objects.
 *
 * - `wrap(nodule, properties, spec [, args])`
 * - `wrap(func, spec [, args])`
 *
 * When called with a `nodule` and one or more properties, the spec will be
 * executed on each property listed and the return value put back on the
 * `nodule`.
 *
 * When called with just a function, the spec will be executed on the function
 * and the return value of the spec simply passed back.
 *
 * The wrapped version will have the same prototype as the original
 * method.
 *
 * @memberof Shim.prototype
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 * @param {Spec|WrapFunction} spec
 *  The spec for wrapping these items.
 * @param {Array.<*>} [args]
 *  Optional extra arguments to be sent to the spec when executing it.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
 * @see WrapFunction
 */
function wrap(nodule, properties, spec, args) {
  if (!nodule) {
    this.logger.debug('Not wrapping non-existent nodule.')
    return nodule
  }

  // Sort out the parameters.
  if (this.isObject(properties) && !this.isArray(properties)) {
    // wrap(nodule, spec [, args])
    args = spec
    spec = properties
    properties = null
  }
  if (this.isFunction(spec)) {
    // wrap(nodule [, properties], wrapper [, args])
    spec = new specs.WrapSpec({
      wrapper: spec
    })
  }

  // If we're just wrapping one thing, just wrap it and return.
  if (properties == null) {
    const name = this.getName(nodule)
    this.logger.trace('Wrapping nodule itself (%s).', name)
    return _wrap(this, nodule, name, spec, args)
  }

  // Coerce properties into an array.
  if (!this.isArray(properties)) {
    properties = [properties]
  }

  // Wrap each property and return the nodule.
  this.logger.trace('Wrapping %d properties on nodule.', properties.length)
  for (const prop of properties) {
    // Skip nonexistent properties.
    const original = nodule[prop]
    if (!original) {
      this.logger.debug('Not wrapping missing property "%s"', prop)
      continue
    }

    // Wrap up the property and add a special unwrapper.
    const wrapped = _wrap(this, original, prop, spec, args)
    if (wrapped && wrapped !== original) {
      this.logger.trace('Replacing "%s" with wrapped version', prop)

      nodule[prop] = wrapped
      wrapped[symbols.unwrap] = function unwrapWrap() {
        nodule[prop] = original
        return original
      }
    }
  }
  return nodule
}

/**
 * Executes the provided spec with the return value of the given properties.
 *
 * - `wrapReturn(nodule, properties, spec [, args])`
 * - `wrapReturn(func, spec [, args])`
 *
 * If the wrapper is executed with `new` then the wrapped function will also be
 * called with `new`. This feature should only be used with factory methods
 * disguised as classes. Normally {@link Shim#wrapClass} should be used to wrap
 * constructors instead.
 *
 * @memberof Shim.prototype
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 * @param {Spec|Function} spec
 *  The spec for wrapping the returned value from the properties.
 * @param {Array.<*>} [args]
 *  Optional extra arguments to be sent to the spec when executing it.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
 * @see Shim#wrap
 */
function wrapReturn(nodule, properties, spec, args) {
  // Munge our parameters as needed.
  if (this.isObject(properties) && !this.isArray(properties)) {
    // wrapReturn(nodule, spec [, args])
    args = spec
    spec = properties
    properties = null
  }
  if (!this.isFunction(spec)) {
    _specToFunction(spec)
  }
  if (!this.isArray(args)) {
    args = []
  }

  // Perform the wrapping!
  return this.wrap(nodule, properties, function returnWrapper(shim, fn, fnName) {
    // Only functions can have return values for us to wrap.
    if (!shim.isFunction(fn)) {
      return fn
    }

    return wrapInProxy({ fn, fnName, shim, args, spec })
  })
}

/**
 * Wraps a function in a proxy with various handlers
 *
 * @private
 * @param {object} params to function
 * @param {Function} params.fn function to wrap in Proxy(return of function invocation)
 * @param {string} params.fnName name of function
 * @param {Shim} params.shim instance of shim
 * @param {Array} params.args args to original caller function
 * @param {Spec} params.spec the spec for wrapping the returned value
 * @returns {Proxy} proxied return function
 */
function wrapInProxy({ fn, fnName, shim, args, spec }) {
  let unwrapReference = null

  const handler = {
    get: function getTrap(target, prop) {
      // The wrapped symbol only lives on proxy
      // not the proxied item.
      if (prop === symbols.wrapped) {
        return this[prop]
      }
      // Allow for look up of the target
      if (prop === symbols.original) {
        return target
      }
      if (prop === symbols.unwrap) {
        return unwrapReference
      }

      return target[prop]
    },
    defineProperty: function definePropertyTrap(target, key, descriptor) {
      if (key === symbols.unwrap) {
        unwrapReference = descriptor.value
      } else {
        Object.defineProperty(target, key, descriptor)
      }
      return true
    },
    set: function setTrap(target, key, val) {
      // If we are setting the wrapped symbol on proxy
      // we do not actually want to assign to proxied
      // item but the proxy itself.
      if (key === symbols.wrapped) {
        this[key] = val
      } else if (key === symbols.unwrap) {
        unwrapReference = val
      } else {
        target[key] = val
      }
      return true
    },
    construct: function constructTrap(target, proxyArgs, newTarget) {
      // Call the underlying function via Reflect.
      let ret = Reflect.construct(target, proxyArgs, newTarget)

      // Assemble the arguments to hand to the spec.
      const _args = [shim, fn, fnName, ret]
      if (args.length > 0) {
        _args.push.apply(_args, args)
      }

      // Call the spec and see if it handed back a different return value.
      const newRet = spec.apply(ret, _args)
      if (newRet) {
        ret = newRet
      }

      return ret
    },
    apply: function applyTrap(target, thisArg, proxyArgs) {
      // Call the underlying function. If this was called as a constructor, call
      // the wrapped function as a constructor too.
      let ret = target.apply(thisArg, proxyArgs)

      // Assemble the arguments to hand to the spec.
      const _args = [shim, fn, fnName, ret]
      if (args.length > 0) {
        _args.push.apply(_args, args)
      }

      // Call the spec and see if it handed back a different return value.
      const newRet = spec.apply(thisArg, _args)
      if (newRet) {
        ret = newRet
      }

      return ret
    }
  }

  return new Proxy(fn, handler)
}

/**
 * Wraps a class constructor using a subclass with pre- and post-construction
 * hooks.
 *
 * - `wrapClass(nodule, properties, spec [, args])`
 * - `wrapClass(func, spec [, args])`
 *
 * @memberof Shim.prototype
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the constructor to wrap.
 * @param {ClassWrapSpec|ConstructorHookFunction} spec
 *  The spec for wrapping the returned value from the properties or a post hook.
 * @param {Array.<*>} [args]
 *  Optional extra arguments to be sent to the spec when executing it.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
 * @see Shim#wrap
 */
function wrapClass(nodule, properties, spec, args) {
  // Munge our parameters as needed.
  if (this.isObject(properties) && !this.isArray(properties)) {
    // wrapReturn(nodule, spec [, args])
    args = spec
    spec = properties
    properties = null
  }

  if (!this.isArray(args)) {
    args = []
  }

  // Perform the wrapping!
  return this.wrap(nodule, properties, function classWrapper(shim, Base, fnName) {
    // Only functions can have return values for us to wrap.
    if (!shim.isFunction(Base) || shim.isWrapped(Base)) {
      return Base
    }

    // When es6 classes are being wrapped, we need to use an es6 class due to
    // the fact our es5 wrapper depends on calling the constructor without `new`.
    const wrapper = spec.es6 || /^class /.test(Base.toString()) ? _es6WrapClass : _es5WrapClass

    return wrapper(shim, Base, fnName, spec, args)
  })
}

/**
 * Wraps the actual module being instrumented to change what `require` returns.
 *
 * - `wrapExport(nodule, spec)`
 *
 * @memberof Shim.prototype
 * @param {*} nodule
 *  The original export to replace with our new one.
 * @param {WrapFunction} spec
 *  A wrapper function. The return value from this spec is what will replace
 *  the export.
 * @returns {*} The return value from `spec`.
 */
function wrapExport(nodule, spec) {
  if (nodule[symbols.nrEsmProxy] === true) {
    // A CJS module has been imported as ESM through import-in-the-middle. This
    // means that `nodule` is set to an instance of our proxy. What we actually
    // want is the thing to be instrumented. We assume it is the "default"
    // export.
    nodule = nodule.default
  }
  this._toExport = this.wrap(nodule, null, spec)
  return this._toExport
}

/**
 * If the export was wrapped, that wrapper is returned, otherwise `defaultExport`.
 *
 * @private
 * @memberof Shim.prototype
 * @param {*} defaultExport - The original export in case it was never wrapped.
 * @returns {*} The result from calling {@link Shim#wrapExport} or `defaultExport`
 *  if it was never used.
 * @see Shim.wrapExport
 */
function getExport(defaultExport) {
  return this._toExport || defaultExport
}

/**
 * Determines if the specified function or property exists and is wrapped.
 *
 * - `isWrapped(nodule, property)`
 * - `isWrapped(func)`
 *
 * @memberof Shim.prototype
 * @param {object | Function} nodule
 *  The source for the property or a single function to check.
 * @param {string} [property]
 *  The property to check. If omitted, the `nodule` parameter is assumed to be
 *  the function to check.
 * @returns {boolean} True if the item exists and has been wrapped.
 * @see Shim#wrap
 * @see Shim#bindSegment
 */
function isWrapped(nodule, property) {
  if (property) {
    return nodule?.[property]?.[symbols.wrapped] === this.id
  }
  return nodule?.[symbols.wrapped] === this.id
}

/**
 * Wraps a function with segment creation and binding.
 *
 * - `record(nodule, properties, recordNamer)`
 * - `record(func, recordNamer)`
 *
 * This is shorthand for calling {@link Shim#wrap} and manually creating a segment.
 *
 * @memberof Shim.prototype
 * @param {object | Function} nodule
 *  The source for the properties to record, or a single function to record.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to record. If omitted, the `nodule` parameter is
 *  assumed to be the function to record.
 * @param {RecorderFunction} recordNamer
 *  A function which returns a record descriptor that gives the name and type of
 *  record we'll make.
 * @returns {object | Function} The first parameter, possibly wrapped.
 * @see RecorderFunction
 * @see RecorderSpec
 * @see Shim#wrap
 */
function record(nodule, properties, recordNamer) {
  if (this.isFunction(properties)) {
    recordNamer = properties
    properties = null
  }

  return this.wrap(nodule, properties, function makeWrapper(shim, fn, name) {
    // Can't record things that aren't functions.
    if (!shim.isFunction(fn)) {
      shim.logger.debug('Not recording non-function "%s".', name)
      return fn
    }
    shim.logger.trace('Wrapping "%s" with metric recording.', name)

    return recordWrapper({ shim, fn, name, recordNamer })
  })
}

/**
 * Wrapped function for Shim.prototype.record
 * This creates a segment for the method being recorded
 *
 * @private
 * @param {object} params to function
 * @param {Shim} params.shim instance of shim
 * @param {Function} params.fn function being wrapped/recorded
 * @param {string} params.name name of function
 * @param {RecorderFunction} params.recordNamer
 *  A function which returns a record descriptor that gives the name and type of
 *  record we'll make.
 *  @returns {Function} wrapped function
 */
function recordWrapper({ shim, fn, name, recordNamer }) {
  return function wrapper(...args) {
    // Create the segment that will be recorded.
    const spec = recordNamer.call(this, shim, fn, name, args)
    if (!spec) {
      shim.logger.trace('No segment descriptor for "%s", not recording.', name)
      return fnApply.call(fn, this, args)
    }

    // middleware recorders pass in parent segment
    // we need to destructure this as it is not needed past this function
    // and will overwhelm trace level loggers with logging the entire spec
    const { parent: specParent, ...segDesc } = spec

    const context = shim.tracer.getContext()
    const transaction = context.transaction
    const parent = transaction?.isActive() && specParent ? specParent : context.segment

    if (!transaction?.isActive() || !parent) {
      shim.logger.debug('Not recording function %s, not in a transaction.', name)
      return fnApply.call(fn, this, args)
    }

    if (segDesc.callbackRequired && !_hasValidCallbackArg(shim, args, segDesc.callback)) {
      return fnApply.call(fn, this, args)
    }

    // Only create a segment if:
    //  - We are _not_ making an internal segment.
    //  - OR the parent segment is either not internal or not from this shim.
    const shouldCreateSegment = !(
      parent.opaque ||
      (segDesc.internal && parent.internal && shim.id === parent.shimId)
    )

    const segment = shouldCreateSegment
      ? _rawCreateSegment({ shim, spec: segDesc, parent, transaction })
      : parent

    const newContext = context.enterSegment({ segment })
    maybeAddCLMAttributes(fn, segment)

    return _doRecord.call(this, {
      context: newContext,
      args,
      segDesc,
      shouldCreateSegment,
      shim,
      fn,
      name
    })
  }
}

/**
 * Check if the argument defined as callback is an actual function
 *
 * @private
 * @param {Shim} shim An instance of the shim class
 * @param {Array} args The arguments to the wrapped function
 * @param {Function} specCallback Optional callback argument received from the spec
 * @returns {boolean} Whether the spec ha a valid callback argument
 */
function _hasValidCallbackArg(shim, args, specCallback) {
  if (shim.isNumber(specCallback)) {
    const cbIdx = normalizeIndex(args.length, specCallback)
    if (cbIdx === null) {
      return false
    }

    const callback = args[cbIdx]
    return shim.isFunction(callback)
  }

  return true
}

/**
 * Binds all callbacks, streams and/or returned promises to the active segment of function being wrapped.
 *
 * @private
 * @param {object} params to function
 * @param {Array} params.args The arguments to the wrapped callback
 * @param {Spec} params.segDesc Segment descriptor spec
 * @param {boolean} params.shouldCreateSegment Whether the recorder should create a segment
 * @param {Shim} params.shim instance of shim
 * @param {Function} params.fn function being wrapped
 * @param {Context} params.context agent context to run in
 * @param {string} params.name name of function being wrapped
 * @returns {shim|promise} Returns a shim or promise with recorder segment and
 * bound callbacks, if applicable
 */
function _doRecord({ context, args, segDesc, shouldCreateSegment, shim, fn, name }) {
  const { segment } = context
  // Now bind any callbacks specified in the segment descriptor.
  _bindAllCallbacks.call(this, shim, fn, name, args, {
    spec: segDesc,
    segment,
    shouldCreateSegment
  })

  // Apply the function, and (if it returned a stream) bind that too.
  // The reason there is no check for `segment` is because it should
  // be guaranteed by the parent and active transaction check
  // at the beginning of this function.
  let ret = _applyRecorderSegment({
    context,
    boundThis: this,
    args,
    segDesc,
    shim,
    fn,
    name
  })
  if (ret) {
    if (segDesc.stream) {
      shim.logger.trace('Binding return value as stream.')
      _bindStream(shim, ret, segment, {
        event: shim.isString(segDesc.stream) ? segDesc.stream : null,
        shouldCreateSegment
      })
    } else if (segDesc.promise && shim.isPromise(ret)) {
      shim.logger.trace('Binding return value as Promise.')
      ret = shim.bindPromise(ret, segment)
    }
  }
  return ret
}

/**
 * Binds active segment to wrapped function.  Calls the after hook if it exists on spec
 *
 * @private
 * @param {object} params to function
 * @param {Context} params.context agent context to run in
 * @param {Array} params.args The arguments to the wrapped callback
 * @param {Spec} params.segDesc Segment descriptor spec
 * @param {Shim} params.shim instance of shim
 * @param {Function} params.fn function being wrapped
 * @param {*} params.boundThis the function context to run in
 * @param {string} params.name name of function being wrapped
 * @returns {*} return value of wrapped function
 */
function _applyRecorderSegment({ context, boundThis, args, segDesc, shim, fn, name }) {
  const { segment, transaction } = context
  let error = null
  let promised = false
  let ret
  try {
    ret = shim.applyContext({
      func: fn,
      context,
      full: true,
      boundThis,
      args,
      inContextCB: segDesc.inContext
    })
    if (segDesc.after && segDesc.promise && shim.isPromise(ret)) {
      promised = true
      return ret.then(
        function onThen(val) {
          segment.touch()
          // passing in error as some instrumentation checks if it's not equal to `null`
          segDesc.after({ shim, fn, name, error, result: val, segment, transaction })
          return val
        },
        function onCatch(err) {
          segment.touch()
          segDesc.after({ shim, fn, name, error: err, segment, transaction })
          throw err // NOTE: This is not an error from our instrumentation.
        }
      )
    }
    return ret
  } catch (err) {
    error = err
    throw err // Just rethrowing this error, not our error!
  } finally {
    if (segDesc.after && (error || !promised)) {
      segDesc.after({ shim, fn, name, error, result: ret, segment, transaction })
    }
  }
}

/**
 * Unwraps one item, revealing the underlying value. If item is wrapped multiple times,
 * the unwrap will not occur as we cannot safely unwrap.
 *
 * - `unwrap(nodule, property)`
 * - `unwrap(func)`
 *
 * If called with a `nodule` and properties, the unwrapped value will be put
 * back on the nodule. Otherwise, the unwrapped function is just returned.
 *
 * @memberof Shim.prototype
 * @param {object | Function} nodule
 *  The source for the properties to unwrap, or a single function to unwrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to unwrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to unwrap.
 * @returns {object | Function} The first parameter after unwrapping.
 */
function unwrap(nodule, properties) {
  // Don't try to unwrap potentially `null` or `undefined` things.
  if (!nodule) {
    return nodule
  }

  // If we're unwrapping multiple things
  if (this.isArray(properties)) {
    for (const prop of properties) {
      unwrap.call(this, nodule, prop)
    }
    return nodule
  }

  const unwrapObj = properties || '<nodule>'
  this.logger.trace('Unwrapping %s', unwrapObj)
  const original = properties ? nodule[properties] : nodule
  if (!original || (original && !original[symbols.original])) {
    return original
  } else if (original?.[symbols.original]?.[symbols.original]) {
    this.logger.warn(
      'Attempting to unwrap %s, which its unwrapped version is also wrapped. This is unsupported, unwrap will not occur.',
      unwrapObj
    )
    return original
  }
  return this.isFunction(original[symbols.unwrap])
    ? original[symbols.unwrap]()
    : original[symbols.original]
}

/**
 * Retrieves the original method for a wrapped function.
 *
 * - `getOriginal(nodule, property)`
 * - `getOriginal(func)`
 *
 * @memberof Shim.prototype
 * @param {object | Function} nodule
 *  The source of the property to get the original of, or a function to unwrap.
 * @param {string} [property]
 *  A property on `nodule` to get the original value of.
 * @returns {object | Function} The original value for the given item.
 */
function getOriginal(nodule, property) {
  if (!nodule) {
    return nodule
  }

  let original = property ? nodule[property] : nodule
  while (original && original[symbols.original]) {
    original = original[symbols.original]
  }
  return original
}

/**
 * Retrieves the value of symbols.original on the wrapped function.
 * Unlike `getOriginal` this just looks in the direct wrapped function
 *
 * @memberof Shim.prototype
 * @param {object | Function} nodule
 *  The source of the property to get the original of, or a function to unwrap.
 * @param {string} [property]
 *  A property on `nodule` to get the original value of.
 * @returns {object | Function} The original value for the given item.
 */
function getOriginalOnce(nodule, property) {
  if (!nodule) {
    return nodule
  }

  const original = property ? nodule[property] : nodule
  return original[symbols.original]
}

/**
 * Binds the execution of a function to a single segment.
 *
 * - `bindSegment(nodule , property [, segment [, full]])`
 * - `bindSegment(func [, segment [, full]])`
 *
 * If called with a `nodule` and a property, the wrapped property will be put
 * back on the nodule. Otherwise, the wrapped function is just returned.
 *
 * @memberof Shim.prototype
 * @param {object | Function} nodule
 *  The source for the property or a single function to bind to a segment.
 * @param {string} [property]
 *  The property to bind. If omitted, the `nodule` parameter is assumed
 *  to be the function to bind the segment to.
 * @param {?TraceSegment} [segment]
 *  The segment to bind the execution of the function to. If omitted or `null`
 *  the currently active segment will be bound instead.
 * @param {boolean} [full]
 *  Indicates if the full lifetime of the segment is bound to this function.
 * @returns {object | Function} The first parameter after wrapping.
 */
function bindSegment(nodule, property, segment, full) {
  // Don't bind to null arguments.
  if (!nodule) {
    return nodule
  }

  // Determine our arguments.
  if (this.isObject(property) && !this.isArray(property)) {
    // bindSegment(func, segment [, full])
    full = segment
    segment = property
    property = null
  }

  const context = this.tracer.getContext()
  segment = segment || context?.segment
  const newContext = context.enterSegment({ segment })
  return this.bindContext({ nodule, property, context: newContext, full })
}

/**
 *
 * Binds the execution of a function to a context instance.
 * Similar to bindSegment but this requires passing in of an instance of Context.
 * @memberof Shim.prototype
 * @param {object} params to function
 * @param {object | Function} params.nodule
 *  The source for the property or a single function to bind to a segment.
 * @param {string} [params.property]
 *  The property to bind. If omitted, the `nodule` parameter is assumed
 *  to be the function to bind the segment to.
 * @param {Context} [params.context]
 *  The context to bind the execution of the function to.
 * @param {boolean} [params.full]
 *  Indicates if the full lifetime of the segment is bound to this function.
 * @returns {object | Function} The first parameter after wrapping.
 */
function bindContext({ nodule, property, context, full = false }) {
  const { segment } = context
  // Don't bind to null arguments.
  if (!nodule) {
    return nodule
  }

  // This protects against the case where the
  // segment is `null`.
  if (!(segment instanceof TraceSegment)) {
    this.logger.debug({ segment }, 'Segment is not a segment, not binding.')
    return nodule
  }

  return this.wrap(nodule, property, function wrapFunc(shim, func) {
    if (!shim.isFunction(func)) {
      return func
    }

    const binder = _makeBindWrapper(shim, func, context, full)
    shim.storeSegment(binder, segment)
    return binder
  })
}

/**
 * Replaces the callback in an arguments array with one that has been bound to
 * the given segment.
 *
 * - `bindCallbackSegment(spec, args, cbIdx [, segment])`
 * - `bindCallbackSegment(spec, obj, property [, segment])`
 *
 * @memberof Shim.prototype
 * @param {Spec} spec spec to original wrapped function, used to call after method with arguments passed to callback
 * @param {Array | object} args
 *  The arguments array to pull the cb from.
 * @param {number|string} cbIdx
 *  The index of the callback.
 * @param {TraceSegment} [parentSegment]
 *  The segment to use as the callback segment's parent. Defaults to the
 *  currently active segment.
 * @see Shim#bindSegment
 */
function bindCallbackSegment(spec, args, cbIdx, parentSegment) {
  if (!args) {
    return
  }

  if (this.isNumber(cbIdx)) {
    const normalizedCBIdx = normalizeIndex(args.length, cbIdx)
    if (normalizedCBIdx === null) {
      // Bad index.
      this.logger.debug(
        'Invalid index %d for args of length %d, not binding callback segment',
        cbIdx,
        args.length
      )
      return
    }
    cbIdx = normalizedCBIdx
  }

  // Make sure cb is function before wrapping
  if (this.isFunction(args[cbIdx])) {
    wrapCallback({ shim: this, args, cbIdx, parentSegment, spec })
  }
}

/**
 * Wraps the callback and creates a segment for the callback function.
 * It will also call an after hook with the arguments passed to callback
 *
 * @private
 * @param {object} params to function
 * @param {Shim} params.shim instance of shim
 * @param {Array | object} params.args
 *  The arguments array to pull the cb from.
 * @param {number|string} params.cbIdx
 *  The index of the callback.
 * @param {TraceSegment} [params.parentSegment]
 *  The segment to use as the callback segment's parent. Defaults to the
 *  currently active segment.
 * @param {Spec} params.spec spec to original wrapped function, used to call after method with arguments passed to callback
 *
 */
function wrapCallback({ shim, args, cbIdx, parentSegment, spec }) {
  const cb = args[cbIdx]
  const realParent = parentSegment || shim.getSegment()
  const context = shim.tracer.getContext()
  const transaction = context?.transaction

  args[cbIdx] = shim.wrap(cb, null, function callbackWrapper(shim, fn, name) {
    return function wrappedCallback() {
      if (realParent) {
        realParent.opaque = false
      }
      const segment = _rawCreateSegment({
        shim,
        parent: realParent,
        transaction,
        spec: new specs.SegmentSpec({
          name: 'Callback: ' + name
        })
      })

      if (segment) {
        segment.async = false
      }

      if (spec?.after) {
        spec.after({ shim, fn, name, args: arguments, segment: realParent, transaction })
      }

      // CB may end the transaction so update the parent's time preemptively.
      realParent && realParent.touch()
      const newContext = context.enterSegment({ segment })
      return shim.applyContext({
        func: cb,
        context: newContext,
        full: true,
        boundThis: this,
        args: arguments
      })
    }
  })
  shim.storeSegment(args[cbIdx], realParent)
}

/**
 * Retrieves the segment associated with the given object, or the current
 * segment if no object is given.
 *
 * - `getSegment([obj])`
 *
 * @memberof Shim.prototype
 * @param {*} [obj] - The object to retrieve a segment from.
 * @returns {?TraceSegment} The trace segment associated with the given object or
 *  the current segment if no object is provided or no segment is associated
 *  with the object.
 */
function getSegment(obj) {
  if (obj && obj[symbols.segment]) {
    return obj[symbols.segment]
  }

  return this.tracer.getSegment()
}

/**
 * Retrieves the segment associated with the given object, or the currently
 * active segment if no object is given.
 *
 * - `getActiveSegment([obj])`
 *
 * An active segment is one whose transaction is still active (e.g. has not
 * ended yet).
 *
 * @memberof Shim.prototype
 * @param {*} [obj] - The object to retrieve a segment from.
 * @returns {?TraceSegment} The trace segment associated with the given object or
 *  the currently active segment if no object is provided or no segment is
 *  associated with the object.
 */
function getActiveSegment(obj) {
  const segment = this.getSegment(obj)
  const transaction = this.tracer.getTransaction()
  if (transaction?.isActive()) {
    return segment
  }
  return null
}

/**
 * Explicitly sets the active segment to the one passed in. This method
 * should only be used if there is no function to tie a segment's timing
 * to.
 *
 * - `setActiveSegment(segment)`
 *
 * @memberof Shim.prototype
 * @param {TraceSegment} segment - The segment to set as the active segment.
 * @returns {TraceSegment} - The segment set as active on the context.
 */
function setActiveSegment(segment) {
  const transaction = this.tracer.getTransaction()
  this.tracer.setSegment({ segment, transaction })
  return segment
}

/**
 * Associates a segment with the given object.
 *
 * - `storeSegment(obj [, segment])`
 *
 * If no segment is provided, the currently active segment is used.
 *
 * @memberof Shim.prototype
 * @param {!*}            obj       - The object to retrieve a segment from.
 * @param {TraceSegment}  [segment] - The segment to link the object to.
 */
function storeSegment(obj, segment) {
  if (obj) {
    obj[symbols.segment] = segment || this.getSegment()
  }
}

/**
 * Binds a function to the async context manager with the passed in context.
 *
 * - `applyContext({ func, context , full, boundThis, args, inContextCB })`
 *
 * @memberof Shim.prototype
 * @param {object} params to function
 * @param {Function} params.func The function to execute in given async context.
 * @param {Context} params.context This context you want to run a function in
 * @param {boolean} params.full Indicates if the full lifetime of the segment is bound to this function.
 * @param {*} params.boundThis The `this` argument for the function.
 * @param {Array.<*>} params.args The arguments to be passed into the function.
 * @param {Function} [params.inContextCB] The function used to do more instrumentation work. This function is
 *  guaranteed to be executed with the segment associated with.
 * @returns {*} Whatever value `func` returned.
 */
function applyContext({ func, context, full, boundThis, args, inContextCB }) {
  const { segment } = context
  // Exit fast for bad arguments.
  if (!this.isFunction(func)) {
    return
  }

  if (!segment) {
    this.logger.trace('No segment to apply to function.')
    return fnApply.call(func, boundThis, args)
  }

  this.logger.trace('Applying segment %s', segment.name)

  /**
   * Callback to be run in the context of the segment.
   */
  function runInContextCb() {
    if (typeof inContextCB === 'function') {
      inContextCB(segment)
    }

    return fnApply.call(func, this, arguments)
  }

  return this.tracer.bindFunction(runInContextCb, context, full).apply(boundThis, args)
}

/**
 * Binds a function to the async context manager with the segment passed in. It'll pull
 * the active transaction from the context manager.
 *
 * - `applySegment(func, segment, full, context, args[, inContextCB])`
 *
 * @memberof Shim.prototype
 * @param {Function} func The function to execute in the context of the given segment.
 * @param {TraceSegment} segment The segment to make active for the duration of the function.
 * @param {boolean} full Indicates if the full lifetime of the segment is bound to this function.
 * @param {*} boundThis The `this` argument for the function.
 * @param {Array.<*>} args The arguments to be passed into the function.
 * @param {Function} [inContextCB] The function used to do more instrumentation work. This function is
 *  guaranteed to be executed with the segment associated with.
 * @returns {*} Whatever value `func` returned.
 */
function applySegment(func, segment, full, boundThis, args, inContextCB) {
  const context = this.tracer.getContext()
  const newContext = context.enterSegment({ segment })
  return this.applyContext({ func, context: newContext, full, boundThis, args, inContextCB })
}

/**
 * Creates a new segment.
 *
 * - `createSegment(opts)`
 * - `createSegment(name [, recorder] [, parent])`
 *
 * @memberof Shim.prototype
 * @param {string} name
 *  The name to give the new segment.
 * @param {?Function} [recorder]
 *  Optional. A function which will record the segment as a metric. Default is
 *  to not record the segment.
 * @param {TraceSegment} [parent]
 *  Optional. The segment to use as the parent. Default is to use the currently
 *  active segment.
 * @returns {?TraceSegment} A new trace segment if a transaction is active, else
 *  `null` is returned.
 */
function createSegment(name, recorder, parent) {
  let opts = {}
  if (this.isString(name)) {
    // createSegment(name [, recorder] [, parent])
    opts.name = name

    // if the recorder arg is not used, it can either be omitted or null
    if (this.isFunction(recorder) || this.isNull(recorder)) {
      // createSegment(name, recorder [, parent])
      opts.recorder = recorder
    } else {
      // createSegment(name [, parent])
      parent = recorder
    }
  } else {
    // createSegment(opts)
    opts = name
    parent = opts.parent
  }

  const transaction = this.tracer.getTransaction()
  parent = parent || this.getActiveSegment()
  const spec = new specs.SegmentSpec(opts)
  return _rawCreateSegment({ shim: this, spec, parent, transaction })
}

/**
 * @private
 * @param {object} params to function
 * @param {Shim} params.shim instance of shim
 * @param {Transaction} params.transaction active transaction
 * @param {TraceSegment} params.parent the segment that will be the parent of the newly created segment
 * @param {string|specs.SegmentSpec} params.spec options for creating segment
 * @returns {?TraceSegment} A new trace segment if a transaction is active, else
 *  `null` is returned.
 */
function _rawCreateSegment({ shim, spec, parent, transaction }) {
  // When parent exists and is opaque, no new segment will be created
  // by tracer.createSegment and the parent will be returned. We bail
  // out early so we do not risk modifying the parent segment.
  if (parent?.opaque) {
    shim.logger.trace(spec, 'Did not create segment because parent is opaque')
    return parent
  }

  const segment = shim.tracer.createSegment({
    name: spec.name,
    recorder: spec.recorder,
    parent,
    transaction
  })
  if (segment) {
    segment.internal = spec.internal
    segment.opaque = spec.opaque
    segment.shimId = shim.id

    if (hasOwnProperty(spec, 'parameters')) {
      shim.copySegmentParameters(segment, spec.parameters)
    }
    shim.logger.trace(spec, 'Created segment')
  } else {
    shim.logger.debug(spec, 'Failed to create segment')
  }

  return segment
}

/**
 * Determine the name of an object.
 *
 * @memberof Shim.prototype
 * @param {*} obj - The object to get a name for.
 * @returns {string} The name of the object if it has one, else `<anonymous>`.
 */
function getName(obj) {
  return String(!obj || obj === true ? obj : obj.name || '<anonymous>')
}

/**
 * Determines if the given object is an Object.
 *
 * @memberof Shim.prototype
 * @param {*} obj - The object to check.
 * @returns {boolean} True if the object is an Object, else false.
 */
function isObject(obj) {
  return obj != null && (obj instanceof Object || (!obj.constructor && typeof obj === 'object'))
}

/**
 * Determines if the given object exists and is a function.
 *
 * @memberof Shim.prototype
 * @param {*} obj - The object to check.
 * @returns {boolean} True if the object is a function, else false.
 */
function isFunction(obj) {
  return typeof obj === 'function'
}

/**
 * Determines if the given object exists and is a string.
 *
 * @memberof Shim.prototype
 * @param {*} obj - The object to check.
 * @returns {boolean} True if the object is a string, else false.
 */
function isString(obj) {
  return typeof obj === 'string' || obj instanceof String
}

/**
 * Determines if the given object is a number literal.
 *
 * @memberof Shim.prototype
 * @param {*} obj - The object to check.
 * @returns {boolean} True if the object is a number literal, else false.
 */
function isNumber(obj) {
  return typeof obj === 'number'
}

/**
 * Determines if the given object is a boolean literal.
 *
 * @memberof Shim.prototype
 * @param {*} obj - The object to check.
 * @returns {boolean} True if the object is a boolean literal, else false.
 */
function isBoolean(obj) {
  return typeof obj === 'boolean'
}

/**
 * Determines if the given object exists and is an array.
 *
 * @memberof Shim.prototype
 * @param {*} obj - The object to check.
 * @returns {boolean} True if the object is an array, else false.
 */
function isArray(obj) {
  return obj instanceof Array
}

/**
 * Determines if the given object is a promise instance.
 *
 * @memberof Shim.prototype
 * @param {*} obj - The object to check.
 * @returns {boolean} True if the object is a promise, else false.
 */
function isPromise(obj) {
  return obj && typeof obj.then === 'function'
}

/**
 * Determines if function is an async function.
 * Note it does not test if the return value of function is a
 * promise or async function
 *
 * @memberof Shim.prototype
 * @param {Function} fn function to test if async
 * @returns {boolean} True if the function is an async function
 */
function isAsyncFunction(fn) {
  return fn.constructor.name === 'AsyncFunction'
}

/**
 * Determines if the given value is null.
 *
 * @memberof Shim.prototype
 * @param {*} val - The value to check.
 * @returns {boolean} True if the value is null, else false.
 */
function isNull(val) {
  return val === null
}

/**
 * Converts an array-like object into an array.
 *
 * @memberof Shim.prototype
 * @param {*} obj - The array-like object (i.e. `arguments`).
 * @returns {Array.<*>} An instance of `Array` containing the elements of the
 *  array-like.
 */
function toArray(obj) {
  const len = obj.length
  const arr = new Array(len)
  for (let i = 0; i < len; ++i) {
    arr[i] = obj[i]
  }
  return arr
}

/**
 * Like {@link Shim#toArray}, but converts `arguments` to an array.
 *
 * This is the preferred function, when used with `.apply`, for converting the
 * `arguments` object into an actual `Array` as it will not cause deopts.
 *
 * @memberof Shim.prototype
 * @returns {Array} An array containing the elements of `arguments`.
 * @see Shim#toArray
 * @see https://github.com/petkaantonov/bluebird/wiki/Optimization-killers
 *
 * @deprecated 2025-06-10 -- see https://github.com/newrelic/node-newrelic/issues/3089
 */
function argsToArray() {
  this._logger?.warn('argsToArray is deprecated and will be removed in the next major')
  const len = arguments.length
  const arr = new Array(len)
  for (let i = 0; i < len; ++i) {
    arr[i] = arguments[i]
  }
  return arr
}

/**
 * Ensures the given index is a valid index inside the array.
 *
 * A negative index value is converted to a positive one by adding it to the
 * array length before checking it.
 *
 * @memberof Shim.prototype
 * @param {number} arrayLength  - The length of the array this index is for.
 * @param {number} idx          - The index to normalize.
 * @returns {?number} The adjusted index value if it is valid, else `null`.
 */
function normalizeIndex(arrayLength, idx) {
  if (idx < 0) {
    idx = arrayLength + idx
  }
  return idx < 0 || idx >= arrayLength ? null : idx
}

/**
 * Wraps a function such that it will only be executed once.
 *
 * @memberof Shim.prototype
 * @param {Function} fn - The function to wrap in an execution guard.
 * @returns {Function} A function which will execute `fn` at most once.
 */
function once(fn) {
  let called = false
  return function onceCaller() {
    if (!called) {
      called = true
      return fn.apply(this, arguments)
    }
  }
}

/**
 * Defines a read-only property on the given object.
 *
 * @memberof Shim.prototype
 * @param {object} obj
 *  The object to add the property to.
 * @param {string} name
 *  The name of the property to add.
 * @param {* | Function} value
 *  The value to set. If a function is given, it is used as a getter, otherwise
 *  the value is directly set as an unwritable property.
 */
function defineProperty(obj, name, value) {
  // We have define property! Use that.
  const prop = {
    enumerable: true,
    configurable: true
  }
  if (isFunction(value)) {
    prop.get = value
  } else {
    prop.writable = false
    prop.value = value
  }
  Object.defineProperty(obj, name, prop)
}

/**
 * Adds several properties to the given object.
 *
 * @memberof Shim.prototype
 * @param {object} obj    - The object to add the properties to.
 * @param {object} props  - A mapping of properties to values to add.
 * @see Shim#defineProperty
 */
function defineProperties(obj, props) {
  const keys = Object.keys(props)
  for (let i = 0; i < keys.length; ++i) {
    const key = keys[i]
    defineProperty(obj, key, props[key])
  }
}

/**
 * Performs a shallow copy of each property from `defaults` only if `obj` does
 * not already have that property, or the value of the key on `obj` is `null`.
 *
 * @memberof Shim.prototype
 * @param {object?} obj       - The object to copy the defaults onto.
 * @param {object}  defaults  - A mapping of keys to default values.
 * @returns {object} The `obj` with the default values copied onto it. If `obj`
 *  was falsey, then a new object with the defaults copied onto it is returned
 *  instead.
 */
function setDefaults(obj, defaults) {
  if (!obj) {
    obj = Object.create(null)
  }
  const keys = Object.keys(defaults)

  for (let i = 0; i < keys.length; ++i) {
    const key = keys[i]
    if (hasOwnProperty(obj, key) === false || obj[key] === null) {
      obj[key] = defaults[key]
    }
  }

  return obj
}

/**
 * Proxies all set/get actions for each given property on `dest` onto `source`.
 *
 * @memberof Shim.prototype
 * @param {*} source
 *  The object on which all the set/get actions will actually occur.
 * @param {string|Array.<string>} properties
 *  All of the properties to proxy.
 * @param {*} dest
 *  The object which is proxying the source's properties.
 */
function proxy(source, properties, dest) {
  if (!this.isArray(properties)) {
    properties = [properties]
  }

  for (const prop of properties) {
    Object.defineProperty(dest, prop, {
      get: function proxyGet() {
        return source[prop]
      },
      set: function proxySet(val) {
        source[prop] = val
        return source[prop]
      }
    })
  }
}

/**
 * Loads a node module from the instrumented library's own root directory.
 *
 * @memberof Shim.prototype
 * @param {string} filePath - A relative path inside the module's directory.
 * @returns {*?} The result of loading the given module. If the module fails to
 *  load, `null` is returned instead.
 */
function shimRequire(filePath) {
  try {
    return require(path.resolve(this._moduleRoot, filePath))
  } catch (e) {
    this.logger.debug(
      "Failed to load '%s' from module root: '%s'. Stack: %s",
      filePath,
      this._moduleRoot,
      e.stack
    )
    return null
  }
}

/**
 * Executes the given callback when the promise is finalized, whether it is
 * resolved or rejected.
 *
 * @memberof Shim.prototype
 * @param {Promise} prom  - Some kind of promise. Must have a `then` method.
 * @param {Function} cb   - A function to call when the promise resolves.
 * @returns {Promise} A new promise to replace the original one.
 */
function interceptPromise(prom, cb) {
  prom.then(cb, cb)
  return prom
}

/**
 * Binds the given segment to the completion of the Promise.
 * Updates segment timing and resets opaque state.
 *
 * @memberof Shim.prototype
 * @param {!Promise} promise
 *  The Promise to bind.
 * @param {!TraceSegment} segment
 *  The segment to bind to the Promise.
 * @returns {Promise} The promise to continue with.
 */
function bindPromise(promise, segment) {
  return this.interceptPromise(promise, function thenTouch() {
    segment.opaque = false
    segment.touch()
  })
}

/**
 * Copies the given parameters onto the segment, respecting the current agent
 * configuration.
 *
 * @memberof Shim.prototype
 * @param {TraceSegment}  segment     - The segment to copy the parameters onto.
 * @param {object}        parameters  - The parameters to copy.
 */
function copySegmentParameters(segment, parameters) {
  for (const key in parameters) {
    if (hasOwnProperty(parameters, key)) {
      segment.addAttribute(key, parameters[key])
    }
  }
}

/**
 * Enables debugging mode of the shim.
 *
 * In debug mode the shim will track all methods that it wraps so they can be
 * unwrapped. This should _not_ be done in production code because a lot more
 * objects are held onto in memory.
 *
 * @private
 * @memberof Shim.prototype
 */
function enableDebug() {
  this.logger.warn('Enabling debug mode for shim!')
  this._debug = true
  this._wrapped = []
}

/**
 * Unwraps everything that the shim has wrapped. Only works if debugging mode is
 * enabled first.
 *
 * @private
 * @member Shim.prototype.unwrap
 */
function unwrapAll() {
  if (this._wrapped) {
    this.logger.debug('Unwrapping %d items.', this._wrapped.length)
    for (const wrapped of this._wrapped) {
      this.unwrap(wrapped)
    }
  }
}

// -------------------------------------------------------------------------- //

/**
 * Coerces the given spec into a function which {@link Shim#wrap} can use.
 * returns WrapFunction The spec itself if spec is a function, otherwise a
   function which will execute the spec when called.
 *
 * @private
 * @param {Spec|WrapFunction} spec - The spec to coerce into a function.
 */
function _specToFunction(spec) {
  throw new Error('Declarative specs are not implemented yet.')
}

/**
 * Assigns the shim id and original on the wrapped item.
 * TODO: Once all wrapping is converted to proxies, we won't need to
 * set this property as the trap on 'get' will return the original for
 * symbols.original. For now, we have to prevent setting this on original.
 *
 * @param {*} wrapped wrapped item
 * @param {*} original * The item being wrapped.
 * @param {boolean} forceOrig flag to indicate to overwrite original function
 * @memberof Shim.prototype
 */
function assignOriginal(wrapped, original, forceOrig) {
  wrapped[symbols.wrapped] = this.id
  if (!wrapped[symbols.original] || forceOrig) {
    wrapped[symbols.original] = original
  }
}

const shimIds = new Map()

/**
 * Assigns id to shim instance.
 * If shimName is present it will reuse an id
 * otherwise it'll create a unique id.
 *
 * @param {string} shimName Used to persist shim ids across different instances.
 * @memberof Shim.prototype
 */
function assignId(shimName) {
  const id = shimIds.get(shimName)
  this.id = id || makeId()

  if (shimName && !id) {
    shimIds.set(shimName, this.id)
  }
}

/**
 * Executes the provided spec on the given object.
 *
 * - `_wrap(shim, original, name, spec [, args])`
 *
 * @private
 * @param {Shim} shim
 *  The shim that is executing the wrapping.
 * @param {*} original
 *  The object being wrapped.
 * @param {string} name
 *  A logical name for the item to be wrapped.
 * @param {WrapFunction} spec
 *  The spec for wrapping these items.
 * @param {Array.<*>} [args]
 *  Optional extra arguments to be sent to the spec when executing it.
 * @returns {Function} The return value from `spec` or the original value if it
 *  did not return anything.
 */
function _wrap(shim, original, name, spec, args) {
  // Assemble the spec's arguments.
  const specArgs = [shim, original, name]
  if (args && args.length) {
    specArgs.push.apply(specArgs, args)
  }

  // Apply the spec and see if it returned a wrapped version of the property.
  let wrapped = spec.wrapper.apply(null, specArgs)
  if (wrapped && wrapped !== original) {
    if (spec.matchArity && shim.isFunction(wrapped)) {
      wrapped = arity.fixArity(original, wrapped)
    }

    shim.assignOriginal(wrapped, original)

    if (shim._debug) {
      shim._wrapped.push(wrapped)
    }
  } else {
    wrapped = original
  }
  return wrapped
}

/**
 * Creates the `bindSegment` wrapper function in its own, clean closure.
 *
 * @private
 * @param {Shim} shim
 *  The shim used for the binding.
 * @param {Function} func
 *  The function to be bound to the segment.
 * @param {Context} context
 *  The agent context that the function is bound to.
 * @param {boolean} full
 *  Indicates if the segment's full lifetime is bound to the function.
 * @returns {Function} A function which wraps `func` and makes the given segment
 *  active for the duration of its execution.
 */
function _makeBindWrapper(shim, func, context, full) {
  return function wrapper() {
    return shim.applyContext({ func, context, full, boundThis: this, args: arguments })
  }
}

/**
 * Binds all callbacks identified in the given spec.
 *
 * The callbacks are bound using the method meant for that type if available
 * (i.e. `bindRowCallbackSegment` for `rowCallback`), but will fall back to the
 * generic callback binding method, `bindCallbackSegment`, otherwise.
 *
 * @private
 * @this *
 * @param {Shim} shim
 *  The shim performing this binding.
 * @param {Function} fn
 *  The function the spec describes.
 * @param {string} name
 *  The name of the function the spec describes.
 * @param {Array} args
 *  The arguments to be passed into `fn`.
 * @param {object} spec
 *  The specification for bind the callbacks.
 * @param {SegmentSpec} spec.spec
 *  The segment specification for the function we're pulling callbacks out of.
 * @param {TraceSegment} spec.segment
 *  The segment measuring the function which will be the parent of any callback
 *  segments that may be created.
 * @param {boolean} spec.shouldCreateSegment
 *  Flag indicating if we should create segments for the callbacks. We almost
 *  always do, but in the special case of nested internal methods we do not.
 */
function _bindAllCallbacks(shim, fn, name, args, spec) {
  // Check for a normal callback.
  if (spec?.spec?.callback !== null) {
    _bindCallback({
      context: this,
      callback: spec.spec.callback,
      binder: shim.bindCallbackSegment.bind(shim, spec.spec),
      shim,
      fn,
      args,
      spec,
      name
    })
  }

  // And check for a row callback.
  if (spec?.spec?.rowCallback !== null) {
    _bindCallback({
      context: this,
      callback: spec.spec.rowCallback,
      binder: shim?.bindRowCallbackSegment || shim?.bindCallbackSegment?.bind(shim, spec.spec),
      shim,
      fn,
      args,
      spec,
      name
    })
  }
}

/**
 *
 * Calls the relevant spec function to properly bind the callback to the active segment.
 *
 * @private
 * @param {object} params function params
 * @param {object} params.context this context for active function
 * @param {Function | number} params.callback calls relevant function to bind segment or binds segment to appropriate arg
 * @param {Function} params.binder function use to bind segment to callback
 * @param {Shim} params.shim instance of shim
 * @param {Function} params.fn original function
 * @param {Array} params.args arguments to original function
 * @param {object} params.spec spec for given function
 * @param {string} params.name name of original function
 */
function _bindCallback({ context, callback, binder, shim, fn, args, spec, name }) {
  if (shim.isFunction(callback)) {
    callback.call(context, shim, fn, name, spec.segment, args)
  } else if (shim.isNumber(callback)) {
    shim.logger.trace('Binding callback %d segment: %j', callback, !!spec.segment)
    const cbIdx = normalizeIndex(args.length, callback)
    if (cbIdx !== null) {
      if (spec.shouldCreateSegment) {
        binder.call(shim, args, cbIdx, spec.segment)
      } else {
        args[cbIdx] = shim.bindSegment(args[cbIdx], spec.segment, true)
      }
    }
  }
}

/**
 * Binds the given segment to the lifetime of the stream.
 *
 * @private
 * @param {Shim} shim
 *  The shim performing the wrapping/binding.
 * @param {EventEmitter} stream
 *  The stream to bind.
 * @param {?TraceSegment} segment
 *  The segment to bind to the stream.
 * @param {object} [spec]
 *  Specification for how to bind the stream. The `end` and `error` events will
 *  always be bound, so if no functionality is desired beyond that, then this
 *  parameter may be omitted.
 * @param {string} [spec.event]
 *  The name of an event to record. If provided, a new segment will be created
 *  for this event and will measure each time the event is emitted.
 * @param {boolean} spec.shouldCreateSegment
 *  Indicates if any child segments should be created. This should always be
 *  true unless this segment and its parent are both internal segments.
 */
function _bindStream(shim, stream, segment, spec) {
  if (!segment || !shim.isFunction(stream.emit)) {
    shim.logger.trace(
      'Not binding stream; have segment=%j; typeof emit=%s',
      !!segment,
      typeof stream.emit
    )
    return
  }

  // We have a segment and an emit function, pull out the relevant parts of the
  // spec and prepare to create an event segment.
  const specEvent = spec?.event
  const shouldCreateSegment = spec?.shouldCreateSegment || false
  const segmentName = `Event callback: ${specEvent}`

  wrapStreamEmit({ stream, shim, segment, specEvent, shouldCreateSegment, segmentName })
  wrapStreamListeners({ stream, shim, specEvent, segment })
}

/**
 * Wraps stream.emit and binds segment and adds count attr to segment
 *
 * @private
 * @param {object} params to function
 * @param {EventEmitter} params.stream The stream to bind.
 * @param {Shim} params.shim instance of shim
 * @param {?TraceSegment} params.segment The segment to bind to the stream.
 * @param {string} params.specEvent event to to bind segment
 * @param {boolean} params.shouldCreateSegment flag to indicate if segment should be bound to event
 * @param {string} params.segmentName name of segment
 */
function wrapStreamEmit({ stream, shim, segment, specEvent, shouldCreateSegment, segmentName }) {
  // Wrap emit such that each event handler is executed within context of this
  // segment or the event-specific segment.
  shim.wrap(stream, 'emit', function wrapEmit(shim, emit) {
    const context = shim.tracer.getContext()
    const tx = context.transaction
    const newContext = context.enterSegment({ segment })
    const streamBoundEmit = shim.bindContext({ nodule: emit, context: newContext, full: true })
    let eventSegment = null
    let eventBoundEmit = null
    let emitCount = 0

    if (!shouldCreateSegment) {
      return streamBoundEmit
    }

    return function wrappedEmit(evnt) {
      let emitToCall = streamBoundEmit
      if (evnt === specEvent && tx.isActive()) {
        if (!eventBoundEmit) {
          eventSegment = shim.createSegment({ name: segmentName, parent: segment })
          const newContext = context.enterSegment({ segment: eventSegment })
          eventBoundEmit = shim.bindContext({ nodule: emit, full: true, context: newContext })
        }
        if (eventSegment) eventSegment.addAttribute('count', ++emitCount)
        emitToCall = eventBoundEmit
      }
      if (evnt === 'end' || evnt === 'error') {
        segment.opaque = false
        segment.touch()
      }

      return emitToCall.apply(this, arguments)
    }
  })
}

/**
 * Wraps the on and addListener functions and binds active segment
 *
 * @private
 * @param {object} params to function
 * @param {EventEmitter} params.stream The stream to bind.
 * @param {Shim} params.shim instance of shim
 * @param {?TraceSegment} params.segment The segment to bind to the stream.
 * @param {string} params.specEvent event to to bind segment
 */
function wrapStreamListeners({ stream, shim, segment, specEvent }) {
  // Also wrap up any listeners for end or error events.
  shim.wrap(stream, ['on', 'addListener'], function wrapOn(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }

    return function wrappedOn(...args) {
      const [onEvent] = args
      if (onEvent !== specEvent && (onEvent === 'end' || onEvent === 'error')) {
        shim.bindCallbackSegment(specEvent, args, shim.LAST, segment)
        return fn.apply(this, args)
      }
      return fn.apply(this, args)
    }
  })
}

/**
 * Wraps an es6-style class using a subclass.
 *
 * - `_es6WrapClass(shim, Base, fnName, spec, args)`
 *
 * @private
 * @param {Shim} shim
 *  The shim performing the wrapping/binding.
 * @param {Function} Base
 *  The es6 class to be wrapped.
 * @param {string} fnName
 *  The name of the base class.
 * @param {ClassWrapSpec} spec
 *  The spec with pre- and post-execution hooks to call.
 * @param {Array.<*>} args
 *  Extra arguments to pass through to the pre- and post-execution hooks.
 * @returns {Function} A class that extends Base with execution hooks.
 */
function _es6WrapClass(shim, Base, fnName, spec, args) {
  return class WrappedClass extends Base {
    constructor(...cnstrctArgs) {
      // Assemble the arguments to hand to the spec.
      const _args = [shim, Base, fnName, cnstrctArgs]
      if (args.length > 0) {
        _args.push.apply(_args, args)
      }

      // Call the spec's before hook, then call the base constructor, then call
      // the spec's after hook.
      spec.pre && spec.pre.apply(null, _args)
      super(...cnstrctArgs)
      spec.post && spec.post.apply(this, _args)
    }
  }
}

/**
 * Wraps an es5-style class using a subclass.
 *
 * - `_es5WrapClass(shim, Base, fnName, spec, args)`
 *
 * @private
 * @param {Shim} shim
 *  The shim performing the wrapping/binding.
 * @param {Function} Base
 *  The class to be wrapped.
 * @param {string} fnName
 *  The name of the base class.
 * @param {ClassWrapSpec} spec
 *  The spec with pre- and post-execution hooks to call.
 * @param {Array.<*>} args
 *  Extra arguments to pass through to the pre- and post-execution hooks.
 * @returns {Function} A class that extends Base with execution hooks.
 */
function _es5WrapClass(shim, Base, fnName, spec, args) {
  /**
   * Wraps the es5 class in a function
   *
   * @param {...any} cnstrctArgs class constructor arguments
   * @returns {Function|undefined} a function if not already wrapped in WrappedClass
   */
  function WrappedClass(...cnstrctArgs) {
    if (!(this instanceof WrappedClass)) {
      // Some libraries support calling constructors without the `new` keyword.
      // In order to support this we must apply the super constructor if `this`
      // is not an instance of ourself. JavaScript really needs a better way
      // to generically apply constructors.
      cnstrctArgs.unshift(WrappedClass) // `unshift` === `push_front`
      return new (WrappedClass.bind.apply(WrappedClass, cnstrctArgs))()
    }

    // Assemble the arguments to hand to the spec.
    const _args = [shim, Base, fnName, cnstrctArgs]
    if (args.length > 0) {
      _args.push.apply(_args, args)
    }

    // Call the spec's before hook, then call the base constructor, then call
    // the spec's after hook.
    spec.pre && spec.pre.apply(null, _args)
    Base.apply(this, cnstrctArgs)
    spec.post && spec.post.apply(this, _args)
  }

  util.inherits(WrappedClass, Base)
  WrappedClass.prototype = Base.prototype

  return WrappedClass
}

/**
 * This method is no longer in use. It still exists to avoid crashing
 * applications.  The logic of this method has been integrated into
 * finalizing a web transaction.
 *
 * @param {object} params - Object containing route/url parameter key/value pairs
 * @returns {void} method is now stubbed and logic ported into `finalizeWebTransaction`
 * @memberof Shim.prototype
 */
function prefixRouteParameters(params) {
  logger.warnOnce('shim.prefixRouteParameters logic has been moved to when a web transaction ends.  This method will be removed in the next upcoming major version v14.0.0.')
}
