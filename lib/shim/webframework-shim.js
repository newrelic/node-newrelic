'use strict'

var copy = require('../util/copy')
var genericRecorder = require('../metrics/recorders/generic')
var logger = require('../logger.js').child({component: 'WebFrameworkShim'})
var metrics = require('../metrics/names')
var TransactionShim = require('./transaction-shim')
var Shim = require('./shim')
var util = require('util')

/**
 * An enumeration of well-known web frameworks so that new instrumentations can
 * use the same names we already use for first-party instrumentation.
 *
 * Each of these values is also exposed directly on the WebFrameworkShim class
 * as static members.
 *
 * @readonly
 * @memberof WebFrameworkShim
 * @enum {string}
 */
var FRAMEWORK_NAMES = {
  DIRECTOR: 'Director',
  EXPRESS: 'Expressjs',
  HAPI: 'Hapi',
  RESTIFY: 'Restify'
}

var SPECIAL_MIDDLEWARE = {
  APPLICATION: 'Mounted App',
  ROUTER: 'Router',
  ENDPOINT: 'Route Path',
  PARAMWARE: 'Param Handler'
}

var MIDDLEWARE_TYPE_NAMES = {
  MIDDLEWARE: 'MIDDLEWARE',
  APPLICATION: 'APPLICATION',
  ROUTER: 'ROUTER',
  ENDPOINT: 'ENDPOINT',
  ERRORWARE: 'ERRORWARE',
  PARAMWARE: 'PARAMWARE'
}

/**
 * Default spec for describing middleware.
 *
 * @private
 */
var DEFAULT_MIDDLEWARE_SPEC = {
  req: Shim.prototype.FIRST,
  res: Shim.prototype.SECOND,
  next: Shim.prototype.THIRD,
  name: null,
  params: function defaultGetParams(shim, fn, fnName, args, reqIdx) {
    return args[reqIdx] && args[reqIdx].params
  }
}

/**
 * Name of the key used to store transaction information on `req` and `res`.
 *
 * @private
 */
var TRANSACTION_INFO_KEY = '__NR_transactionInfo'

/**
 * Constructs a shim associated with the given agent instance, specialized for
 * instrumenting web frameworks.
 *
 * @constructor
 * @extends TransactionShim
 * @classdesc
 *  A helper class for wrapping web framework modules.
 *
 * @param {Agent} agent
 *  The agent this shim will use.
 *
 * @param {string} moduleName
 *  The name of the module being instrumented.
 *
 * @param {string} [frameworkId]
 *  The name of the web framework being instrumented. If available, use one of
 *  the values from {@link WebFrameworkShim.FRAMEWORK_NAMES}.
 *
 * @see TransactionShim
 * @see WebFrameworkShim.FRAMEWORK_NAMES
 */
function WebFrameworkShim(agent, moduleName, frameworkId) {
  TransactionShim.call(this, agent, moduleName)
  this._logger = logger.child({module: moduleName})
  if (frameworkId) {
    this.setFramework(frameworkId)
  }

  this._routeParser = _defaultRouteParser
}
module.exports = WebFrameworkShim
util.inherits(WebFrameworkShim, TransactionShim)

// Add constants on the shim for the well-known frameworks.
WebFrameworkShim.FRAMEWORK_NAMES = FRAMEWORK_NAMES
Object.keys(FRAMEWORK_NAMES).forEach(function defineWebFrameworkMetricEnum(fwName) {
  Shim.defineProperty(WebFrameworkShim, fwName, FRAMEWORK_NAMES[fwName])
  Shim.defineProperty(WebFrameworkShim.prototype, fwName, FRAMEWORK_NAMES[fwName])
})

WebFrameworkShim.MIDDLEWARE_TYPE_NAMES = MIDDLEWARE_TYPE_NAMES
Object.keys(MIDDLEWARE_TYPE_NAMES).forEach(function defineMiddlewareTypeEnum(mtName) {
  Shim.defineProperty(WebFrameworkShim, mtName, MIDDLEWARE_TYPE_NAMES[mtName])
  Shim.defineProperty(WebFrameworkShim.prototype, mtName, MIDDLEWARE_TYPE_NAMES[mtName])
})

WebFrameworkShim.prototype.setRouteParser = setRouteParser
WebFrameworkShim.prototype.setFramework = setFramework
WebFrameworkShim.prototype.setDispatcher = setDispatcher
WebFrameworkShim.prototype.wrapMiddlewareMounter = wrapMiddlewareMounter
WebFrameworkShim.prototype.recordParamware = recordParamware
WebFrameworkShim.prototype.recordMiddleware = recordMiddleware
WebFrameworkShim.prototype.recordRender = recordRender

// -------------------------------------------------------------------------- //

/**
 * @callback RouteParserFunction
 *
 * @summary
 *  Called whenever new middleware are mounted using the instrumented framework,
 *  this method should pull out a representation of the mounted path.
 *
 * @param {WebFrameworkShim} shim
 *  The shim in use for this instrumentation.
 *
 * @param {function} fn
 *  The function which received this route string/RegExp.
 *
 * @param {string} fnName
 *  The name of the function to which this route was given.
 *
 * @param {string|RegExp} route
 *  The route that was given to the function.
 *
 * @return {string|RegExp} The mount point from the given route.
 */

/**
 * @callback RouteParameterFunction
 *
 * @summary
 *  Extracts the route parameters from the arguments to the middleware function.
 *
 * @param {WebFrameworkShim}  shim    - The shim used for instrumentation.
 * @param {function}          fn      - The middleware function.
 * @param {string}            fnName  - The name of the middleware function.
 * @param {Array}             args    - The arguments to the middleware function.
 *
 * @return {Object} A map of route parameter names to values.
 */

/**
 * @interface MiddlewareSpec
 *
 * @description
 *  Describes the interface for middleware functions with this instrumentation.
 *
 * @property {number} [req=shim.FIRST]
 *  Indicates which argument to the middleware is the request object.
 *
 * @property {number} [res=shim.SECOND]
 *  Indicates which argument to the middleware is the response object.
 *
 * @property {number} [next=shim.THIRD]
 *  Indicates which argument to the middleare function is the callback.
 *
 * @property {string} [name]
 *  The name to use for this middleware. Defaults to `middleware.name`.
 *
 * @property {RouteParameterFunction} [params]
 *  A function to extract the route parameters from the middleware arguments.
 *  Defaults to using `req.params`.
 */

/**
 * @interface MiddlewareArgsSpec
 *
 * @description
 *  Describes the arguments provided to mounting methods (e.g. `app.post()`).
 *
 * @property {number} [route=null]
 *  Tells which argument may be the mounting path for the other arguments. If
 *  the indicated argument is a function it is assumed the route was not provided
 *  and the indicated argument is a middleware function.
 *
 * @property {number} [endpoint=null]
 *  Indicates which of the provided arguments is expected to be the one that
 *  responds (e.g. calls `res.send()`).
 *
 * @property {MIDDLEWARE_TYPE_NAMES|MiddlewareTypeFunction} [type]
 *  Determines the kind of middleware provided.
 *
 * @property {MiddlewareSpec} [middleware]
 *  Spec describing the shape of middleware functions. The default spec for this
 *  works for Express-like middleware taking a `req`, `res`, and `next` method.
 */

/**
 * @interface ParamwareArgsSpec
 *
 * @description
 *  Describes the arguments provided to route parameter mounting methods
 *  (e.g. `app.param()`).
 *
 * @property {number} [name=shim.FIRST]
 *  Indicates which argument is the name of the route parameter.
 *
 * @property {MiddlewareSpec} [paramware]
 *  Spec describing the shape of paramware functions. The default spec for this
 *  works for Express-like paramware taking a `req`, `res`, and `next` method.
 *
 * @see MiddlewareArgsSpec
 */

/**
 * @interface RequestSpec
 *
 * @description
 *  Describes the shape of request/response pairs for this framework.
 *
 * @property {string|Array.<string>} end
 *  One or more methods from the `res` object that indicate a response going out.
 *
 * @see WebFrameworkShim#requestStarted
 */

/**
 * @interface RenderSpec
 * @extends RecorderSpec
 *
 * @description
 *  Describes the interface for render methods.
 *
 * @property {number} [view]
 *  Identifies which argument is the name of the view being rendered. Defaults
 *  to {@link Shim#ARG_INDEXES shim.FIRST}.
 *
 * @see SegmentSpec
 * @see RecorderSpec
 */

// -------------------------------------------------------------------------- //

/**
 * Sets the function used to convert the route handed to middleware-adding
 * methods into a string.
 *
 * - `setRouteParser(parser)`
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {RouteParserFunction} parser - The parser function to use.
 */
function setRouteParser(parser) {
  if (!this.isFunction(parser)) {
    return this.logger.debug('Given route parser is not a function.')
  }
  this._routeParser = parser
}

/**
 * Sets the name of the web framework in use by the server to the one given.
 *
 * - `setFramework(framework)`
 *
 * This should be the first thing the instrumentation does.
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {WebFrameworkShim.FRAMEWORK_NAMES|string} framework
 *  The name of the framework.
 *
 * @see WebFrameworkShim.FRAMEWORK_NAMES
 */
function setFramework(framework) {
  this._metrics = {
    PREFIX: framework + '/',
    MIDDLEWARE: metrics.MIDDLEWARE.PREFIX + framework + '/'
  }

  this._logger = this._logger.child({framework: framework})
  this.logger.trace({metrics: this._metrics}, 'Framework metric names set')
}

/**
 * Sets the name of the dispatcher used by this server to receive requests and
 * send responses.
 *
 * - `setDispatcher()`
 *
 * This uses the name set with {@link WebFrameworkShim#setFramework}. This
 * should be called before the first request is handled.
 *
 * @memberof WebFrameworkShim.prototype
 */
function setDispatcher() {
  this.agent.environment.setFramework(this.moduleName)
  this.agent.environment.setDispatcher(this.moduleName)
}

/**
 * Records calls to methods used for rendering views.
 *
 * - `recordRender(nodule, properties [, spec])`
 * - `recordRender(func [, spec])`
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {RenderSpec} [spec]
 *  The spec for wrapping the render method.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 */
function recordRender(nodule, properties, spec) {
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordRender(func, spec)
    spec = properties
    properties = null
  }

  spec = this.setDefaults(spec, {
    view: this.FIRST,
    callback: null,
    promise: null
  })

  return this.record(nodule, properties, function renderRecorder(shim, fn, name, args) {
    var viewIdx = shim.normalizeIndex(args.length, spec.view)
    if (viewIdx === null) {
      shim.logger.debug(
        'Invalid spec.view (%d vs %d), not recording.',
        spec.view, args.length
      )
      return null
    }

    return {
      name: metrics.VIEW.PREFIX + args[viewIdx] + metrics.VIEW.RENDER,
      callback: spec.callback,
      promise: spec.promise,
      recorder: genericRecorder,

      // Hidden class stuff
      rowCallback: null,
      stream: null,
      internal: false
    }
  })
}

/**
 * Wraps a method that is used to add middleware to a server. The middleware
 * can then be recorded as metrics.
 *
 * - `wrapMiddlewareMounter(nodule, properties [, spec])`
 * - `wrapMiddlewareMounter(func [, spec])`
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {MiddlewareMounterSpec} [spec]
 *  Spec describing the parameters for this middleware mount point.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see WebFrameworkShim#recordMiddleware
 */
function wrapMiddlewareMounter(nodule, properties, spec) {
  if (properties && !this.isString(properties) && !this.isArray(properties)) {
    // wrapMiddlewareMounter(func, spec)
    spec = properties
    properties = null
  }
  if (this.isFunction(spec)) {
    // wrapMiddlewareMounter(nodule [, properties], wrapper)
    spec = {middleware: spec}
  }

  spec = this.setDefaults(spec, {
    route: null,
    endpoint: null
  })

  return this.wrap(nodule, properties, function wrapMounter(shim, fn, fnName) {
    if (!shim.isFunction(fn)) {
      return fn
    }

    return function wrappedMounter() {
      var args = shim.argsToArray.apply(shim, arguments)

      // Normalize the route index and pull out the route argument if provided.
      var routeIdx = null
      var route = null
      if (shim.isNumber(spec.route)) {
        routeIdx = shim.normalizeIndex(args.length, spec.route)
        route = routeIdx === null ? null : args[routeIdx]
        if (shim.isFunction(route)) {
          routeIdx = null
          route = null
        } else {
          route = shim._routeParser.call(this, shim, fn, fnName, route)
        }
      } else if (spec.route !== null) {
        route = shim._routeParser.call(this, shim, fn, fnName, spec.route)
      }

      // Normalize the endpoint index as well.
      var endpointIdx = null
      if (spec.endpoint !== null) {
        endpointIdx = shim.normalizeIndex(args.length, spec.endpoint)
      }

      _wrapMiddlewares(routeIdx, endpointIdx, args)
      function _wrapMiddlewares(_routeIdx, _endpointIdx, middlewares) {
        for (var i = 0; i < middlewares.length; ++i) {
          // Some platforms accept an arbitrarily nested array of middlewares,
          // so if this argument is an array we must recurse into it.
          var middleware = middlewares[i]
          if (middleware instanceof Array) {
            _wrapMiddlewares(null, null, middleware)
            continue
          }

          // If this argument is the route argument skip it.
          if (i === _routeIdx) {
            continue
          }

          middlewares[i] = spec.middleware(
            shim,
            middleware,
            shim.getName(middleware),
            route,
            i === _endpointIdx
          )
        }
      }

      return fn.apply(this, args)
    }
  })
}

/**
 * Records the provided function as a middleware.
 *
 * - `recordMiddleware(nodule, properties [, spec])`
 * - `recordMiddleware(func [, spec])`
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {Object|Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 *
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 *
 * @param {MiddlewareSpec} [spec]
 *  The spec for wrapping the middleware.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 *
 * @see WebFrameworkShim#wrapMiddlewareMounter
 */
function recordMiddleware(nodule, properties, spec) {
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordMiddleware(func, spec)
    spec = properties
    properties = null
  }
  spec = this.setDefaults(spec, DEFAULT_MIDDLEWARE_SPEC)

  return this.wrap(nodule, properties, function wrapMiddleware(shim, middleware) {
    return _recordMiddleware(shim, middleware, spec.type, spec.route, spec)
  })
}

/**
 * Records the provided function as a paramware.
 *
 * - `recordParamware(nodule, properties [, spec])`
 * - `recordParamware(func [, spec])`
 *
 * Paramware are specialized middleware that execute when certain route
 * parameters are encountered. For example, the route `/users/:userId` could
 * trigger a paramware hooked to `userId`.
 *
 * For every new request that comes in, this should be called as early in the
 * processing as possible.
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {http.IncomingMessage} req
 *  The request that has just come in.
 *
 * @param {http.ServerResponse} res
 *  The response with which the request is paired.
 *
 * @param {RequestSpec} spec
 *  The spec describing this request/response pair.
 */
function recordParamware(nodule, properties, spec) {
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordParamware(func, spec)
    spec = properties
    properties = null
  }

  var name = '[param handler]'
  if (this.isString(spec.name)) {
    name = '[param handler :' + spec.name + ']'
  }
  var type = MIDDLEWARE_TYPE_NAMES.PARAMWARE

  return this.wrap(nodule, properties, function wrapParamware(shim, middleware) {
    return _recordMiddleware(shim, middleware, type, name, spec)
  })
}

// -------------------------------------------------------------------------- //

/**
 * Default route parser function if one is not provided.
 *
 * @private
 *
 * @param {WebFrameworkShim} shim
 *  The shim in use for this instrumentation.
 *
 * @param {function} fn
 *  The function which received this route string/RegExp.
 *
 * @param {string} fnName
 *  The name of the function to which this route was given.
 *
 * @param {string|RegExp} route
 *  The route that was given to the function.
 *
 * @see RouteParserFunction
 */
function _defaultRouteParser(shim, fn, fnName, route) {
  return route instanceof RegExp ? route.source : (route || '<unknown>')
}

/**
 * Wraps the given function in a middleware recorder function.
 *
 * @private
 *
 * @param {WebFrameworkShim} shim
 *  The shim used for this instrumentation.
 *
 * @param {function} middleware
 *  The middleare function to record.
 *
 * @param {MIDDLEWARE_TYPE_NAMES} type
 *  The type of middleware this is.
 *
 * @param {string} route
 *  The mount route/path for this middleware.
 *
 * @param {MiddlewareSpec} spec
 *  The spec describing the middleware.
 *
 * @return {function} The middleware function wrapped in a recorder.
 */
function _recordMiddleware(shim, middleware, type, route, spec) {
  // Normalize the spec.
  route = route || '/'
  spec = shim.setDefaults(spec, DEFAULT_MIDDLEWARE_SPEC)

  var name = spec.name || shim.getName(middleware)
  var segmentName = null
  if (SPECIAL_MIDDLEWARE.hasOwnProperty(type)) {
    segmentName = shim._metrics.PREFIX + SPECIAL_MIDDLEWARE[type] + ': '
    if (type === MIDDLEWARE_TYPE_NAMES.ENDPOINT) {
      segmentName += name
    }
  } else {
    segmentName = shim._metrics.MIDDLEWARE + name + '/'
  }
  segmentName += route

  return shim.record(middleware, function middlewareRecorder(shim, fn, fnName, args) {
    // Pull out the request object.
    var reqIdx = shim.normalizeIndex(args.length, spec.req)
    if (reqIdx === null || !args[reqIdx]) {
      shim.logger.debug('Can not find request parameter, not recording.')
      return null
    }
    var req = args[reqIdx]

    // Fetch the transaction information from that request.
    var txInfo = _getTransactionInfo(shim, req)
    if (!txInfo || !txInfo.transaction) {
      shim.logger.debug(
        {txInfo: txInfo},
        'Could not get transaction info in %s (%s)',
        route, fnName
      )
      return null
    }

    // Copy over route parameters onto the transaction root.
    var params = spec.params.call(this, shim, fn, fnName, args, reqIdx)

    // Wrap up `next` and push on our name state if we find it. We only want to
    // push the name state if there is a next so that we can safely remove it
    // if context leaves this middleware.
    var nextIdx = shim.normalizeIndex(args.length, spec.next)
    var nextWrapper = null
    if (nextIdx !== null && args[nextIdx] instanceof Function) {
      txInfo.transaction.nameState.appendPath(route, params)
      nextWrapper = _makeNextBinder(txInfo, nextIdx)
    }

    // Finally, return the segment descriptor with a recorder.
    return {
      name: segmentName,
      callback: nextWrapper,
      recorder: _middlewareRecorder.bind(shim, txInfo.transaction.nameState.getPath()),
      extras: params,

      // Hidden class optimization for `Shim#record`.
      internal: false,
      stream: false
    }
  })

  function _makeNextBinder(txInfo, nextIdx) {
    return function bindNext(shim, fn, _name, segment, args) {
      if (!segment) {
        return
      }
      txInfo.segmentStack.push(segment)

      var next = args[nextIdx]
      args[nextIdx] = shim.bindSegment(function boundNext(err) {
        // Only pop the stack if we didn't error. This way the transaction name
        // is derived from the failing middleware.
        _noticeError(shim, txInfo, err)
        if (!err) {
          segment.transaction.nameState.popPath(route)
        }

        txInfo.segmentStack.pop()
        segment.transaction.nameState.popPath(route)
        segment.touch()
        return next.apply(this, arguments)
      }, shim.getSegment() || segment) // Bind to parent.
    }
  }
}

/**
 * Retrieves the cached transaction information from the given object if it is
 * available.
 *
 * @private
 *
 * @param {WebFrameworkShim}      shim  - The shim used for this instrumentation.
 * @param {http.IncomingMessage}  req   - The incoming request object.
 *
 * @return {object?} The transaction information if available, otherwise null.
 */
function _getTransactionInfo(shim, req) {
  try {
    return req[TRANSACTION_INFO_KEY] || null
  } catch (e) {
    shim.logger.debug({error: e}, 'Failed to fetch transaction info from req')
    return null
  }
}

/**
 * Measures metrics for middleware.
 *
 * @private
 * @this {WebFrameworkShim}
 *
 * @param {string}  path    - The mounting path of the middleware.
 * @param {Segment} segment - The segment generated for this middleware.
 * @param {string}  scope   - The scope of the metric to record.
 */
function _middlewareRecorder(path, segment, scope) {
  var duration = segment.getDurationInMillis()
  var exclusive = segment.getExclusiveDurationInMillis()
  var transaction = segment.transaction
  var metricName = segment.name + '/' + path

  if (scope) {
    transaction.measure(metricName, scope, duration, exclusive)
  }
  transaction.measure(metricName, null, duration, exclusive)
}
