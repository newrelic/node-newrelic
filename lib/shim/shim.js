/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/* eslint sonarjs/cognitive-complexity: ["error", 59] -- TODO: https://issues.newrelic.com/browse/NEWRELIC-5252 */

const arity = require('../util/arity')
const hasOwnProperty = require('../util/properties').hasOwn
const logger = require('../logger').child({ component: 'Shim' })
const path = require('path')
const specs = require('./specs')
const util = require('util')
const symbols = require('../symbols')
const { addCLMAttributes: maybeAddCLMAttributes } = require('../util/code-level-metrics')
const { makeId } = require('../util/hashes')

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
  this._contextManager = agent._contextManager
  this._toExport = null
  this._debug = false
  this.defineProperty(this, 'moduleName', moduleName)
  this.assignId(shimName)
  this.pkgVersion = pkgVersion

  // Determine the root directory of the module.
  let moduleRoot = null
  let next = resolvedName || '/'
  do {
    moduleRoot = next
    next = path.dirname(moduleRoot)
  } while (moduleRoot.length > 1 && !/node_modules(?:\/@[^/]+)?$/.test(next))
  this._moduleRoot = moduleRoot
}
module.exports = Shim

Shim.defineProperty = defineProperty
Shim.defineProperties = defineProperties

// This is for backwards compat for external libraries like aws-sdk that expect the symbol to be defined here
defineProperty(Shim, 'DISABLE_DT', symbols.disableDT)
defineProperty(Shim.prototype, 'DISABLE_DT', symbols.disableDT)

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
   * The tracer in use by the agent for the shim.
   *
   * @readonly
   * @member {Tracer} Shim.prototype.tracer
   * @returns {Tracer} The instance of the tracer
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
Shim.prototype.createSegment = createSegment
Shim.prototype.getName = getName
Shim.prototype.isObject = isObject
Shim.prototype.isFunction = isFunction
Shim.prototype.isPromise = isPromise
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
 * @private
 * @callback MetricFunction
 * @summary
 *  Measures all the necessary metrics for the given segment. This functionality
 *  is meant to be used by Shim subclasses, instrumentations should never create
 *  their own recorders.
 * @param {TraceSegment}  segment - The segment to record.
 * @param {string}        [scope] - The scope of the recording.
 */

/**
 * @callback ConstructorHookFunction
 * @summary
 *  Pre/post constructor execution hook for wrapping classes. Used by
 *  {@link ClassWrapSpec}.
 * @param {Shim} shim
 *  The shim performing the wrapping/binding.
 * @param {Function} Base
 *  The class that was wrapped.
 * @param {string} name
 *  The name of the `Base` class.
 * @param {Array.<*>} args
 *  The arguments to the class constructor.
 * @see ClassWrapSpec
 */

/**
 * @private
 * @interface Spec
 * @description
 *  The syntax for declarative instrumentation. It can be used interlaced with
 *  custom, hand-written instrumentation for one-off or hard to simplify
 *  instrumentation logic.
 * @property {Spec|WrapFunction} $return
 *  Changes the context to the return value of the current context. This means
 *  the sub spec will not be executed up front, but instead upon every execution
 *  of the current context.
 *
 *  ```js
 *  var ret = func.apply(this, args);
 *  return shim.wrap(ret, spec.$return)
 *  ```
 * @property {Spec|WrapFunction} $proto
 *  Changes the context to the prototype of the current context. The prototype
 *  is found using `Object.getPrototypeOf`.
 *
 *  ```js
 *  shim.wrap(Object.getPrototypeOf(context), spec.$proto)
 *  ```
 * @property {boolean} $once
 *  Ensures that the parent spec will only be executed one time if the value is
 *  `true`. Good for preventing double wrapping of prototype methods.
 *
 *  ```js
 *  if (spec.$once && spec[symbols.onceExecuted]) {
 *    return context
 *  }
 *  spec[symbols.onceExecuted] = true
 *  ```
 * @property {ArgumentsFunction} $arguments
 *  Executes the function with all of the arguments passed in. The arguments can
 *  be modified in place. This will execute before `$eachArgument`.
 *
 *  ```js
 *  spec.$arguments(args)
 *  ```
 * @property {Spec|ArrayWrapFunction} $eachArgument
 *  Executes `shim.wrap` on each argument passed to the current context. The
 *  returned arguments will then be used to actually execute the function.
 *
 *  ```js
 *  var argLength = arguments.length
 *  var extraArgs = extras.concat([0, argLength])
 *  var iIdx = extraArgs.length - 2
 *  var args = new Array(argLength)
 *  for (var i = 0; i < argLength; ++i) {
 *    extraArgs[iIdx] = i
 *    args[i] = shim.wrap(arguments[i], spec.$eachArgument, extraArgs)
 *  }
 *  func.apply(this, args)
 *  ```
 * @property {Array.<{$properties: Array.<string>, $spec: Spec}>} $wrappings
 *  Executes `shim.wrap` with the current context as the `nodule` for each
 *  element in the array. The `$properties` sub-key must list one or more
 *  properties to be wrapped. The `$spec` sub-key must be a {@link Spec} or
 *  {@link WrapFunction} for wrapping the properties.
 *
 *  ```js
 *  spec.$wrappings.forEach(function($wrap) {
 *    shim.wrap(context, $wrap.$properties, $wrap.$spec)
 *  })
 *  ```
 * @property {bool|string|SegmentFunction} $segment
 *  Controls segment creation. If a falsey value (i.e. `undefined`, `false`,
 *  `null`, etc) then no segment will be created. If the value is `true`, then
 *  the name of the current context is used to name the segment. If the value is
 *  a string then that string will be the name of the segment. Lastly, if the
 *  value is a function, that function will be called with the current context
 *  and arguments.
 *
 *  ```js
 *  var segment = null
 *  if (spec.$segment) {
 *    var seg = {name: spec.$segment}
 *    if (shim.isFunction(seg.name)) {
 *      seg = seg.name(func, this, arguments)
 *    }
 *    else if (seg.name === true) {
 *      seg.name = func.name
 *    }
 *    segment = shim.createSegment(seg.name, seg.recorder, seg.parent)
 *  }
 *  ```
 * @property {Object<string, *>} $cache
 *  Adds the value as an extra parameter to all specs in the same context as the
 *  cache. If the current context is a function, the cache will be recreated on
 *  each invocation of the function. This value can be useful for passing a
 *  value at runtime from one spec into another.
 *
 *  ```js
 *  var args = extras || []
 *  if (spec.$cache) {
 *    args.push({})
 *  }
 *  ```
 * @property {number} $callback
 *  Indicates that one of the parameters is a callback which should be wrapped.
 *
 *  ```js
 *  if (shim.isNumber(spec.$callback)) {
 *    var idx = spec.$callback
 *    if (idx < 0) {
 *      idx = args.length + idx
 *    }
 *    args[idx] = shim.bindSegment(args[idx], segment)
 *  }
 *  ```
 * @property {Spec|WrapFunction} property
 *  Any field which does not start with a `$` is assumed to name a property on
 *  the current context which should be wrapped. This is simply shorthand for a
 *  `$wrappings` with only one `$properties` value.
 */

/**
 * @interface SegmentSpec
 * @description
 *  The return value from a {@link SegmentFunction}, used to set the parameters
 *  of segment creation.
 * @property {string} name
 *  The name for the segment to-be.
 * @property {MetricFunction} [recorder]
 *  A metric recorder for the segment. This is purely for internal use by shim
 *  classes. Instrumentations should never implement their own metric functions.
 * @property {TraceSegment} [parent]
 *  The parent segment. Defaults to the currently active segment.
 * @see RecorderSpec
 * @see SegmentFunction
 */

/**
 * @interface RecorderSpec
 * @augments SegmentSpec
 * @description
 *  The return value from a {@link RecorderFunction}, used to set the parameters
 *  of segment creation and lifetime. Extends the {@link SegmentSpec}.
 * @property {bool|string} [stream]
 *  Indicates if the return value from the wrapped function is a stream. If the
 *  value is truthy then the recording will extend to the `end` event of the
 *  stream. If the value is a string it is assumed to be the name of an event to
 *  measure. A segment will be created to record emissions of the event.
 * @property {boolean} [promise]
 *  Indicates if the return value from the wrapped function is a Promise. If the
 *  value is truthy then the recording will extend to the completion of the
 *  Promise.
 * @property {number|CallbackBindFunction} [callback]
 *  If this is a number, it identifies which argument is the callback and the
 *  segment will also be bound to the callback. Otherwise, the passed function
 *  should perform the segment binding itself.
 * @property {number|CallbackBindFunction} [rowCallback]
 *  Like `callback`, this identifies a callback function in the arguments. The
 *  difference is that the default behavior for row callbacks is to only create
 *  one segment for all calls to the callback. This is mostly useful for
 *  functions which will be called repeatedly, such as once for each item in a
 *  result set.
 * @property {boolean} [internal=false]
 *  Marks this as the boundary point into the instrumented library. If `true`
 *  and the current segment is _also_ marked as `internal` by the same shim,
 *  then we will not record this inner activity.
 *
 *  This is useful when instrumenting a library which implements high-order
 *  methods which simply call other public methods and you only want to record
 *  the method directly called by the user while still instrumenting all
 *  endpoints.
 * @property {Function} [after=null]
 *  A function to call after the synchronous execution of the recorded method.
 *  If the function synchronously threw an error, that error will be handed to
 *  this function.
 * @property {boolean} [callbackRequired]
 *  When `true`, a recorded method must be called with a callback for a segment
 *  to be created. Does not apply if a custom callback method has been assigned
 *  via {@link callback}.
 * @see SegmentSpec
 * @see RecorderFunction
 */

/**
 * @interface ClassWrapSpec
 * @description
 *  Specifies the style of wrapping and construction hooks for wrapping classes.
 * @property {boolean} [es6=false]
 * @property {ConstructorHookFunction} [pre=null]
 *  A function called with the constructor's arguments before the base class'
 *  constructor is executed. The `this` value will be `null`.
 * @property {ConstructorHookFunction} [post=null]
 *  A function called with the constructor's arguments after the base class'
 *  constructor is executed. The `this` value will be the just-constructed object.
 */

// -------------------------------------------------------------------------- //

/**
 * Entry point for executing a spec.
 *
 * @param nodule
 * @param spec
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
 * @param {Array.<*>} [args=[]]
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
    spec = {
      wrapper: spec
    }
  }

  // TODO: Add option for omitting symbols.original; unwrappable: false
  spec = this.setDefaults(spec, { matchArity: false })

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
  properties.forEach(function wrapEachProperty(prop) {
    // Skip nonexistent properties.
    const original = nodule[prop]
    if (!original) {
      this.logger.debug('Not wrapping missing property "%s"', prop)
      return
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
  }, this)
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
 * @param {Spec|WrapReturnFunction} spec
 *  The spec for wrapping the returned value from the properties.
 * @param {Array.<*>} [args=[]]
 *  Optional extra arguments to be sent to the spec when executing it.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
 * @see Shim#wrap
 * @see WrapReturnFunction
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
  })
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
 * @param {Array.<*>} [args=[]]
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
  if (this.isFunction(spec)) {
    spec = { pre: null, post: spec }
  } else {
    spec.pre = spec.pre || null
    spec.post = spec.post || null
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
  return (this._toExport = this.wrap(nodule, null, spec))
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
    return !!(nodule?.[property]?.[symbols.wrapped] === this.id)
  }
  return !!(nodule?.[symbols.wrapped] === this.id)
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

    return function wrapper() {
      // Create the segment that will be recorded.
      const args = argsToArray.apply(shim, arguments)
      let segDesc = recordNamer.call(this, shim, fn, name, args)
      if (!segDesc) {
        shim.logger.trace('No segment descriptor for "%s", not recording.', name)
        return fnApply.call(fn, this, args)
      }
      segDesc = new specs.RecorderSpec(segDesc)

      // See if we're in an active transaction.
      let parent
      if (segDesc.parent) {
        // We only want to continue recording in a transaction if the
        // transaction is active.
        parent = segDesc.parent.transaction.isActive() ? segDesc.parent : null
      } else {
        parent = shim.getActiveSegment()
      }

      if (!parent) {
        shim.logger.debug('Not recording function %s, not in a transaction.', name)
        return fnApply.call(fn, this, arguments)
      }

      if (segDesc.callbackRequired && !_hasValidCallbackArg(shim, args, segDesc.callback)) {
        return fnApply.call(fn, this, arguments)
      }

      // Only create a segment if:
      //  - We are _not_ making an internal segment.
      //  - OR the parent segment is either not internal or not from this shim.
      const shouldCreateSegment = !(
        parent.opaque ||
        (segDesc.internal && parent.internal && shim === parent.shim)
      )

      const segment = shouldCreateSegment ? _rawCreateSegment(shim, segDesc) : parent
      maybeAddCLMAttributes(fn, segment)

      return _doRecord.call(this, segment, args, segDesc, shouldCreateSegment)
    }

    /**
     * @param shim
     * @param args
     * @param specCallback
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
     * @param segment
     * @param args
     * @param segDesc
     * @param shouldCreateSegment
     */
    function _doRecord(segment, args, segDesc, shouldCreateSegment) {
      // Now bind any callbacks specified in the segment descriptor.
      _bindAllCallbacks.call(this, shim, fn, name, args, {
        spec: segDesc,
        segment: segment,
        shouldCreateSegment: shouldCreateSegment
      })

      // Apply the function, and (if it returned a stream) bind that too.
      // The reason there is no check for `segment` is because it should
      // be guaranteed by the parent and active transaction check
      // at the beginning of this function.
      let ret = _applyRecorderSegment(segment, this, args, segDesc)
      if (ret) {
        if (segDesc.stream) {
          shim.logger.trace('Binding return value as stream.')
          _bindStream(shim, ret, segment, {
            event: shim.isString(segDesc.stream) ? segDesc.stream : null,
            shouldCreateSegment: shouldCreateSegment
          })
        } else if (segDesc.promise && shim.isPromise(ret)) {
          shim.logger.trace('Binding return value as Promise.')
          ret = shim.bindPromise(ret, segment)
        }
      }
      return ret
    }

    /**
     * @param segment
     * @param ctx
     * @param args
     * @param segDesc
     */
    function _applyRecorderSegment(segment, ctx, args, segDesc) {
      let error = null
      let promised = false
      let ret
      try {
        ret = shim.applySegment(fn, segment, true, ctx, args, segDesc.inContext)
        if (segDesc.after && segDesc.promise && shim.isPromise(ret)) {
          promised = true
          return ret.then(
            function onThen(val) {
              segment.touch()
              segDesc.after(shim, fn, name, null, val, segment)
              return val
            },
            function onCatch(err) {
              segment.touch()
              segDesc.after(shim, fn, name, err, null, segment)
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
          segDesc.after(shim, fn, name, error, ret, segment)
        }
      }
    }
  })
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
    properties.forEach(unwrap.bind(this, nodule))
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
 * @param {?TraceSegment} [segment=null]
 *  The segment to bind the execution of the function to. If omitted or `null`
 *  the currently active segment will be bound instead.
 * @param {boolean} [full=false]
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

  // This protects against the `bindSegment(func, null, true)` case, where the
  // segment is `null`, and thus `true` (the full param) is detected as the
  // segment.
  if (segment != null && !this.isObject(segment)) {
    this.logger.debug({ segment: segment }, 'Segment is not a segment, not binding.')
    return nodule
  }

  return this.wrap(nodule, property, function wrapFunc(shim, func) {
    if (!shim.isFunction(func)) {
      return func
    }

    // Wrap up the function with this segment.
    segment = segment || shim.getSegment()
    if (!segment) {
      return func
    }

    const binder = _makeBindWrapper(shim, func, segment, full || false)
    shim.storeSegment(binder, segment)
    return binder
  })
}

/**
 * Replaces the callback in an arguments array with one that has been bound to
 * the given segment.
 *
 * - `bindCallbackSegment(args, cbIdx [, segment])`
 * - `bindCallbackSegment(obj, property [, segment])`
 *
 * @memberof Shim.prototype
 * @param {Array | object} args
 *  The arguments array to pull the cb from.
 * @param {number|string} cbIdx
 *  The index of the callback.
 * @param {TraceSegment} [parentSegment]
 *  The segment to use as the callback segment's parent. Defaults to the
 *  currently active segment.
 * @see Shim#bindSegment
 */
function bindCallbackSegment(args, cbIdx, parentSegment) {
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

  // Pull out the callback and make sure it is a function.
  const cb = args[cbIdx]
  if (this.isFunction(cb)) {
    const shim = this
    const realParent = parentSegment || shim.getSegment()
    args[cbIdx] = shim.wrap(cb, null, function callbackWrapper(shim, fn, name) {
      return function wrappedCallback() {
        if (realParent) {
          realParent.opaque = false
        }
        const segment = _rawCreateSegment(
          shim,
          new specs.SegmentSpec({
            name: 'Callback: ' + name,
            parent: realParent
          })
        )

        if (segment) {
          segment.async = false
        }

        // CB may end the transaction so update the parent's time preemptively.
        realParent && realParent.touch()
        return shim.applySegment(cb, segment, true, this, arguments)
      }
    })
    shim.storeSegment(args[cbIdx], realParent)
  }
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

  return this._contextManager.getContext()
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
  if (segment && segment.transaction && segment.transaction.isActive()) {
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
  this._contextManager.setContext(segment)
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

/* eslint-disable max-params */
/**
 * Sets the given segment as the active one for the duration of the function's
 * execution.
 *
 * - `applySegment(func, segment, full, context, args[, inContextCB])`
 *
 * @memberof Shim.prototype
 * @param {Function} func The function to execute in the context of the given segment.
 * @param {TraceSegment} segment The segment to make active for the duration of the function.
 * @param {boolean} full Indicates if the full lifetime of the segment is bound to this function.
 * @param {*} context The `this` argument for the function.
 * @param {Array.<*>} args The arguments to be passed into the function.
 * @param {Function} [inContextCB] The function used to do more instrumentation work. This function is
 *  guaranteed to be executed with the segment associated with.
 * @returns {*} Whatever value `func` returned.
 */
function applySegment(func, segment, full, context, args, inContextCB) {
  // Exist fast for bad arguments.
  if (!this.isFunction(func)) {
    return
  }

  if (!segment) {
    this.logger.trace('No segment to apply to function.')
    return fnApply.call(func, context, args)
  }

  this.logger.trace('Applying segment %s', segment.name)

  const contextManager = this._contextManager
  const prevSegment = contextManager.getContext()

  return contextManager.runInContext(segment, function runInContextCb() {
    if (full) {
      segment.start()
    }

    if (typeof inContextCB === 'function') {
      inContextCB(segment)
    }

    try {
      return fnApply.call(func, context, args)
    } catch (error) {
      if (prevSegment === null && process.domain != null) {
        process.domain[symbols.segment] = contextManager.getContext()
      }

      throw error // Re-throwing application error, this is not an agent error.
    } finally {
      if (full) {
        segment.touch()
      }
    }
  })
}
/* eslint-enable max-params */

/**
 * Creates a new segment.
 *
 * - `createSegment(opts)`
 * - `createSegment(name [, recorder] [, parent])`
 *
 * @memberof Shim.prototype
 * @param {string} name
 *  The name to give the new segment.
 * @param {?Function} [recorder=null]
 *  Optional. A function which will record the segment as a metric. Default is
 *  to not record the segment.
 * @param {TraceSegment} [parent]
 *  Optional. The segment to use as the parent. Default is to use the currently
 *  active segment.
 * @returns {?TraceSegment} A new trace segment if a transaction is active, else
 *  `null` is returned.
 */
function createSegment(name, recorder, parent) {
  let opts = null
  if (this.isString(name)) {
    // createSegment(name [, recorder] [, parent])
    opts = new specs.SegmentSpec({ name })

    // if the recorder arg is not used, it can either be omitted or null
    if (this.isFunction(recorder) || this.isNull(recorder)) {
      // createSegment(name, recorder [, parent])
      opts.recorder = recorder
      opts.parent = parent
    } else {
      // createSegment(name [, parent])
      opts.parent = recorder
    }
  } else {
    // createSegment(opts)
    opts = name
  }

  return _rawCreateSegment(this, opts)
}

/**
 * @param shim
 * @param opts
 */
function _rawCreateSegment(shim, opts) {
  // Grab parent segment when none in opts so we can check opaqueness
  opts.parent = opts.parent || shim.getActiveSegment()

  // When parent exists and is opaque, no new segment will be created
  // by tracer.createSegment and the parent will be returned. We bail
  // out early so we do not risk modifying the parent segment.
  if (opts.parent && opts.parent.opaque) {
    shim.logger.trace(opts, 'Did not create segment because parent is opaque')
    return opts.parent
  }

  const segment = shim.tracer.createSegment(opts.name, opts.recorder, opts.parent)
  if (segment) {
    segment.internal = opts.internal
    segment.opaque = opts.opaque
    segment.shim = shim

    if (hasOwnProperty(opts, 'parameters')) {
      shim.copySegmentParameters(segment, opts.parameters)
    }
    shim.logger.trace(opts, 'Created segment')
  } else {
    shim.logger.debug(opts, 'Failed to create segment')
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
  return obj instanceof Object
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
 */
function argsToArray() {
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
 * not already have that property.
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
    if (!hasOwnProperty(obj, key)) {
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

  properties.forEach(function forEachProxyProp(prop) {
    Object.defineProperty(dest, prop, {
      get: function proxyGet() {
        return source[prop]
      },
      set: function proxySet(val) {
        return (source[prop] = val)
      }
    })
  })
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
    this._wrapped.forEach(function unwrapEach(wrapped) {
      this.unwrap(wrapped)
    }, this)
  }
}

// -------------------------------------------------------------------------- //

/**
 * Coerces the given spec into a function which {@link Shim#wrap} can use.
 *
 * @private
 * @param {Spec|WrapFunction} spec - The spec to coerce into a function.
 * @returns {WrapFunction} The spec itself if spec is a function, otherwise a
 *  function which will execute the spec when called.
 */
/* eslint-disable no-unused-vars */
/**
 * @param spec
 */
function _specToFunction(spec) {
  throw new Error('Declarative specs are not implemented yet.')
}
/* eslint-enable no-unused-vars */

/**
 * Assigns the shim id and original on the wrapped item.
 * TODO: Once all wrapping is converted to proxies, we won't need to
 * set this property as the trap on 'get' will return the original for
 * symbols.original. For now, we have to prevent setting this on original.
 *
 * @param {*} wrapped wrapped item
 * @param {*} original * The item being wrapped.
 * @param {boolean} forceOrig flag to indicate to overwrite original function
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
 * @param {Array.<*>} [args=[]]
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
 * @param {Function} fn
 *  The function to be bound to the segment.
 * @param {TraceSegment} segment
 *  The segment the function is bound to.
 * @param {boolean} full
 *  Indicates if the segment's full lifetime is bound to the function.
 * @returns {Function} A function which wraps `fn` and makes the given segment
 *  active for the duration of its execution.
 */
function _makeBindWrapper(shim, fn, segment, full) {
  return function wrapper() {
    return shim.applySegment(fn, segment, full, this, arguments)
  }
}

/**
 * Binds all callbacks identified in the given spec.
 *
 * The callbacks are bound using the method meant for that type if available
 * (i.e. `bindRowCallbackSegment` for `rowCallback`), but will fall back to the
 * generic callback binding method, `bindCallbackSegment`, otherwise.
 *
 * @this *
 * @private
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
  if (hasOwnProperty(spec.spec, 'callback') && spec.spec.callback !== null) {
    _bindCallback(this, spec.spec.callback, shim.bindCallbackSegment)
  }

  // And check for a row callback.
  if (hasOwnProperty(spec.spec, 'rowCallback') && spec.spec.rowCallback !== null) {
    _bindCallback(
      this,
      spec.spec.rowCallback,
      shim.bindRowCallbackSegment || shim.bindCallbackSegment
    )
  }

  /**
   * @param context
   * @param callback
   * @param binder
   */
  function _bindCallback(context, callback, binder) {
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
  const specEvent = (spec && spec.event) || null
  const shouldCreateSegment = (spec && spec.shouldCreateSegment) || false
  const segmentName = 'Event callback: ' + specEvent

  // Wrap emit such that each event handler is executed within context of this
  // segment or the event-specific segment.
  shim.wrap(stream, 'emit', function wrapStreamEmit(shim, emit) {
    const tx = segment.transaction
    const streamBoundEmit = shim.bindSegment(emit, segment, true)
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
          eventSegment = shim.createSegment(segmentName, segment)
          eventBoundEmit = shim.bindSegment(emit, eventSegment, true)
        }
        eventSegment.addAttribute('count', ++emitCount)
        emitToCall = eventBoundEmit
      }
      if (evnt === 'end' || evnt === 'error') {
        segment.opaque = false
        segment.touch()
      }

      return emitToCall.apply(this, arguments)
    }
  })

  // Also wrap up any listeners for end or error events.
  shim.wrap(stream, ['on', 'addListener'], function wrapOn(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }

    return function wrappedOn(onEvent) {
      if (onEvent !== specEvent && (onEvent === 'end' || onEvent === 'error')) {
        const args = argsToArray.apply(shim, arguments)
        shim.bindCallbackSegment(args, shim.LAST, segment)
        return fn.apply(this, args)
      }
      return fn.apply(this, arguments)
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
 * @param {class} Base
 *  The es6 class to be wrapped.
 * @param {string} fnName
 *  The name of the base class.
 * @param {ClassWrapSpec} spec
 *  The spec with pre- and post-execution hooks to call.
 * @param {Array.<*>} args
 *  Extra arguments to pass through to the pre- and post-execution hooks.
 * @returns {class} A class that extends Base with execution hooks.
 */
function _es6WrapClass(shim, Base, fnName, spec, args) {
  return class WrappedClass extends Base {
    constructor() {
      const cnstrctArgs = shim.argsToArray.apply(shim, arguments)
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
   *
   */
  function WrappedClass() {
    const cnstrctArgs = argsToArray.apply(shim, arguments)
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
 * Method for prefixing Route (aka URL) parameters with `request.parameters.route`
 *
 * Many web frameworks support adding parameters to routes when defining your API structure, and this function
 * updates those parameters names to be prefixed by `request.parameters.route`. This is to avoid collision with reserved
 * attribute names, as parameters used to be blindly stored on router span attributes (see https://github.com/newrelic/node-newrelic/issues/1574)
 * in addition to being prefixed by `request.parameters`.
 *
 * Route parameters used to be stored under `request.parameters.*` just like query parameters pre v10, but we
 * now prefix with `request.parameter.route` to avoid collision in the event an application uses the same name for a query and route
 * parameter. Additionally, we now store the same key on the attributes of the base segment, trace, and router span.
 *
 * Exported on shim to be used in our Next.js instrumentation, as that instrumentation does not follow the same pattern as all the other
 * web frameworks we support.
 *
 * @param {object} params - Object containing route/url parameter key/value pairs
 * @returns {object} the updated object, `key` will now be `request.parameters.route.key`, value remains untouched
 */
function prefixRouteParameters(params) {
  if (params && isObject(params)) {
    return Object.fromEntries(
      Object.entries(params).map(([key, value]) => [`request.parameters.route.${key}`, value])
    )
  }
}
