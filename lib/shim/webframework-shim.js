'use strict'

var copy = require('../util/copy')
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

WebFrameworkShim.prototype.setRouteParser = setRouteParser
WebFrameworkShim.prototype.setFramework = setFramework
WebFrameworkShim.prototype.setDispatcher = setDispatcher
WebFrameworkShim.prototype.recordArgsAsMiddleware = recordArgsAsMiddleware
WebFrameworkShim.prototype.requestStarted = requestStarted

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
 *  Inidicates which of the provided arguments is expected to be the one that
 *  responds (e.g. calls `res.send()`).
 *
 * @property {MiddlewareSpec} [middleware]
 *  Spec describing the shape of middleware functions. The default spec for this
 *  works for Express-like middleware taking a `req`, `res`, and `next` method.
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
 * Wraps a method that is used to add middleware to a server. The middleware
 * will then be recorded as metrics.
 *
 * - `recordArgsAsMiddleware(nodule, properties [, spec])`
 * - `recordArgsAsMiddleware(func [, spec])`
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
 * @param {MiddlewareArgsSpec} [spec]
 *  The spec for wrapping the middleware arguments.
 *
 * @return {Object|Function} The first parameter to this function, after
 *  wrapping it or its properties.
 */
function recordArgsAsMiddleware(nodule, properties, spec) {
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordArgsAsMiddleware(func, spec)
    spec = properties
    properties = null
  }

  // Normalize the spec now to prevent deopts later.
  spec = spec || {}
  if (!spec.hasOwnProperty('route')) {
    spec.route = null
  }
  if (!spec.hasOwnProperty('endpoint')) {
    spec.endpoint = null
  }
  if (!spec.hasOwnProperty('middleware')) {
    spec.middleware = copy.shallow(DEFAULT_MIDDLEWARE_SPEC)
  }

  return this.wrap(nodule, properties, function wrapArgs(shim, fn, fnName) {
    return function wrappedMiddlwareAdder() {
      var args = shim.argsToArray.apply(shim, arguments)

      // Normalize the route index and pull out the route argument if provided.
      var routeIdx = null
      if (spec.route !== null) {
        routeIdx = shim.normalizeIndex(args.length, spec.route)
      }
      var route = routeIdx === null ? null : args[routeIdx]
      if (shim.isFunction(route)) {
        routeIdx = null
        route = null
      } else {
        route = shim._routeParser.call(this, shim, fn, fnName, route)
      }

      // Normalize the endpoint index as well.
      var endpointIdx = null
      if (spec.endpoint !== null) {
        endpointIdx = shim.normalizeIndex(args.length, spec.endpoint)
      }

      for (var i = 0; i < args.length; ++i) {
        // If this argument is the route argument or it is _not_ a function,
        // skip it. Otherwise, call the right wrapper depending on if this is
        // a potential endpoint.
        if (i === routeIdx || !(args[i] instanceof Function)) {
          continue
        }

        // Use a copy of the middleware spec for each of these middlewares.
        var middlewareSpec = copy.shallow(spec.middleware)
        if (i === endpointIdx) {
          args[i] = _recordRouteHandler(shim, args[i], route, middlewareSpec)
        } else {
          args[i] = _recordMiddlware(shim, args[i], route, middlewareSpec)
        }
      }

      return fn.apply(this, args)
    }
  })
}

/**
 * Binds the requisit state for maintaining the transaction to the given request
 * and response objects.
 *
 * - `requestStarted(req, res, spec)`
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
function requestStarted(req, res, spec) {
  var tx = this.tracer.getTransaction()
  if (!tx) {
    return this.logger.debug('Request started without an active transaction!')
  }

  // Prepare the transaction's name state.
  tx.nameState.setPrefix(this._metrics.PREFIX)
  tx.nameState.setDelimiter(metrics.ACTION_DELIMITER)

  // Store the transaction information on the request and response.
  var txInfo = {transaction: tx}
  this.setInternalProperty(req, TRANSACTION_INFO_KEY, txInfo)
  this.setInternalProperty(res, TRANSACTION_INFO_KEY, txInfo)
  this.logger.trace('Stored transaction information on request and response')

  // Wrap up all the methods which may end the response. On end, we must freeze
  // the current name state to maintain the route that responded and also end
  // the current segment (otherwise it may become truncated).
  this.wrap(res, spec.end, function wrapResEnd(shim, fn) {
    if (!shim.isFunction(fn)) {
      return fn
    }
    return function wrappedResEnd() {
      var segment = shim.getSegment()
      if (segment) {
        segment.end()
      }
      tx.nameState.freeze()

      return fn.apply(this, arguments)
    }
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
 * Recorder specialized for route endpoints.
 *
 * @private
 *
 * @param {WebFrameworkShim} shim
 *  The shim used for this instrumentation.
 *
 * @param {function} middleware
 *  The endpoint function to record.
 *
 * @param {string} route
 *  The mount route/path for this middleware.
 *
 * @param {MiddlewareSpec} spec
 *  The spec describing the middleware.
 *
 * @return {function} The middleware function wrapped in a recorder.
 */
function _recordRouteHandler(shim, middleware, route, spec) {
  spec = spec || copy.shallow(DEFAULT_MIDDLEWARE_SPEC)
  if (!(/^Endpoint /).test(spec.name)) {
    spec.name = 'Endpoint ' + (spec.name || shim.getName(middleware))
  }
  return _recordMiddlware(shim, middleware, route, spec)
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
 * @param {string} route
 *  The mount route/path for this middleware.
 *
 * @param {MiddlewareSpec} spec
 *  The spec describing the middleware.
 *
 * @return {function} The middleware function wrapped in a recorder.
 */
function _recordMiddlware(shim, middleware, route, spec) {
  // Normalize the spec.
  spec = spec || copy.shallow(DEFAULT_MIDDLEWARE_SPEC)
  if (!spec.hasOwnProperty('req')) {
    spec.req = DEFAULT_MIDDLEWARE_SPEC.req
  }
  if (!spec.hasOwnProperty('res')) {
    spec.res = DEFAULT_MIDDLEWARE_SPEC.res
  }
  if (!spec.hasOwnProperty('next')) {
    spec.next = DEFAULT_MIDDLEWARE_SPEC.next
  }
  if (!spec.hasOwnProperty('params') || !shim.isFunction(spec.params)) {
    spec.params = DEFAULT_MIDDLEWARE_SPEC.params
  }
  var segmentName = shim._metrics.MIDDLEWARE + (spec.name || shim.getName(middleware))

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
      if (route !== null) {
        txInfo.transaction.nameState.appendPath(route, params)
      }
      nextWrapper = _makeNextBinder(nextIdx)
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

  function _makeNextBinder(nextIdx) {
    return function bindNext(shim, fn, name, segment, args) {
      if (!segment) {
        return
      }

      var next = args[nextIdx]
      args[nextIdx] = shim.bindSegment(function boundNext() {
        segment.transaction.nameState.popPath(route)
        segment.touch()
        return next.apply(this, arguments)
      }, shim.getSegment()) // Bind to parent.
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
  var metricName = segment.name + '/' + (path || '/')

  if (scope) {
    transaction.measure(metricName, scope, duration, exclusive)
  }
  transaction.measure(metricName, null, duration, exclusive)
}
