'use strict'

var genericRecorder = require('../metrics/recorders/generic')
var logger = require('../logger.js').child({component: 'WebFrameworkShim'})
var metrics = require('../metrics/names')
var TransactionShim = require('./transaction-shim')
var Shim = require('./shim')
var specs = require('./specs')
var urltils = require('../util/urltils')
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
  CONNECT: 'Connect',
  DIRECTOR: 'Director',
  EXPRESS: 'Expressjs',
  HAPI: 'Hapi',
  KOA: 'Koa',
  RESTIFY: 'Restify'
}

var MIDDLEWARE_TYPE_DETAILS = {
  APPLICATION:  {name: 'Mounted App: ', path: true,   record: false},
  ERRORWARE:    {name: '',              path: false,  record: true},
  MIDDLEWARE:   {name: '',              path: false,  record: true},
  PARAMWARE:    {name: '',              path: false,  record: true},
  ROUTE:        {name: 'Route Path: ',  path: true,   record: false},
  ROUTER:       {name: 'Router: ',      path: true,   record: false}
}

var MIDDLEWARE_TYPE_NAMES = {
  APPLICATION: 'APPLICATION',
  ERRORWARE: 'ERRORWARE',
  MIDDLEWARE: 'MIDDLEWARE',
  PARAMWARE: 'PARAMWARE',
  ROUTE: 'ROUTE',
  ROUTER: 'ROUTER'
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
 * @param {string} resolvedName
 *  The full path to the loaded module.
 *
 * @param {string} [frameworkId]
 *  The name of the web framework being instrumented. If available, use one of
 *  the values from {@link WebFrameworkShim.FRAMEWORK_NAMES}.
 *
 * @see TransactionShim
 * @see WebFrameworkShim.FRAMEWORK_NAMES
 */
function WebFrameworkShim(agent, moduleName, resolvedName, frameworkId) {
  TransactionShim.call(this, agent, moduleName, resolvedName)
  this._logger = logger.child({module: moduleName})
  if (frameworkId) {
    this.setFramework(frameworkId)
  }

  this._routeParser = _defaultRouteParser
  this._errorPredicate = _defaultErrorPredicate
  this._responsePredicate = _defaultResponsePredicate
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
WebFrameworkShim.prototype.setTransactionUri = setTransactionUri
WebFrameworkShim.prototype.wrapMiddlewareMounter = wrapMiddlewareMounter
WebFrameworkShim.prototype.recordParamware = recordParamware
WebFrameworkShim.prototype.recordMiddleware = recordMiddleware
WebFrameworkShim.prototype.recordRender = recordRender
WebFrameworkShim.prototype.noticeError = noticeError
WebFrameworkShim.prototype.errorHandled = errorHandled
WebFrameworkShim.prototype.setErrorPredicate = setErrorPredicate
WebFrameworkShim.prototype.setResponsePredicate = setResponsePredicate
WebFrameworkShim.prototype.savePossibleTransactionName = savePossibleTransactionName
WebFrameworkShim.prototype.captureUrlParams = captureUrlParams

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
 * @callback RouteRequestFunction
 *
 * @summary
 *  Extracts the request object from the arguments to the middleware function.
 *
 * @param {WebFrameworkShim}  shim    - The shim used for instrumentation.
 * @param {function}          fn      - The middleware function.
 * @param {string}            fnName  - The name of the middleware function.
 * @param {Array}             args    - The arguments to the middleware function.
 *
 * @return {Object} The request object.
 */

/**
 * @callback RouteNextFunction
 *
 * @summary
 *  Used to wrap functions that users can call to continue to the next middleware.
 *
 * @param {WebFrameworkShim}    shim    - The shim used for instrumentation.
 * @param {function}            fn      - The middleware function.
 * @param {string}              fnName  - The name of the middleware function.
 * @param {Array}               args    - The arguments to the middleware function.
 * @param {NextWrapperFunction} wrap    - A function to wrap an individual next function.
 *
 * @return {Object} The request object.
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
 * @callback MiddlewareWrapperFunction
 *
 * @summary
 *  Called for each middleware passed to a mounting method. Should perform the
 *  wrapping of the middleware.
 *
 * @param {WebFrameworkShim} shim
 *  The shim used for instrumentation.
 *
 * @param {function} middleware
 *  The middleware function to wrap.
 *
 * @param {string} fnName
 *  The name of the middleware function.
 *
 * @param {string} [route=null]
 *  The route the middleware is mounted on if one was found.
 *
 * @see WebFrameworkShim#recordMiddleware
 * @see WebFrameworkShim#recordParamware
 */

/**
 * @interface MiddlewareSpec
 *
 * @description
 *  Describes the interface for middleware functions with this instrumentation.
 *
 * @property {number|RouteRequestFunction} [req=shim.FIRST]
 *  Indicates which argument to the middleware is the request object. It can also be
 *  a function to extract the request object from the middleware arguments.
 *
 * @property {number} [res=shim.SECOND]
 *  Indicates which argument to the middleware is the response object.
 *
 * @property {number|RouteNextFunction} [next=shim.THIRD]
 *  Indicates which argument to the middleware function is the callback.  When it is
 *  a function, it will be called with the arguments of the middleware and a function
 *  for wrapping calls that represent continuation from the current middleware.
 *
 * @property {string} [name]
 *  The name to use for this middleware. Defaults to `middleware.name`.
 *
 * @property {RouteParameterFunction} [params]
 *  A function to extract the route parameters from the middleware arguments.
 *  Defaults to using `req.params`.
 */

/**
 * @interface MiddlewareMounterSpec
 *
 * @description
 *  Describes the arguments provided to mounting methods (e.g. `app.post()`).
 *
 * @property {number|string} [route=null]
 *  Tells which argument may be the mounting path for the other arguments. If
 *  the indicated argument is a function it is assumed the route was not provided
 *  and the indicated argument is a middleware function. If a string is provided
 *  it will be used as the mounting path.
 *
 * @property {MiddlewareWrapperFunction} [wrapper]
 *  A function to call for each middleware function passed to the mounter.
 */

/**
 * @interface RenderSpec
 * @extends RecorderSpec
 *
 * @description
 *  Describes the interface for render methods.
 *
 * @property {number} [view=shim.FIRST]
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
    FRAMEWORK: framework,
    MIDDLEWARE: metrics.MIDDLEWARE.PREFIX
  }
  this.agent.environment.setFramework(framework)

  this._logger = this._logger.child({framework: framework})
  this.logger.trace({metrics: this._metrics}, 'Framework metric names set')
}

/**
 * Sets the URI path to be used for naming the transaction currenty in scope.
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {string} uri - The URI path to use for the transaction.
 */
function setTransactionUri(uri) {
  var tx = this.tracer.getTransaction()
  if (!tx) {
    return
  }

  tx.nameState.setName(
    this._metrics.FRAMEWORK,
    tx.verb,
    metrics.ACTION_DELIMITER,
    uri
  )
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
    spec = {wrapper: spec}
  }

  spec = this.setDefaults(spec, {
    route: null,
    endpoint: null
  })

  var wrapSpec = {
    wrapper: function wrapMounter(shim, fn, fnName) {
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

        _wrapMiddlewares.call(this, routeIdx, args)
        function _wrapMiddlewares(_routeIdx, middlewares) {
          for (var i = 0; i < middlewares.length; ++i) {
            // Some platforms accept an arbitrarily nested array of middlewares,
            // so if this argument is an array we must recurse into it.
            var middleware = middlewares[i]
            if (middleware instanceof Array) {
              _wrapMiddlewares(null, middleware)
              continue
            }

            // If this argument is the route argument skip it.
            if (i === _routeIdx) {
              continue
            }

            middlewares[i] = spec.wrapper.call(
              this,
              shim,
              middleware,
              shim.getName(middleware),
              route
            )
          }
        }

        return fn.apply(this, args)
      }
    }
  }

  _copyExpectedSpecParameters(wrapSpec, spec)

  return this.wrap(nodule, properties, wrapSpec)
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
  spec = spec || Object.create(null)

  var mwSpec = new specs.MiddlewareSpec(spec)
  var wrapSpec = new specs.WrapSpec(function wrapMiddleware(shim, middleware) {
    return _recordMiddleware(shim, middleware, mwSpec)
  })

  _copyExpectedSpecParameters(wrapSpec, spec)

  return this.wrap(nodule, properties, wrapSpec)
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
 */
function recordParamware(nodule, properties, spec) {
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordParamware(func, spec)
    spec = properties
    properties = null
  }
  spec = spec || Object.create(null)

  var mwSpec = new specs.MiddlewareSpec(spec)
  if (spec && this.isString(spec.name)) {
    mwSpec.route = '[param handler :' + spec.name + ']'
  } else {
    mwSpec.route = '[param handler]'
  }
  mwSpec.type = MIDDLEWARE_TYPE_NAMES.PARAMWARE

  var wrapSpec = new specs.WrapSpec(function wrapParamware(shim, middleware, name) {
    mwSpec.name = name
    return _recordMiddleware(shim, middleware, mwSpec)
  })

  _copyExpectedSpecParameters(wrapSpec, spec)

  return this.wrap(nodule, properties, wrapSpec)
}

/**
 * Tells the shim that the given request has caused an error.
 *
 * The given error will be checked for truthiness and if it passes the error
 * predicate check before being held onto.
 *
 * Use {@link WebFrameworkShim#errorHandled} to unnotice an error if it is later
 * caught by the user.
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {Request} req - The request which caused the error.
 * @param {*?}      err - The error which has occurred.
 *
 * @see WebFrameworkShim#errorHandled
 * @see WebFrameworkShim#setErrorPredicate
 */
function noticeError(req, err) {
  var txInfo = _getTransactionInfo(this, req)
  if (txInfo && _isError(this, err)) {
    _noticeError(this, txInfo, err)
  }
}

/**
 * Indicates that the given error has been handled for this request.
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {Request} req - The request which caused the error.
 * @param {*}       err - The error which has been handled.
 *
 * @see WebFrameworkShim#noticeError
 * @see WebFrameworkShim#setErrorPredicate
 */
function errorHandled(req, err) {
  var txInfo = _getTransactionInfo(this, req)
  if (txInfo && txInfo.error === err) {
    txInfo.errorHandled = true
  }
}

/**
 * Sets a function to call when an error is noticed to determine if it is really
 * an error.
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {function(object): bool} pred
 *  Function which should return true if the object passed to it is considered
 *  an error.
 *
 * @see WebFrameworkShim#noticeError
 * @see WebFrameworkShim#errorHandled
 */
function setErrorPredicate(pred) {
  this._errorPredicate = pred
}

/**
 * Marks the current path as a potential responder.
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {Request} req - The request which caused the error.
 */
function savePossibleTransactionName(req) {
  var txInfo = _getTransactionInfo(this, req)
  if (txInfo && txInfo.transaction) {
    txInfo.transaction.nameState.markPath()
  }
}

/**
 * Sets a function to call with the result of a middleware to determine if it has
 * responded.
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {function(args, object): bool} pred
 *  Function which should return true if the object passed to it is considered
 *  a response.
 */
function setResponsePredicate(pred) {
  this._responsePredicate = pred
}

/**
 * Capture URL parameters from a request object as attributes of the current segment.
 *
 * @memberof WebFrameworkShim.prototype
 *
 * @param {Object} params
 *  An object with key-value pairs.
 */
function captureUrlParams(params) {
  var segment = this.getSegment()
  if (segment && !this.agent.config.high_security) {
    urltils.copyParameters(params, segment.parameters)
  }
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
  return route instanceof RegExp  ? '/' + route.source + '/'
    : typeof route === 'string'   ? route
    : '<unknown>'
}

/**
 * Default error predicate just returns true.
 *
 * @private
 *
 * @return {bool} True. Always.
 */
function _defaultErrorPredicate() {
  return true
}

/**
 * Default response predicate just returns false.
 *
 * @private
 *
 * @return {bool} False. Always.
 */
function _defaultResponsePredicate() {
  return false
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
 *  The middleware function to record.
 *
 * @param {MiddlewareSpec} spec
 *  The spec describing the middleware.
 *
 * @return {function} The middleware function wrapped in a recorder.
 */
function _recordMiddleware(shim, middleware, spec) {
  // Normalize the route.
  var route = spec.route || '/'
  if (route instanceof RegExp) {
    route = '/' + route.source + '/'
  }
  if (route[0] !== '/' && !shim.isArray(route)) {
    route = '/' + route
  }

  var typeDetails = MIDDLEWARE_TYPE_DETAILS[spec.type]
  var name = spec.name || shim.getName(shim.getOriginal(middleware))
  var metricName = shim._metrics.PREFIX + typeDetails.name
  if (typeDetails.record) {
    metricName = shim._metrics.MIDDLEWARE + metricName + name
  }

  var segmentName = metricName
  if (typeDetails.path) {
    segmentName += route
  } else if (route.length > 1) {
    segmentName += '/' + route
  }
  metricName += '/'

  var isErrorWare = spec.type === MIDDLEWARE_TYPE_NAMES.ERRORWARE
  var getReq = shim.isFunction(spec.req) ? spec.req : _makeGetReq(shim, spec.req)

  return shim.record(
    middleware,
    spec.promise
      ? middlewareWithPromiseRecorder
      : middlewareWithCallbackRecorder
  )

  // TODO: let's please break these out
  function middlewareWithCallbackRecorder(shim, fn, fnName, args) {
    // Pull out the request object.
    var req = getReq.call(this, shim, fn, fnName, args)

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
    txInfo.transaction.nameState.setPrefix(shim._metrics.FRAMEWORK)
    txInfo.errorHandled |= isErrorWare

    // Copy over route parameters onto the transaction root.
    var params = shim.agent.config.high_security
      ? null : spec.params.call(this, shim, fn, fnName, args, req)

    // Wrap up `next` and push on our name state if we find it. We only want to
    // push the name state if there is a next so that we can safely remove it
    // if context leaves this middleware.
    var nextWrapper = null
    if (shim.isFunction(spec.next)) {
      nextWrapper = _makeNextBinder(route, txInfo, spec.next, isErrorWare, false)
    } else {
      var nextIdx = shim.normalizeIndex(args.length, spec.next)
      if (nextIdx !== null && args[nextIdx] instanceof Function) {
        nextWrapper = _makeNextBinder(
          route,
          txInfo,
          function wrapNext(s, f, n, _args, wrap) {
            wrap(_args, nextIdx)
          },
          isErrorWare,
          false
        )
      }
    }

    // Append this middleware's mount point if it's not an errorware...
    // (to avoid doubling up, a la 'WebTransaction/Expressjs/GET//test/test')
    if (!isErrorWare) {
      txInfo.transaction.nameState.appendPath(route, params)
    }
    // ...and possibly construct a recorder
    var recorder = null
    if (typeDetails.record) {
      var stackPath = txInfo.transaction.nameState.getPath() || ''
      recorder = _makeMiddlewareRecorder(shim, metricName + stackPath)
    }

    // Finally, return the segment descriptor.
    return {
      name: segmentName,
      callback: nextWrapper,
      parent: txInfo.segmentStack[txInfo.segmentStack.length - 1],
      recorder: recorder,
      parameters: params,
      after: function afterExec(shim, _fn, _name, err) {
        var errIsError = _isError(shim, err)
        if (errIsError) {
          _noticeError(shim, txInfo, err)
        } else if (!nextWrapper && !isErrorWare) {
          txInfo.transaction.nameState.popPath(route)
        }
        if (errIsError || !nextWrapper) {
          txInfo.segmentStack.pop()
        }
      }
    }
  }

  function middlewareWithPromiseRecorder(shim, fn, fnName, args) {
    // Pull out the request object.
    var req = getReq.call(this, shim, fn, fnName, args)

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
    txInfo.transaction.nameState.setPrefix(shim._metrics.FRAMEWORK)
    txInfo.errorHandled |= isErrorWare

    // Copy over route parameters onto the transaction root.
    var params = shim.agent.config.high_security
      ? null : spec.params.call(this, shim, fn, fnName, args, req)

    // Append this middleware's mount point and possibly construct a recorder.
    txInfo.transaction.nameState.appendPath(route, params)
    var recorder = null
    if (typeDetails.record) {
      var stackPath = txInfo.transaction.nameState.getPath() || ''
      recorder = _makeMiddlewareRecorder(shim, metricName + stackPath)
    }

    // The next callback style can still apply to promise based
    // middleware (e.g. koa).  In this case we would like to remove the
    // path for the current executing middleware, then readd it once the
    // next callback is done (either asynchronously or after the
    // returned promise is resolved).
    var nextWrapper = function pushSegment(shim, _fn, _name, segment) {
      txInfo.segmentStack.push(segment)
    }
    if (shim.isFunction(spec.next)) {
      nextWrapper = _makeNextBinder(route, txInfo, spec.next, isErrorWare, true)
    } else {
      var nextIdx = shim.normalizeIndex(args.length, spec.next)
      if (nextIdx !== null && args[nextIdx] instanceof Function) {
        nextWrapper = _makeNextBinder(
          route,
          txInfo,
          function wrapNext(s, f, n, _args, wrap) {
            wrap(_args, nextIdx)
          },
          isErrorWare,
          true
        )
      }
    }

    // Finally, return the segment descriptor.
    return {
      name: segmentName,
      parent: txInfo.segmentStack[txInfo.segmentStack.length - 1],
      promise: spec.promise,
      callback: nextWrapper,
      recorder: recorder,
      parameters: params,
      after: function afterExec(shim, _fn, _name, err, result) {
        if (shim._responsePredicate(args, result)) {
          txInfo.transaction.nameState.freeze()
        }
        if (_isError(shim, err)) {
          _noticeError(shim, txInfo, err)
        } else {
          txInfo.errorHandled = true
          txInfo.transaction.nameState.popPath(route)
        }
        txInfo.segmentStack.pop()
      }
    }
  }
}

function _makeGetReq(shim, req) {
  return function getReqFromArgs(shim, fn, name, args) {
    var reqIdx = shim.normalizeIndex(args.length, req)
    if (reqIdx === null || !args[reqIdx]) {
      shim.logger.debug('Can not find request parameter, not recording.')
      return null
    }
    return args[reqIdx]
  }
}

function _makeNextBinder(route, txInfo, wrapNext, isErrorWare, isPromise) {
  return function bindNext(shim, fn, _name, segment, args) {
    if (!segment) {
      return
    }
    txInfo.segmentStack.push(segment)

    wrapNext(shim, fn, _name, args, nextWrapper)

    // Called from outside to wrap functions that could be called to continue
    // to the next middleware
    function nextWrapper(nodule, property, isFinal) {
      shim.wrap(nodule, property, function wrapper(shim, original) {
        return shim.bindSegment(function boundNext(err) {
          // Only pop the stack if we didn't error. This way the transaction
          // name is derived from the failing middleware.
          if (_isError(shim, err)) {
            _noticeError(shim, txInfo, err)
          } else if (!isFinal && !isErrorWare) {
            segment.transaction.nameState.popPath(route)
          }

          // The next call does not signify the end of the segment
          // calling next in the promise case.  Keep the segment on the
          // stack and wait for its promise to be resolved to end it.
          if (!isPromise) {
            txInfo.segmentStack.pop()
            segment.end()
          }
          var ret = original.apply(this, arguments)

          if (isPromise && shim.isPromise(ret)) {
            // After the next call has resolved, we should reinstate the
            // segment responsible for calling next in case there is
            // more work to do in that scope.
            return ret.then(function onNextFinish(v) {
              segment.transaction.nameState.appendPath(route)
              txInfo.segmentStack.push(segment)
              return v
            })
          }

          return ret
        }, shim.getSegment() || segment) // Bind to parent.
      })
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
    shim.logger.debug(e, 'Failed to fetch transaction info from req')
    return null
  }
}

/**
 * Creates a recorder for middleware metrics.
 *
 * @private
 *
 *
 * @param {string}  path    - The mounting path of the middleware.
 * @param {Segment} segment - The segment generated for this middleware.
 * @param {string}  scope   - The scope of the metric to record.
 */
function _makeMiddlewareRecorder(shim, metricName) {
  return function middlewareMetricRecorder(segment, scope) {
    var duration = segment.getDurationInMillis()
    var exclusive = segment.getExclusiveDurationInMillis()
    var transaction = segment.transaction

    if (scope) {
      transaction.measure(metricName, scope, duration, exclusive)
    }
    transaction.measure(metricName, null, duration, exclusive)
  }
}

/**
 * Adds the given error to the transaction information if it is actually an error.
 *
 * @private
 *
 * @param {WebFrameworkShim} shim
 *  The shim used for this web framework.
 *
 * @param {TransactionInfo} txInfo
 *  The transaction context information for the request.
 *
 * @param {*} err
 *  The error to notice.
 */
function _noticeError(shim, txInfo, err) {
  txInfo.error = err
  txInfo.errorHandled = false
}

/**
 * Determines if the given object is an error according to the shim.
 *
 * @private
 *
 * @param {WebFrameworkShim} shim
 *  The shim used for this web framework.
 *
 * @param {?*} err
 *  The object to check for error-ness.
 *
 * @return {bool} True if the given object is an error according to the shim.
 */
function _isError(shim, err) {
  return err && shim._errorPredicate(err)
}

/**
 * Copy the keys expected from source to destination.
 *
 * @private
 *
 * @param {Object} destination
 *   The spec object receiving the expected values
 *
 * @param {Object} source
 *   The spec object the values are coming from
 */
function _copyExpectedSpecParameters(destination, source) {
  var keys = [
    'matchArity'
  ]

  for (var i = 0; i < keys.length; ++i) {
    var key = keys[i]
    if (source[key] != null) {
      destination[key] = source[key]
    }
  }
}
