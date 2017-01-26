'use strict'

var events = require('events')
var logger = require('../logger.js').child({component: 'Shim'})
var Transaction = require('../transaction')
var util = require('util')


/**
 * Enumeration of argument indexes.
 *
 * Anywhere that an argument index is used, one of these or a direct integer
 * value can be used. These are just named constants to improve readability.
 *
 * Each of these values is also exposed directly on the DatastoreShim class as
 * static members.
 *
 * @readonly
 * @memberof Shim.prototype
 * @enum {number}
 */
var ARG_INDEXES = {
  FIRST: 0,
  SECOND: 1,
  THIRD: 2,
  FOURTH: 3,
  LAST: -1
}

/**
 * Enumeration of transaction types.
 *
 * Each of these values is also exposed directly on the DatastoreShim class as
 * static members.
 *
 * @readonly
 * @memberof Shim.prototype
 * @enum {string}
 */
var TRANSACTION_TYPES = {
  BG: 'bg',
  WEB: 'web'
}

/**
 * Enumeration of segment parameters which ignore the `capture_params`
 * configuration value.
 *
 * @readonly
 * @enum {boolean}
 */
var IGNORES_CAPTURE_PARAMS = {
  host: true,
  port_path_or_id: true,
  database_name: true
}


/**
 * Constructs a shim associated with the given agent instance.
 *
 * @constructor
 * @classdesc
 *  A helper class for wrapping modules with segments.
 *
 * @param {Agent}   agent       - The agent this shim will use.
 * @param {string}  moduleName  - The name of the module being instrumented.
 */
function Shim(agent, moduleName) {
  if (!agent || !moduleName) {
    throw new Error('Shim must be initialized with an agent and module name.')
  }

  this._logger = logger.child({module: moduleName})
  this._agent = agent
  this.defineProperty(this, 'moduleName', moduleName)
}
module.exports = Shim

Shim.defineProperty = defineProperty
Shim.defineProperties = defineProperties

// Copy the argument index enumeration onto the shim.
Shim.prototype.ARG_INDEXES = ARG_INDEXES
defineProperties(Shim.prototype, ARG_INDEXES)

// Copy the transaction type enumeration onto the shim.
Shim.prototype.TRANSACTION_TYPES = TRANSACTION_TYPES
defineProperties(Shim.prototype, TRANSACTION_TYPES)

// Define other miscellaneous properties of the shim.
defineProperties(Shim.prototype, {
  /**
   * The agent associated with this shim.
   *
   * @readonly
   * @member {Agent} Shim.prototype.agent
   */
  agent: function getAgent() {
    return this._agent
  },

  /**
   * The tracer in use by the agent for the shim.
   *
   * @readonly
   * @member {Tracer} Shim.prototype.tracer
   */
  tracer: function getTracer() {
    return this._agent.tracer
  },

  /**
   * The logger for this shim.
   *
   * @readonly
   * @member {Logger} Shim.prototype.logger
   */
  logger: function getLogger() {
    return this._logger
  }
})

// These two methods need to know if the AST transform is enabled. If it is not,
// extra work maintaining the transaction must be done.
//
// TODO: Create versions that don't care about the transaction tracing.
Shim.prototype.wrap = wrap
Shim.prototype.bindSegment = bindSegment

Shim.prototype.execute = execute
Shim.prototype.wrapReturn = wrapReturn
Shim.prototype.wrapClass = wrapClass
Shim.prototype.record = record
Shim.prototype.isWrapped = isWrapped
Shim.prototype.unwrap = unwrap
Shim.prototype.getSegment = getSegment
Shim.prototype.storeSegment = storeSegment
Shim.prototype.bindCreateTransaction = bindCreateTransaction
Shim.prototype.bindCallbackSegment = bindCallbackSegment
Shim.prototype.applySegment = applySegment
Shim.prototype.createSegment = createSegment
Shim.prototype.getName = getName
Shim.prototype.isObject = isObject
Shim.prototype.isFunction = isFunction
Shim.prototype.isString = isString
Shim.prototype.isNumber = isNumber
Shim.prototype.isBoolean = isBoolean
Shim.prototype.isArray = isArray
Shim.prototype.toArray = toArray
Shim.prototype.argsToArray = argsToArray
Shim.prototype.normalizeIndex = normalizeIndex
Shim.prototype.listenerCount = listenerCount
Shim.prototype.once = once
Shim.prototype.setInternalProperty = setInternalProperty
Shim.prototype.defineProperty = defineProperty
Shim.prototype.defineProperties = defineProperties
Shim.prototype.enableDebug = enableDebug
Shim.prototype.__NR_unwrap = unwrapAll

// -------------------------------------------------------------------------- //

/**
 * @callback WrapFunction
 *
 * @summary
 *  A function which performs the actual wrapping logic.
 *
 * @description
 *  If the return value of this function is not `original` then the return value
 *  will be marked as a wrapper.
 *
 * @param {Shim} shim
 *  The shim this function was passed to.
 *
 * @param {Object|Function} original
 *  The item which needs wrapping. Most of the time this will be a function.
 *
 * @param {string} name
 *  The name of `original` if it can be determined, otherwise `'<anonymous>'`.
 *
 * @return {*} The wrapper for the original, or the original value itself.
 */

/**
 * @private
 * @callback ArrayWrapFunction
 *
 * @description
 *   A wrap function used on elements of an array. In addition to the parameters
 *   of `WrapFunction`, these also receive an `index` and `total` as described
 *   below.
 *
 * @see WrapFunction
 *
 * @param {number} index - The index of the current element in the array.
 * @param {number} total - The total number of items in the array.
 */

/**
 * @private
 * @callback ArgumentsFunction
 *
 * @param {Shim} shim
 *  The shim this function was passed to.
 *
 * @param {Function} func
 *  The function these arguments were passed to.
 *
 * @param {*} context
 *  The context the function is executing under (i.e. `this`).
 *
 * @param {Array.<*>} args
 *  The arguments being passed into the function.
 */

/**
 * @callback SegmentFunction
 *
 * @summary
 *  A function which is called to compose a segment.
 *
 * @param {Shim} shim
 *  The shim this function was passed to.
 *
 * @param {Function} func
 *  The function the segment is created for.
 *
 * @param {string} name
 *  The name of the function.
 *
 * @param {Array.<*>} args
 *  The arguments being passed into the function.
 *
 * @return {string|SegmentSpec} The desired properties for the new segment.
 */

/**
 * @callback RecorderFunction
 *
 * @summary
 *  A function which is called to compose a segment for recording.
 *
 * @param {Shim} shim
 *  The shim this function was passed to.
 *
 * @param {Function} func
 *  The function being recorded.
 *
 * @param {string} name
 *  The name of the function.
 *
 * @param {Array.<*>} args
 *  The arguments being passed into the function.
 *
 * @return {string|RecorderSpec} The desired properties for the new segment.
 */

/**
 * @callback CallbackBindFunction
 *
 * @summary
 *  Performs segment binding on a callback function. Useful when identifying a
 *  callback is more complex than a simple argument offset.
 *
 * @param {Shim} shim
 *  The shim this function was passed to.
 *
 * @param {Function} func
 *  The function being recorded.
 *
 * @param {string} name
 *  The name of the function.
 *
 * @param {TraceSegment} segment
 *  The segment that the callback should be bound to.
 *
 * @param {Array.<*>} args
 *  The arguments being passed into the function.
 */

/**
 * @private
 * @callback MetricFunction
 *
 * @summary
 *  Measures all the necessary metrics for the given segment. This functionality
 *  is meant to be used by Shim subclasses, instrumentations should never create
 *  their own recorders.
 *
 * @param {TraceSegment}  segment - The segment to record.
 * @param {string}        [scope] - The scope of the recording.
 */

/**
 * @private
 * @interface Spec
 *
 * @description
 *  The syntax for declarative instrumentation. It can be used interlaced with
 *  custom, hand-written instrumentation for one-off or hard to simplifiy
 *  instrumentation logic.
 *
 * @property {Spec|WrapFunction} $return
 *  Changes the context to the return value of the current context. This means
 *  the sub spec will not be executed up front, but instead upon every execution
 *  of the current context.
 *
 *  ```js
 *  var ret = func.apply(this, args);
 *  return shim.wrap(ret, spec.$return)
 *  ```
 *
 * @property {Spec|WrapFunction} $proto
 *  Changes the context to the prototype of the current context. The prototype
 *  is found using `Object.getPrototypeOf`.
 *
 *  ```js
 *  shim.wrap(Object.getPrototypeOf(context), spec.$proto)
 *  ```
 *
 * @property {bool} $once
 *  Ensures that the parent spec will only be executed one time if the value is
 *  `true`. Good for preventing double wrapping of prototype methods.
 *
 *  ```js
 *  if (spec.$once && spec.__NR_onceExecuted) {
 *    return context
 *  }
 *  spec.__NR_onceExecuted = true
 *  ```
 *
 * @property {ArgumentsFunction} $arguments
 *  Executes the function with all of the arguments passed in. The arguments can
 *  be modified in place. This will execute before `$eachArgument`.
 *
 *  ```js
 *  spec.$arguments(args)
 *  ```
 *
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
 *
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
 *
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
 *
 * @property {Object.<string, *>} $cache
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
 *
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
 *
 * @property {Spec|WrapFunction} property
 *  Any field which does not start with a `$` is assumed to name a property on
 *  the current context which should be wrapped. This is simply shorthand for a
 *  `$wrappings` with only one `$properties` value.
 */

/**
 * @interface SegmentSpec
 *
 * @description
 *  The return value from a {@link SegmentFunction}, used to set the parameters
 *  of segment creation.
 *
 * @property {string} name
 *  The name for the segment to-be.
 *
 * @property {MetricFunction} [recorder]
 *  A metric recorder for the segment. This is purely for internal use by shim
 *  classes. Instrumentations should never implement their own metric functions.
 *
 * @property {TraceSegment} [parent]
 *  The parent segment. Defaults to the currently active segment.
 *
 * @see RecorderSpec
 * @see SegmentFunction
 */

/**
 * @interface RecorderSpec
 * @extends SegmentSpec
 *
 * @description
 *  The return value from a {@link RecorderFunction}, used to set the parameters
 *  of segment creation and lifetime. Extends the {@link SegmentSpec}.
 *
 * @property {bool|string} [stream]
 *  Indicates if the return value from the wrapped function is a stream. If the
 *  value is truthy then the recording will extend to the `end` event of the
 *  stream. If the value is a string it is assumed to be the name of an event to
 *  measure. A segment will be created to record emissions of the event.
 *
 * @property {bool} [promise]
 *  Indicates if the return value from the wrapped function is a Promise. If the
 *  value is truthy then the recording will extend to the completion of the
 *  Promise. A segment will be created to record completion of the Promise.
 *
 * @property {number|CallbackBindFunction} [callback]
 *  If this is a number, it identifies which argument is the callback and the
 *  segment will also be bound to the callback. Otherwise, the passed function
 *  should perform the segment binding itself.
 *
 * @property {number|CallbackBindFunction} [rowCallback]
 *  Like `callback`, this identifies a callback function in the arguments. The
 *  difference is that the default behavior for row callbacks is to only create
 *  one segment for all calls to the callback. This is mostly useful for
 *  functions which will be called repeatedly, such as once for each item in a
 *  result set.
 *
 * @property {bool} [internal=false]
 *  Marks this as the boundary point into the instrumented library. If `true`
 *  and the current segment is _also_ marked as `internal` by the same shim,
 *  then we will not record this inner activity.
 *
 *  This is useful when instrumenting a library which implements high-order
 *  methods which simply call other public methods and you only want to record
 *  the method directly called by the user while still instrumenting all
 *  endpoints.
 *
 * @see SegmentSpec
 * @see RecorderFunction
 */

/**
 * @interface TransactionSpec
 *
 * @description
 *  Describes the type of transaction to be created by the function being
 *  wrapped by {@link Shim#bindCreateTransaction}.
 *
 * @property {string} type
 *  The type of transaction to create. Must be one of the values from
 *  {@link Shim#TRANSACTION_TYPES}.
 *
 * @property {bool} [nest=false]
 *  Indicates if the transaction being created is allowed to be nested within
 *  another transaction of the same type. If `false`, the default, the transaction
 *  will only be created if there is no existing transaction, or the current
 *  transaction is of a different type. If `true`, the transaction will be
 *  created regardless of the current transaction's type.
 *
 * @see Shim#bindCreateTransaction
 * @see Shim#TRANSACTION_TYPES
 */

// -------------------------------------------------------------------------- //

/**
 * Entry point for executing a spec.
 *
 * @memberof Shim.prototype
 */
function execute(nodule, spec) {
  if (this.isFunction(spec)) {
    spec(this, nodule)
  } else {
    _specToFunction(spec)(this, nodule)
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
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {Spec|WrapFunction} spec
 *  The spec for wrapping these items.
 *
 * @param {Array.<*>} [args=[]]
 *  Optional extra arguments to be sent to the spec when executing it.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see WrapFunction
 */
function wrap(nodule, properties, spec, args) {
  if (!nodule) {
    this.logger.debug('Not wrapping non-existent nodule.')
    return nodule
  }

  // Sort out the parameters.
  if (this.isObject(properties) && !this.isArray(properties)) {
    // wrap(nodule, spec [,args])
    args = spec
    spec = properties
    properties = null
  }
  if (!this.isFunction(spec)) {
    spec = _specToFunction(spec)
  }

  // If we're just wrapping one thing, just wrap it and return.
  if (!properties) {
    this.logger.trace('Wrapping nodule itself.')
    return _wrap(this, nodule, this.getName(nodule), spec, args)
  }

  // Coerce properties into an array.
  if (!this.isArray(properties)) {
    properties = [properties]
  }

  // Wrap each property and return the nodule.
  this.logger.trace('Wrapping %d properties on nodule.', properties.length)
  properties.forEach(function forEachProperty(prop) {
    // Skip nonexistent properties.
    var original = nodule[prop]
    if (!original) {
      this.logger.debug('Not wrapping missing property "%s"', prop)
      return
    }

    // Wrap up the property and add a special unwrapper.
    var wrapped = _wrap(this, original, prop, spec, args)
    if (wrapped && wrapped !== original) {
      this.logger.trace('Replacing "%s" with wrapped version', prop)

      wrapped.prototype = nodule[prop].prototype
      nodule[prop] = wrapped
      this.setInternalProperty(wrapped, '__NR_unwrap', function unwrapWrap() {
        nodule[prop] = original
        return original
      })
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
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {Spec|WrapReturnFunction} spec
 *  The spec for wrapping the returned value from the properties.
 *
 * @param {Array.<*>} [args=[]]
 *  Optional extra arguments to be sent to the spec when executing it.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
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
    spec = _specToFunction(spec)
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

    return function wrappedReturnFn() {
      // Call the underlying function. If this was called as a constructor, call
      // the wrapped function as a constructor too.
      var ctx = this
      var ret = null
      if (this instanceof wrappedReturnFn) {
        var fnArgs = argsToArray.apply(shim, arguments)
        fnArgs.unshift(fn) // `unshift` === `push_front`
        ctx = ret = new (fn.bind.apply(fn, fnArgs))()
      } else {
        ret = fn.apply(ctx, arguments)
      }

      // Assemble the arguments to hand to the spec.
      var _args = [shim, fn, fnName, ret]
      if (args.length > 0) {
        _args.push.apply(_args, args)
      }

      // Call the spec and see if it handed back a different return value.
      var newRet = spec.apply(ctx, _args)
      if (newRet) {
        ret = newRet
      }

      return ret
    }
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
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the constructor to wrap.
 *
 * @param {Object|Function} spec
 *  The spec for wrapping the returned value from the properties or a post hook.
 *
 * @param {Function} spec.pre
 *  A function called with the constructor's arguments before the base class'
 *  constructor is executed.
 *
 * @param {Function} spec.post
 *  A function called with the constructor's arguments after the base class'
 *  constructor is executed.
 *
 * @param {Array.<*>} [args=[]]
 *  Optional extra arguments to be sent to the spec when executing it.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
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
    spec = {pre: null, post: spec}
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

    function WrappedClass() {
      var cnstrctArgs = argsToArray.apply(shim, arguments)
      if (!(this instanceof WrappedClass)) {
        // Some libraries support calling constructors without the `new` keyword.
        // In order to support this we must apply the super constructor if `this`
        // is not an instance of ourself. JavaScript really needs a better way
        // to generically apply constructors.
        cnstrctArgs.unshift(WrappedClass) // `unshift` === `push_front`
        return new (WrappedClass.bind.apply(WrappedClass, cnstrctArgs))()
      }

      // Assemble the arguments to hand to the spec.
      var _args = [shim, Base, fnName, cnstrctArgs]
      if (args.length > 0) {
        _args.push.apply(_args, args)
      }

      // Call the spec's before hook, then call the base constructor, then call
      // the spec's after hook.
      spec.pre && spec.pre.apply(this, _args)
      Base.apply(this, cnstrctArgs)
      spec.post && spec.post.apply(this, _args)
    }
    util.inherits(WrappedClass, Base)

    return WrappedClass
  })}

/**
 * Determines if the specified function or property exists and is wrapped.
 *
 * - `isWrapped(nodule, property)`
 * - `isWrapped(func)`
 *
 * @memberof Shim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the property or a single function to check.
 *
 * @param {string} [property]
 *  The property to check. If omitted, the `nodule` parameter is assumed to be
 *  the function to check.
 *
 * @return {bool} True if the item exists and has been wrapped.
 *
 * @see Shim#wrap
 * @see Shim#bindSegment
 */
function isWrapped(nodule, property) {
  if (property) {
    return !!(nodule && nodule[property] && nodule[property].__NR_original)
  }
  return !!(nodule && nodule.__NR_original)
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
 *
 * @param {Object|Function} nodule
 *  The source for the properties to record, or a single function to record.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to record. If omitted, the `nodule` parameter is
 *  assumed to be the function to record.
 *
 * @param {RecorderFunction} recordNamer
 *  A function which returns a record descriptor that gives the name and type of
 *  record we'll make.
 *
 * @return {Object|Function} The first parameter, possibly wrapped.
 *
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
      // See if we're in a transaction.
      if (!shim.getSegment()) {
        shim.logger.debug('Not recording function %s, not in a transaction.', name)
        return fn.apply(this, arguments)
      }

      // Create the segment that will be recorded.
      var args = argsToArray.apply(shim, arguments)
      var segDesc = recordNamer.call(this, shim, fn, name, args)
      if (!segDesc) {
        shim.logger.trace('No segment descriptor for "%s", not recording.', name)
        return fn.apply(this, args)
      }

      // Only create a segment if:
      //  - We are _not_ making an internal segment.
      //  - OR the parent segment is either not internal or not from this shim.
      var segment = null
      var parent = shim.getSegment()
      var shouldCreateSegment = !(
        segDesc.internal && parent && parent.internal && shim === parent.shim
      )
      if (shouldCreateSegment) {
        segment = shim.createSegment(segDesc)
      } else {
        segment = parent
      }

      // Now bind any callbacks specified in the segment descriptor.
      _bindAllCallbacks.call(this, shim, fn, name, args, {
        spec: segDesc,
        segment: segment,
        shouldCreateSegment: shouldCreateSegment
      })

      // Apply the function, and (if it returned a stream) bind that too.
      var ret = shim.applySegment(fn, segment, true, this, args)
      if (segment && ret) {
        if (segDesc.stream ) {
          shim.logger.trace('Binding return value as stream.')
          _bindStream(shim, ret, segment, {
            event: shim.isString(segDesc.stream) ? segDesc.stream : null,
            shouldCreateSegment: shouldCreateSegment
          })
        } else if (segDesc.promise) {
          shim.logger.trace('Binding return value as Promise.')
          _bindPromise(shim, ret, segment)
        }
      }
      return ret
    }
  })
}

/**
 * Unwraps one or more items, revealing the original value.
 *
 * - `unwrap(nodule, property)`
 * - `unwrap(func)`
 *
 * If called with a `nodule` and properties, the unwrapped values will be put
 * back on the nodule. Otherwise, the unwrapped function is just returned.
 *
 * @memberof Shim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the properties to unwrap, or a single function to unwrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to unwrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to unwrap.
 *
 * @return {Object|Function} The first parameter after unwrapping.
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

  this.logger.trace('Unwrapping %s', properties || '<nodule>')
  var original = properties ? nodule[properties] : nodule
  while (original && original.__NR_original) {
    original = this.isFunction(original.__NR_unwrap)
      ? original.__NR_unwrap()
      : original.__NR_original
  }
  return original
}

/**
 * Wraps one or more functions such that new transactions are created when
 * invoked.
 *
 * - `bindCreateTransaction(nodule, property, spec)`
 * - `bindCreateTransaction(func, spec)`
 *
 * @memberof Shim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the property to wrap, or a single function to wrap.
 *
 * @param {string} [property]
 *  The property to wrap. If omitted, the `nodule` parameter is assumed to be
 *  the function to wrap.
 *
 * @param {TransactionSpec} spec
 *  The spec for creating the transaction.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its property.
 */
function bindCreateTransaction(nodule, property, spec) {
  if (this.isObject(property) && !this.isArray(property)) {
    // bindCreateTransaction(nodule, spec)
    spec = property
    property = null
  }

  // Refuse to perform the wrapping if `spec.type` is not valid.
  if (spec.type !== this.WEB && spec.type !== this.BG) {
    this.logger.error(
      {stack: (new Error()).stack},
      'Invalid spec type "%s", must be "web" or "bg".',
      spec.type
    )
    return nodule
  }

  // Perform the actual wrapping.
  return this.wrap(nodule, property, function makeTransWrapper(shim, fn, name) {
    if (!shim.isFunction(fn)) {
      shim.logger.debug('Not wrapping "%s" with transaction, not a function.', name)
      return fn
    }

    // Is this transaction supposed to be nested? Pick the right wrapper for the
    // job.
    var makeWrapper = spec.nest ? _makeNestedTransWrapper : _makeTransWrapper
    return makeWrapper(shim, fn, name, spec)
  })
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
 *
 * @param {Object|Function} nodule
 *  The source for the property or a single function to bind to a segment.
 *
 * @param {string} [property]
 *  The property to bind. If omitted, the `nodule` parameter is assumed
 *  to be the function to bind the segment to.
 *
 * @param {?TraceSegment} [segment=null]
 *  The segment to bind the execution of the function to. If omitted or `null`
 *  the currently active segment will be bound instead.
 *
 * @param {bool} [full=false]
 *  Indicates if the full lifetime of the segment is bound to this function.
 *
 * @return {Object|Function} The first parameter after wrapping.
 */
function bindSegment(nodule, property, segment, full) {
  // Don't bind to null arguments.
  if (!nodule) {
    return nodule
  }

  // Determine our arguments.
  if (!property || !this.isString(property)) {
    // bindSegment(func, segment, full)
    full = segment
    segment = property
    property = null
  }

  return this.wrap(nodule, property, function wrapFunc(shim, func) {
    if (!shim.isFunction(func)) {
      return func
    }

    // Wrap up the function with this segment.
    segment = segment || shim.getSegment()
    var wrapped = _makeBindWrapper(shim, func, segment, full || false)
    shim.storeSegment(wrapped, segment)
    return wrapped
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
 *
 * @param {Array|Object} args
 *  The arguments array to pull the cb from.
 *
 * @param {number|string} cbIdx
 *  The index of the callback.
 *
 * @param {TraceSegment} [parentSegment]
 *  The segment to use as the callback segment's parent. Defaults to the
 *  currently active segment.
 *
 * @see Shim#bindSegment
 */
function bindCallbackSegment(args, cbIdx, parentSegment) {
  if (!args) {
    return
  }

  if (this.isNumber(cbIdx)) {
    var normalizedCBIdx = normalizeIndex(args.length, cbIdx)
    if (normalizedCBIdx === null) {
      // Bad index.
      this.logger.debug(
        'Invalid index %d for args of length %d, not binding callback segment',
        cbIdx, args.length
      )
      return
    }
    cbIdx = normalizedCBIdx
  }

  // Pull out the callback and make sure it is a function.
  var cb = args[cbIdx]
  if (this.isFunction(cb)) {
    var segmentName = 'Callback: ' + this.getName(cb)
    var shim = this

    // Wrap up the callback, both binding it to the parent _and_ creating a new
    // segment when called.
    var wrapper = this.bindSegment(function callbackWrapper() {
      var realParent = parentSegment || shim.getSegment()
      var segment = shim.createSegment(segmentName, realParent)
      if (segment) {
        segment.async = false
      }

      try {
        return shim.applySegment(cb, segment, true, this, arguments)
      } finally {
        realParent && realParent.touch()
      }
    }, parentSegment)
    this.setInternalProperty(wrapper, '__NR_original', cb)
    args[cbIdx] = wrapper
  }
}

/**
 * Retrieves the segment associated with the given object, or the currently
 * active segment if no object is given.
 *
 * - `getSegment([obj])`
 *
 * @memberof Shim.prototype
 *
 * @param {*} [obj] - The object to retrieve a segment from.
 *
 * @return {?TraceSegment} The trace segment associated with the given object or
 *  the currently active segment if no object is provided or no segment is
 *  associated with the object.
 */
function getSegment(obj) {
  if (obj && obj.__NR_segment) {
    return obj.__NR_segment
  }
  return this.tracer.getSegment()
}

/**
 * Associates a segment with the given object.
 *
 * - `storeSegment(obj [, segment])`
 *
 * If no segment is provided, the currently active segment is used.
 *
 * @memberof Shim.prototype
 *
 * @param {!*}            obj       - The object to retrieve a segment from.
 * @param {TraceSegment}  [segment] - The segment to link the object to.
 */
function storeSegment(obj, segment) {
  this.setInternalProperty(obj, '__NR_segment', segment || this.tracer.getSegment())
}

/**
 * Sets the given segment as the active one for the duration of the function's
 * execution.
 *
 * - `applySegment(func, segment, full, context, args)`
 *
 * @memberof Shim.prototype
 *
 * @param {Function} func
 *  The function to execute in the context of the given segment.
 *
 * @param {TraceSegment} segment
 *  The segment to make active for the duration of the function.
 *
 * @param {bool} full
 *  Indicates if the full lifetime of the segment is bound to this function.
 *
 * @param {*} context
 *  The `this` argument for the function.
 *
 * @param {Array.<*>} args
 *  The arguments to be passed into the function.
 *
 * @return {*} Whatever value `func` returned.
 */
function applySegment(func, segment, full, context, args) {
  // Exist fast for bad arguments.
  if (!this.isFunction(func)) {
    return
  }

  if (!segment) {
    this.logger.trace('No segment to apply to function.')
    return func.apply(context, args)
  }
  this.logger.trace('Applying segment %s', segment.name)

  // Set this segment as the current one on the tracer.
  var tracer = this.tracer
  var prevSegment = tracer.segment
  tracer.segment = segment
  if (full) {
    segment.start()
  }

  // Execute the function and then return the tracer segment to the old one.
  try {
    return func.apply(context, args)
  } finally {
    if (full) {
      segment.touch()
    }
    tracer.segment = prevSegment
  }
}

/**
 * Creates a new segment.
 *
 * - `createSegment(opts)`
 * - `createSegment(name [, recorder] [, parent])`
 *
 * @memberof Shim.prototype
 *
 * @param {string} name
 *  The name to give the new segment.
 *
 * @param {?Function} [recorder=null]
 *  Optional. A function which will record the segment as a metric. Default is
 *  to not record the segment.
 *
 * @param {TraceSegment} [parent]
 *  Optional. The segment to use as the parent. Default is to use the currently
 *  active segment.
 *
 * @return {?TraceSegment} A new trace segment if a transaction is active, else
 *  `null` is returned.
 */
function createSegment(name, recorder, parent) {
  var opts = null
  if (this.isString(name)) {
    // createSegment(name [, recorder] [, parent])
    opts = {name: name}

    if (this.isFunction(recorder)) {
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

  var segment = this.tracer.createSegment(opts.name, opts.recorder, opts.parent)
  if (segment) {
    segment.internal = opts.internal
    segment.shim = this
  }

  if (segment && opts.hasOwnProperty('extras')) {
    var ignoredParams = this.agent.config.ignored_params
    var captureParams = this.agent.config.capture_params
    for (var key in opts.extras) {
      if (
        opts.extras.hasOwnProperty(key) && (
          IGNORES_CAPTURE_PARAMS.hasOwnProperty(key) ||
          (captureParams && ignoredParams.indexOf(key) === -1)
        )
      ) {
        segment.setParameter(key, opts.extras[key])
      }
    }
  }
  this.logger.trace(
    {segment: opts},
    (segment ? 'Created segment' : 'Failed to create segment')
  )

  return segment
}

/**
 * Determine the name of an object.
 *
 * @memberof Shim.prototype
 *
 * @param {*} obj - The object to get a name for.
 *
 * @return {string} The name of the object if it has one, else `<anonymous>`.
 */
function getName(obj) {
  return String((!obj || obj === true) ? obj : (obj.name || '<anonymous>'))
}

/**
 * Determines if the given object is an Object.
 *
 * @memberof Shim.prototype
 *
 * @param {*} obj - The object to check.
 *
 * @return {bool} True if the object is an Object, else false.
 */
function isObject(obj) {
  return obj instanceof Object
}

/**
 * Determines if the given object exists and is a function.
 *
 * @memberof Shim.prototype
 *
 * @param {*} obj - The object to check.
 *
 * @return {bool} True if the object is a function, else false.
 */
function isFunction(obj) {
  return obj instanceof Function
}

/**
 * Determines if the given object exists and is a string.
 *
 * @memberof Shim.prototype
 *
 * @param {*} obj - The object to check.
 *
 * @return {bool} True if the object is a string, else false.
 */
function isString(obj) {
  return typeof obj === 'string'
}

/**
 * Determines if the given object is a number literal.
 *
 * @memberof Shim.prototype
 *
 * @param {*} obj - The object to check.
 *
 * @return {bool} True if the object is a number literal, else false.
 */
function isNumber(obj) {
  return typeof obj === 'number'
}

/**
 * Determines if the given object is a boolean literal.
 *
 * @memberof Shim.prototype
 *
 * @param {*} obj - The object to check.
 *
 * @return {bool} True if the object is a boolean literal, else false.
 */
function isBoolean(obj) {
  return typeof obj === 'boolean'
}

/**
 * Determines if the given object exists and is an array.
 *
 * @memberof Shim.prototype
 *
 * @param {*} obj - The object to check.
 *
 * @return {bool} True if the object is an array, else false.
 */
function isArray(obj) {
  return obj instanceof Array
}

/**
 * Converts an array-like object into an array.
 *
 * @memberof Shim.prototype
 *
 * @param {*} obj - The array-like object (i.e. `arguments`).
 *
 * @return {Array.<*>} An instance of `Array` containing the elements of the
 *  array-like.
 */
function toArray(obj) {
  var len = obj.length
  var arr = new Array(len)
  for (var i = 0; i < len; ++i) {
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
 *
 * @return {Array} An array containing the elements of `arguments`.
 *
 * @see Shim#toArray
 * @see https://github.com/petkaantonov/bluebird/wiki/Optimization-killers
 */
function argsToArray() {
  var len = arguments.length
  var arr = new Array(len)
  for (var i = 0; i < len; ++i) {
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
 *
 * @param {number} arrayLength  - The length of the array this index is for.
 * @param {number} idx          - The index to normalize.
 *
 * @return {?number} The adjusted index value if it is valid, else `null`.
 */
function normalizeIndex(arrayLength, idx) {
  if (idx < 0) {
    idx = arrayLength + idx
  }
  return (idx < 0 || idx >= arrayLength) ? null : idx
}

/**
 * Retrieves the number of listeners for the given event.
 *
 * @memberof Shim.prototype
 *
 * @param {object} emitter  - The emitter to count the listeners on.
 * @param {string} event    - The event to count.
 *
 * @return {number} The number of listeners on the given event for this emitter.
 */
function listenerCount(emitter, evnt) {
  if (events.EventEmitter.listenerCount) {
    return events.EventEmitter.listenerCount(emitter, evnt)
  }
  return emitter.listeners(evnt).length
}

/**
 * Wraps a function such that it will only be executed once.
 *
 * @memberof Shim.prototype
 *
 * @param {function} fn - The function to wrap in an execution guard.
 *
 * @return {function} A function which will execute `fn` at most once.
 */
function once(fn) {
  var called = false
  return function onceCaller() {
    if (!called) {
      called = true
      return fn.apply(this, arguments)
    }
  }
}

/**
 * Sets a property to the given value. If the property doesn't exist yet it will
 * be made writable and non-enumerable.
 *
 * @memberof Shim.prototype
 *
 * @param {!object} obj   - The object to add the property to.
 * @param {!string} name  - The name for this property.
 * @param {*}       val   - The value to set the property as.
 *
 * @return {object} The `obj` value.
 */
function setInternalProperty(obj, name, val) {
  if (!obj || !name) {
    this.logger.debug('Not setting property; object or name is missing.')
    return obj
  }

  try {
    if (!obj.hasOwnProperty(name)) {
      Object.defineProperty(obj, name, {
        enumerable: false,
        writable: true,
        value: val
      })
    } else {
      obj[name] = val
    }
  } catch (err) {
    this.logger.debug({err: err}, 'Failed to set property "%s" to %j', name, val)
  }
  return obj
}

/**
 * Defines a read-only property on the given object.
 *
 * @memberof Shim.prototype
 *
 * @param {object} obj
 *  The object to add the property to.
 *
 * @param {string} name
 *  The name of the property to add.
 *
 * @param {*|function} value
 *  The value to set. If a function is given, it is used as a getter, otherwise
 *  the value is directly set as an unwritable property.
 */
function defineProperty(obj, name, value) {
  // We have define property! Use that.
  var prop = {
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
 *
 * @param {object} obj    - The object to add the properties to.
 * @param {object} props  - A mapping of properties to values to add.
 *
 * @see Shim#defineProperty
 */
function defineProperties(obj, props) {
  var keys = Object.keys(props)
  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i]
    defineProperty(obj, key, props[key])
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
 * @member Shim.prototype.__NR_unwrap
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
 *
 * @param {Spec|WrapFunction} spec - The spec to coerce into a function.
 *
 * @return {WrapFunction} The spec itself if spec is a function, otherwise a
 *  function which will execute the spec when called.
 */
/* eslint-disable no-unused-vars */
function _specToFunction(spec) {
  throw new Error('Declarative specs are not implemented yet.')
}
/* eslint-enable no-unused-vars */

/**
 * Executes the provided spec on the given object.
 *
 * - `_wrap(shim, original, name, spec [, args])`
 *
 * @private
 *
 * @param {Shim} shim
 *  The shim that is executing the wrapping.
 *
 * @param {*} original
 *  The object being wrapped.
 *
 * @param {string} name
 *  A logical name for the item to be wrapped.
 *
 * @param {WrapFunction} spec
 *  The spec for wrapping these items.
 *
 * @param {Array.<*>} [args=[]]
 *  Optional extra arguments to be sent to the spec when executing it.
 *
 * @return {Function} The return value from `spec` or the original value if it
 *  did not return anything.
 */
function _wrap(shim, original, name, spec, args) {
  // Assemble the spec's arguments.
  var specArgs = [shim, original, name]
  if (args && args.length) {
    specArgs.push.apply(specArgs, args)
  }

  // Apply the spec and see if it returned a wrapped version of the property.
  var wrapped = spec.apply(null, specArgs)
  if (wrapped && wrapped !== original) {
    shim.setInternalProperty(wrapped, '__NR_original', original)
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
 *
 * @param {Shim} shim
 *  The shim used for the binding.
 *
 * @param {function} fn
 *  The function to be bound to the segment.
 *
 * @param {TraceSegment} segment
 *  The segment the function is bound to.
 *
 * @param {boolean} full
 *  Indicates if the segment's full lifetime is bound to the function.
 *
 * @return {function} A function which wraps `fn` and makes the given segment
 *  active for the duration of its execution.
 */
function _makeBindWrapper(shim, fn, segment, full) {
  return function wrapper() {
    return shim.applySegment(fn, segment, full, this, arguments)
  }
}

/**
 * Creates a function that binds transactions to the execution of the function.
 *
 * The created transaction may be nested within an existing transaction if
 * `spec.type` is not the same as the current transaction's type.
 *
 * @private
 *
 * @param {Shim} shim
 *  The shim used for the binding.
 *
 * @param {function} fn
 *  The function link with the transaction.
 *
 * @param {string} name
 *  The name of the wrapped function.
 *
 * @param {TransactionSpec} spec
 *  The spec for the transaction to create.
 *
 * @return {function} A function which wraps `fn` and creates potentially nested
 *  transactions linked to its execution.
 */
function _makeNestedTransWrapper(shim, fn, name, spec) {
  return function nestedTransactionWrapper() {
    // don't nest transactions, reuse existing ones
    var transaction = shim.tracer.getTransaction()
    var segment = shim.tracer.segment

    // Only create a new transaction if we either do not have a current
    // transaction _or_ the current transaction is not of the type we want.
    if (!transaction || spec.type !== transaction.type) {
      shim.logger.trace('Creating new nested %s transaction for %s', spec.type, name)
      transaction = new Transaction(shim.agent)
      transaction.type = spec.type
      segment = transaction.trace.root
      transaction[spec.type + 'Segment'] = segment
    }

    return shim.applySegment(fn, segment, false, this, arguments)
  }
}

/**
 * Creates a function that binds transactions to the execution of the function.
 *
 * A transaction will only be created if there is not a currently active one.
 *
 * @private
 *
 * @param {Shim} shim
 *  The shim used for the binding.
 *
 * @param {function} fn
 *  The function link with the transaction.
 *
 * @param {string} name
 *  The name of the wrapped function.
 *
 * @param {TransactionSpec} spec
 *  The spec for the transaction to create.
 *
 * @return {function} A function which wraps `fn` and potentially creates a new
 *  transaction linked to the function's execution.
 */
function _makeTransWrapper(shim, fn, name, spec) {
  return function transactionWrapper() {
    // Don't nest transactions, reuse existing ones!
    if (shim.tracer.getTransaction()) {
      return fn.apply(this, arguments)
    }

    shim.logger.trace('Creating new %s transaction for %s', spec.type, name)
    var transaction = new Transaction(shim.agent)
    transaction.type = spec.type
    transaction[spec.type + 'Segment'] = transaction.trace.root
    return shim.applySegment(fn, transaction.trace.root, false, this, arguments)
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
 *
 * @param {Shim} shim
 *  The shim performing this binding.
 *
 * @param {Function} fn
 *  The function the spec describes.
 *
 * @param {string} name
 *  The name of the function the spec describes.
 *
 * @param {Array} args
 *  The arguments to be passed into `fn`.
 *
 * @param {object} spec
 *  The specification for bind the callbacks.
 *
 * @param {SegmentSpec} spec.spec
 *  The segment specification for the function we're pulling callbacks out of.
 *
 * @param {TraceSegment} spec.segment
 *  The segment measuring the function which will be the parent of any callback
 *  segments that may be created.
 *
 * @param {bool} spec.shouldCreateSegment
 *  Flag indicating if we should create segments for the callbacks. We almost
 *  always do, but in the special case of nested internal methods we do not.
 */
function _bindAllCallbacks(shim, fn, name, args, spec) {
  // Check for a normal callback.
  if ('callback' in spec.spec && spec.spec.callback !== null) {
    _bindCallback(this, spec.spec.callback, shim.bindCallbackSegment)
  }

  // And check for a row callback.
  if ('rowCallback' in spec.spec && spec.spec.rowCallback !== null) {
    _bindCallback(
      this,
      spec.spec.rowCallback,
      shim.bindRowCallbackSegment || shim.bindCallbackSegment
    )
  }

  function _bindCallback(context, callback, binder) {
    if (shim.isFunction(callback)) {
      callback.call(context, shim, fn, name, spec.segment, args)
    } else if (shim.isNumber(callback)) {
      shim.logger.trace({
        cbIdx: callback,
        hasSegment: !!spec.segment
      }, 'Binding callback segment')
      var cbIdx = normalizeIndex(args.length, callback)
      if (cbIdx !== null) {
        if (spec.shouldCreateSegment) {
          binder.call(shim, args, cbIdx, spec.segment)
        } else {
          args[cbIdx] = shim.bindSegment(args[cbIdx])
        }
      }
    }
  }
}

/**
 * Binds the given segment to the lifetime of the stream.
 *
 * @private
 *
 * @param {Shim} shim
 *  The shim performing the wrapping/binding.
 *
 * @param {EventEmitter} stream
 *  The stream to bind.
 *
 * @param {?TraceSegment} segment
 *  The segment to bind to the stream.
 *
 * @param {Object} [spec]
 *  Specification for how to bind the stream. The `end` and `error` events will
 *  always be bound, so if no functionality is desired beyond that, then this
 *  parameter may be omitted.
 *
 * @param {string} [spec.event]
 *  The name of an event to record. If provided, a new segment will be created
 *  for this event and will measure each time the event is emitted.
 *
 * @param {bool} spec.shouldCreateSegment
 *  Indicates if any child segments should be created. This should always be
 *  true unless this segment and its parent are both internal segments.
 */
function _bindStream(shim, stream, segment, spec) {
  shim.bindSegment(stream, 'emit', segment)
  if (shim.isFunction(stream.on)) {
    var ender = shim.once(function segmentEnder() {
      segment && segment.touch()
    })

    // Listen for both `end` and `error` events to end the segment.
    // An `error` event _may_ still emit `end`, but not always so we may
    // as well cover all our bases.
    stream.on('end', ender)
    stream.on('error', function queryErrorHandler(err) {
      ender()
      if (shim.listenerCount(stream, 'error') < 2) {
        throw err
      }
    })

    // If we're given an event to measure then add a listener for it.
    // TODO:  Add aggregate segments and measure the actual listener functions
    //        instead of using one normal segment and adding our own listener.

    // Wrap `on` and `addListener` to create segments for their handlers
    shim.wrap(stream, ['on', 'addListener'], function wrapOn(shim, fn) {
      return function wrappedOn(onEvent) {
        var args = argsToArray.apply(shim, arguments)
        if (spec && (onEvent !== spec.event)) {
          shim.bindCallbackSegment(args, shim.LAST, segment)
        }
        return fn.apply(this, args)
      }
    })

    if (spec && spec.event) {
      var emitCount = 0
      var eventSegment = null
      var segmentName = 'Event callback: ' + spec.event
      stream.on(spec.event, function rowEventHandler() {
        if (++emitCount === 1) {
          segment && segment.touch()
          if (spec.shouldCreateSegment) {
            eventSegment = shim.createSegment(segmentName, segment)
          } else {
            eventSegment = segment
          }
        }

        if (eventSegment) {
          if (eventSegment !== segment) {
            eventSegment.setParameter('count', emitCount)
          }
          eventSegment.touch()
        }
      })
    }
  }
}

/**
 * Binds the given segment to the completion of the Promise.
 *
 * @private
 *
 * @param {Shim} shim
 *  The shim performing the wrapping/binding.
 *
 * @param {Promise} promise
 *  The Promise to bind.
 *
 * @param {?TraceSegment} segment
 *  The segment to bind to the Promise.
 */
function _bindPromise(shim, promise, segment) {
  shim.bindSegment(promise, 'then', segment)
  shim.bindSegment(promise, 'catch', segment)
  promise.then(function () { segment && segment.touch() })
  promise.catch(function () { segment && segment.touch() })
}
