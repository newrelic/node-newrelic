/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/* eslint sonarjs/cognitive-complexity: ["error", 69] -- TODO: https://issues.newrelic.com/browse/NEWRELIC-5252 */

const genericRecorder = require('../metrics/recorders/generic')
const logger = require('../logger.js').child({ component: 'WebFrameworkShim' })
const metrics = require('../metrics/names')
const TransactionShim = require('./transaction-shim')
const Shim = require('./shim')
const specs = require('./specs')
const util = require('util')
const symbols = require('../symbols')
const { assignCLMSymbol } = require('../util/code-level-metrics')

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
const FRAMEWORK_NAMES = {
  CONNECT: 'Connect',
  DIRECTOR: 'Director',
  EXPRESS: 'Expressjs',
  FASTIFY: 'Fastify',
  HAPI: 'Hapi',
  KOA: 'Koa',
  NEXT: 'Nextjs',
  NEST: 'Nestjs',
  RESTIFY: 'Restify'
}

const MIDDLEWARE_TYPE_DETAILS = {
  APPLICATION: { name: 'Mounted App: ', path: true, record: false },
  ERRORWARE: { name: '', path: false, record: true },
  MIDDLEWARE: { name: '', path: false, record: true },
  PARAMWARE: { name: '', path: false, record: true },
  ROUTE: { name: 'Route Path: ', path: true, record: false },
  ROUTER: { name: 'Router: ', path: true, record: false }
}

const MIDDLEWARE_TYPE_NAMES = {
  APPLICATION: 'APPLICATION',
  ERRORWARE: 'ERRORWARE',
  MIDDLEWARE: 'MIDDLEWARE',
  PARAMWARE: 'PARAMWARE',
  ROUTE: 'ROUTE',
  ROUTER: 'ROUTER'
}

/**
 * Constructs a shim associated with the given agent instance, specialized for
 * instrumenting web frameworks.
 *
 * @class
 * @augments TransactionShim
 * @classdesc
 *  A helper class for wrapping web framework modules.
 * @param {Agent} agent
 *  The agent this shim will use.
 * @param shimName
 * @param {string} moduleName
 *  The name of the module being instrumented.
 * @param {string} resolvedName
 *  The full path to the loaded module.
 * @param {string} shimName
 *  Used to persist shim ids across different shim instances.
 * @param {string} pkgVersion
 *  version of module
 * @see TransactionShim
 * @see WebFrameworkShim.FRAMEWORK_NAMES
 */
function WebFrameworkShim(agent, moduleName, resolvedName, shimName, pkgVersion) {
  TransactionShim.call(this, agent, moduleName, resolvedName, shimName, pkgVersion)
  this._logger = logger.child({ module: moduleName })
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

// -------------------------------------------------------------------------- //

/**
 * @callback RouteParserFunction
 * @summary
 *  Called whenever new middleware are mounted using the instrumented framework,
 *  this method should pull out a representation of the mounted path.
 * @param {WebFrameworkShim} shim
 *  The shim in use for this instrumentation.
 * @param {Function} fn
 *  The function which received this route string/RegExp.
 * @param {string} fnName
 *  The name of the function to which this route was given.
 * @param {string|RegExp} route
 *  The route that was given to the function.
 * @returns {string|RegExp} The mount point from the given route.
 */

/**
 * @callback RouteRequestFunction
 * @summary
 *  Extracts the request object from the arguments to the middleware function.
 * @param {WebFrameworkShim}  shim    - The shim used for instrumentation.
 * @param {Function}          fn      - The middleware function.
 * @param {string}            fnName  - The name of the middleware function.
 * @param {Array}             args    - The arguments to the middleware function.
 * @returns {object} The request object.
 */

/**
 * @callback RouteNextFunction
 * @summary
 *  Used to wrap functions that users can call to continue to the next middleware.
 * @param {WebFrameworkShim}    shim    - The shim used for instrumentation.
 * @param {Function}            fn      - The middleware function.
 * @param {string}              fnName  - The name of the middleware function.
 * @param {Array}               args    - The arguments to the middleware function.
 * @param {NextWrapperFunction} wrap    - A function to wrap an individual next function.
 * @returns {object} The request object.
 */

/**
 * @callback RouteParameterFunction
 * @summary
 *  Extracts the route parameters from the arguments to the middleware function.
 * @param {WebFrameworkShim}  shim    - The shim used for instrumentation.
 * @param {Function}          fn      - The middleware function.
 * @param {string}            fnName  - The name of the middleware function.
 * @param {Array}             args    - The arguments to the middleware function.
 * @returns {object} A map of route parameter names to values.
 */

/**
 * @callback MiddlewareWrapperFunction
 * @summary
 *  Called for each middleware passed to a mounting method. Should perform the
 *  wrapping of the middleware.
 * @param {WebFrameworkShim} shim
 *  The shim used for instrumentation.
 * @param {Function} middleware
 *  The middleware function to wrap.
 * @param {string} fnName
 *  The name of the middleware function.
 * @param {string} [route=null]
 *  The route the middleware is mounted on if one was found.
 * @see WebFrameworkShim#recordMiddleware
 * @see WebFrameworkShim#recordParamware
 */

/**
 * @interface MiddlewareSpec
 * @description
 *  Describes the interface for middleware functions with this instrumentation.
 * @property {number|RouteRequestFunction} [req=shim.FIRST]
 *  Indicates which argument to the middleware is the request object. It can also be
 *  a function to extract the request object from the middleware arguments.
 * @property {number} [res=shim.SECOND]
 *  Indicates which argument to the middleware is the response object.
 * @property {number|RouteNextFunction} [next=shim.THIRD]
 *  Indicates which argument to the middleware function is the callback.  When it is
 *  a function, it will be called with the arguments of the middleware and a function
 *  for wrapping calls that represent continuation from the current middleware.
 * @property {string} [name]
 *  The name to use for this middleware. Defaults to `middleware.name`.
 * @property {RouteParameterFunction} [params]
 *  A function to extract the route parameters from the middleware arguments.
 *  Defaults to using `req.params`.
 * @property {string} [type='MIDDLEWARE']
 * @property {string | Function} [route=null]
 *  Route/path used for naming segments and transaction name candidates. If a function,
 *  will be invoked just before segment creation with middleware invocation.
 * @property {boolean} [appendPath=true]
 *  Indicates that the path associated with the middleware should be appended
 *  and popped from the stack of name candidates.
 */

/**
 * @interface MiddlewareMounterSpec
 * @description
 *  Describes the arguments provided to mounting methods (e.g. `app.post()`).
 * @property {number|string} [route=null]
 *  Tells which argument may be the mounting path for the other arguments. If
 *  the indicated argument is a function it is assumed the route was not provided
 *  and the indicated argument is a middleware function. If a string is provided
 *  it will be used as the mounting path.
 * @property {MiddlewareWrapperFunction} [wrapper]
 *  A function to call for each middleware function passed to the mounter.
 */

/**
 * @interface RenderSpec
 * @augments RecorderSpec
 * @description
 *  Describes the interface for render methods.
 * @property {number} [view=shim.FIRST]
 *  Identifies which argument is the name of the view being rendered. Defaults
 *  to {@link Shim#ARG_INDEXES shim.FIRST}.
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
 * @param {WebFrameworkShim.FRAMEWORK_NAMES|string} framework
 *  The name of the framework.
 * @see WebFrameworkShim.FRAMEWORK_NAMES
 */
function setFramework(framework) {
  this._metrics = {
    PREFIX: framework + '/',
    FRAMEWORK: framework,
    MIDDLEWARE: metrics.MIDDLEWARE.PREFIX
  }
  this.agent.environment.setFramework(framework)

  this._logger = this._logger.child({ framework: framework })
  this.logger.trace({ metrics: this._metrics }, 'Framework metric names set')
}

/**
 * Sets the URI path to be used for naming the transaction currently in scope.
 *
 * @memberof WebFrameworkShim.prototype
 * @param {string} uri - The URI path to use for the transaction.
 */
function setTransactionUri(uri) {
  const tx = this.tracer.getTransaction()
  if (!tx) {
    return
  }

  tx.nameState.setName(this._metrics.FRAMEWORK, tx.verb, metrics.ACTION_DELIMITER, uri)
}

/**
 * Records calls to methods used for rendering views.
 *
 * - `recordRender(nodule, properties [, spec])`
 * - `recordRender(func [, spec])`
 *
 * @memberof WebFrameworkShim.prototype
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 * @param {RenderSpec} [spec]
 *  The spec for wrapping the render method.
 * @returns {object | Function} The first parameter to this function, after
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
    const viewIdx = shim.normalizeIndex(args.length, spec.view)
    if (viewIdx === null) {
      shim.logger.debug('Invalid spec.view (%d vs %d), not recording.', spec.view, args.length)
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
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 * @param {MiddlewareMounterSpec} [spec]
 *  Spec describing the parameters for this middleware mount point.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
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
    spec = { wrapper: spec }
  }

  spec = this.setDefaults(spec, {
    route: null,
    endpoint: null
  })

  const wrapSpec = {
    wrapper: function wrapMounter(shim, fn, fnName) {
      if (!shim.isFunction(fn)) {
        return fn
      }

      return function wrappedMounter() {
        const args = shim.argsToArray.apply(shim, arguments)

        // Normalize the route index and pull out the route argument if provided.
        let routeIdx = null
        let route = null
        if (shim.isNumber(spec.route)) {
          routeIdx = shim.normalizeIndex(args.length, spec.route)
          route = routeIdx === null ? null : args[routeIdx]
          const isArrayOfFunctions = shim.isArray(route) && shim.isFunction(route[0])
          if (shim.isFunction(route) || isArrayOfFunctions) {
            routeIdx = null
            route = null
          } else if (shim.isArray(route)) {
            route = route.map((routeArg) => {
              return shim._routeParser.call(this, shim, fn, fnName, routeArg)
            })
          } else {
            route = shim._routeParser.call(this, shim, fn, fnName, route)
          }
        } else if (spec.route !== null) {
          route = shim._routeParser.call(this, shim, fn, fnName, spec.route)
        }

        _wrapMiddlewares.call(this, routeIdx, args)
        /**
         * @param _routeIdx
         * @param middlewares
         */
        function _wrapMiddlewares(_routeIdx, middlewares) {
          for (let i = 0; i < middlewares.length; ++i) {
            // If this argument is the route argument skip it.
            if (i === _routeIdx) {
              continue
            }

            // Some platforms accept an arbitrarily nested array of middlewares,
            // so if this argument is an array we must recurse into it.
            const middleware = middlewares[i]
            if (middleware instanceof Array) {
              _wrapMiddlewares(null, middleware)
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
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 * @param {MiddlewareSpec} [spec]
 *  The spec for wrapping the middleware.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
 * @see WebFrameworkShim#wrapMiddlewareMounter
 */
function recordMiddleware(nodule, properties, spec) {
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordMiddleware(func, spec)
    spec = properties
    properties = null
  }
  spec = spec || Object.create(null)

  const mwSpec = new specs.MiddlewareSpec(spec)
  const wrapSpec = new specs.WrapSpec(function wrapMiddleware(shim, middleware) {
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
 * @param {object | Function} nodule
 *  The source for the properties to wrap, or a single function to wrap.
 * @param {string|Array.<string>} [properties]
 *  One or more properties to wrap. If omitted, the `nodule` parameter is
 *  assumed to be the function to wrap.
 * @param {MiddlewareSpec} [spec]
 *  The spec for wrapping the middleware.
 * @returns {object | Function} The first parameter to this function, after
 *  wrapping it or its properties.
 */
function recordParamware(nodule, properties, spec) {
  if (this.isObject(properties) && !this.isArray(properties)) {
    // recordParamware(func, spec)
    spec = properties
    properties = null
  }
  spec = spec || Object.create(null)

  const mwSpec = new specs.MiddlewareSpec(spec)
  if (spec && this.isString(spec.name)) {
    mwSpec.route = '[param handler :' + spec.name + ']'
  } else {
    mwSpec.route = '[param handler]'
  }
  mwSpec.type = MIDDLEWARE_TYPE_NAMES.PARAMWARE

  const wrapSpec = new specs.WrapSpec(function wrapParamware(shim, middleware, name) {
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
 * @param {Request} req - The request which caused the error.
 * @param {*?}      err - The error which has occurred.
 * @see WebFrameworkShim#errorHandled
 * @see WebFrameworkShim#setErrorPredicate
 */
function noticeError(req, err) {
  const txInfo = _getTransactionInfo(this, req)
  if (txInfo && _isError(this, err)) {
    _noticeError(this, txInfo, err)
  }
}

/**
 * Indicates that the given error has been handled for this request.
 *
 * @memberof WebFrameworkShim.prototype
 * @param {Request} req - The request which caused the error.
 * @param {*}       err - The error which has been handled.
 * @see WebFrameworkShim#noticeError
 * @see WebFrameworkShim#setErrorPredicate
 */
function errorHandled(req, err) {
  const txInfo = _getTransactionInfo(this, req)
  if (txInfo && txInfo.error === err) {
    txInfo.errorHandled = true
  }
}

/**
 * Sets a function to call when an error is noticed to determine if it is really
 * an error.
 *
 * @memberof WebFrameworkShim.prototype
 * @param {function(object): bool} pred
 *  Function which should return true if the object passed to it is considered
 *  an error.
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
 * @param {Request} req - The request which caused the error.
 */
function savePossibleTransactionName(req) {
  const txInfo = _getTransactionInfo(this, req)
  if (txInfo && txInfo.transaction) {
    txInfo.transaction.nameState.markPath()
  }
}

/**
 * Sets a function to call with the result of a middleware to determine if it has
 * responded.
 *
 * @memberof WebFrameworkShim.prototype
 * @param {function(args, object): bool} pred
 *  Function which should return true if the object passed to it is considered
 *  a response.
 */
function setResponsePredicate(pred) {
  this._responsePredicate = pred
}

// -------------------------------------------------------------------------- //

/**
 * Default route parser function if one is not provided.
 *
 * @private
 * @param {WebFrameworkShim} shim
 *  The shim in use for this instrumentation.
 * @param {Function} fn
 *  The function which received this route string/RegExp.
 * @param {string} fnName
 *  The name of the function to which this route was given.
 * @param {string|RegExp} route
 *  The route that was given to the function.
 * @see RouteParserFunction
 */
function _defaultRouteParser(shim, fn, fnName, route) {
  if (route instanceof RegExp) {
    return '/' + route.source + '/'
  } else if (typeof route === 'string') {
    return route
  }

  return '<unknown>'
}

/**
 * Default error predicate just returns true.
 *
 * @private
 * @returns {boolean} True. Always.
 */
function _defaultErrorPredicate() {
  return true
}

/**
 * Default response predicate just returns false.
 *
 * @private
 * @returns {boolean} False. Always.
 */
function _defaultResponsePredicate() {
  return false
}

/**
 * Wraps the given function in a middleware recorder function.
 *
 * @private
 * @param {WebFrameworkShim} shim
 *  The shim used for this instrumentation.
 * @param {Function} middleware
 *  The middleware function to record.
 * @param {MiddlewareSpec} spec
 *  The spec describing the middleware.
 * @returns {Function} The middleware function wrapped in a recorder.
 */
function _recordMiddleware(shim, middleware, spec) {
  /**
   *
   */
  function getRoute() {
    let route = spec.route || '/'

    if (shim.isFunction(route)) {
      route = route()
    }

    if (route instanceof RegExp) {
      route = '/' + route.source + '/'
    } else if (shim.isArray(route)) {
      route = route.join(',')
    } else if (route[0] !== '/') {
      route = '/' + route
    }

    return route
  }

  const typeDetails = MIDDLEWARE_TYPE_DETAILS[spec.type]
  const name = spec.name || shim.getName(shim.getOriginal(middleware))
  let metricName = shim._metrics.PREFIX + typeDetails.name
  if (typeDetails.record) {
    metricName = shim._metrics.MIDDLEWARE + metricName + name
  }

  /**
   * @param route
   */
  function getSegmentName(route) {
    let segmentName = metricName
    if (typeDetails.path) {
      segmentName += route
    } else if (route.length > 1) {
      segmentName += '/' + route
    }

    return segmentName
  }

  const isErrorWare = spec.type === MIDDLEWARE_TYPE_NAMES.ERRORWARE
  const getReq = shim.isFunction(spec.req) ? spec.req : _makeGetReq(shim, spec.req)

  assignCLMSymbol(shim, middleware)

  return shim.record(
    middleware,
    spec.promise ? middlewareWithPromiseRecorder : middlewareWithCallbackRecorder
  )

  // TODO: let's please break these out
  /**
   * @param shim
   * @param fn
   * @param fnName
   * @param args
   */
  function middlewareWithCallbackRecorder(shim, fn, fnName, args) {
    const route = getRoute()

    // Pull out the request object.
    const req = getReq.call(this, shim, fn, fnName, args)

    // Fetch the transaction information from that request.
    const txInfo = _getTransactionInfo(shim, req)
    if (!txInfo || !txInfo.transaction) {
      shim.logger.debug(
        { txInfo: txInfo },
        'Could not get transaction info in %s (%s)',
        route,
        fnName
      )
      return null
    }
    txInfo.transaction.nameState.setPrefix(shim._metrics.FRAMEWORK)
    txInfo.errorHandled |= isErrorWare

    // Copy over route parameters onto the transaction root.
    let params = shim.agent.config.high_security
      ? null
      : spec.params.call(this, shim, fn, fnName, args, req)

    // Route parameters are handled here, query parameters are handled in lib/transaction/index.js#_markAsWeb as part of finalization
    params = shim.prefixRouteParameters(params)

    // Wrap up `next` and push on our name state if we find it. We only want to
    // push the name state if there is a next so that we can safely remove it
    // if context leaves this middleware.
    let nextWrapper = null
    if (shim.isFunction(spec.next)) {
      const nextDetails = {
        route,
        wrapNext: spec.next,
        isErrorWare,
        isPromise: false,
        appendPath: spec.appendPath
      }

      nextWrapper = _makeNextBinder(nextDetails, txInfo)
    } else {
      const nextIdx = shim.normalizeIndex(args.length, spec.next)
      if (nextIdx !== null && args[nextIdx] instanceof Function) {
        const nextDetails = {
          route,
          wrapNext: function wrapNext(s, f, n, _args, wrap) {
            wrap(_args, nextIdx)
          },
          isErrorWare,
          isPromise: false,
          appendPath: spec.appendPath
        }

        nextWrapper = _makeNextBinder(nextDetails, txInfo)
      }
    }

    // Append this middleware's mount point if it's not an errorware...
    // (to avoid doubling up, a la 'WebTransaction/Expressjs/GET//test/test')
    if (!isErrorWare && spec.appendPath) {
      txInfo.transaction.nameState.appendPath(route, params)
    }

    // ...and possibly construct a recorder
    let recorder = null
    if (typeDetails.record) {
      const stackPath = txInfo.transaction.nameState.getPath() || ''
      recorder = _makeMiddlewareRecorder(shim, metricName + '/' + stackPath)
    }

    const segmentName = getSegmentName(route)

    // Finally, return the segment descriptor.
    return {
      name: segmentName,
      callback: nextWrapper,
      parent: txInfo.segmentStack[txInfo.segmentStack.length - 1],
      recorder: recorder,
      parameters: params,
      after: function afterExec(shim, _fn, _name, err) {
        const errIsError = _isError(shim, err)
        if (errIsError) {
          _noticeError(shim, txInfo, err)
        } else if (!nextWrapper && !isErrorWare && spec.appendPath) {
          txInfo.transaction.nameState.popPath(route)
        }
        if (errIsError || !nextWrapper) {
          txInfo.segmentStack.pop()
        }
      }
    }
  }

  /**
   * @param shim
   * @param fn
   * @param fnName
   * @param args
   */
  function middlewareWithPromiseRecorder(shim, fn, fnName, args) {
    const route = getRoute()

    // Pull out the request object.
    const req = getReq.call(this, shim, fn, fnName, args)

    // Fetch the transaction information from that request.
    const txInfo = _getTransactionInfo(shim, req)
    if (!txInfo || !txInfo.transaction) {
      shim.logger.debug(
        { txInfo: txInfo },
        'Could not get transaction info in %s (%s)',
        route,
        fnName
      )
      return null
    }
    txInfo.transaction.nameState.setPrefix(shim._metrics.FRAMEWORK)
    txInfo.errorHandled |= isErrorWare

    // Copy over route parameters onto the transaction root.
    let params = shim.agent.config.high_security
      ? null
      : spec.params.call(this, shim, fn, fnName, args, req)

    // Route parameters are handled here, query parameters are handled in lib/transaction/index.js#_markAsWeb as part of finalization
    params = shim.prefixRouteParameters(params)

    // Append this middleware's mount point and possibly construct a recorder.
    if (spec.appendPath) {
      txInfo.transaction.nameState.appendPath(route, params)
    }
    let recorder = null
    if (typeDetails.record) {
      const stackPath = txInfo.transaction.nameState.getPath() || ''
      recorder = _makeMiddlewareRecorder(shim, metricName + '/' + stackPath)
    }

    // The next callback style can still apply to promise based
    // middleware (e.g. koa).  In this case we would like to remove the
    // path for the current executing middleware, then readd it once the
    // next callback is done (either asynchronously or after the
    // returned promise is resolved).
    let nextWrapper = function pushSegment(shim, _fn, _name, segment) {
      txInfo.segmentStack.push(segment)
    }
    if (shim.isFunction(spec.next)) {
      const nextDetails = {
        route,
        wrapNext: spec.next,
        isErrorWare,
        isPromise: true,
        appendPath: spec.appendPath
      }
      nextWrapper = _makeNextBinder(nextDetails, txInfo)
    } else {
      const nextIdx = shim.normalizeIndex(args.length, spec.next)
      if (nextIdx !== null && args[nextIdx] instanceof Function) {
        const nextDetails = {
          route,
          wrapNext: function wrapNext(s, f, n, _args, wrap) {
            wrap(_args, nextIdx)
          },
          isErrorWare,
          isPromise: true,
          appendPath: spec.appendPath
        }

        nextWrapper = _makeNextBinder(nextDetails, txInfo)
      }
    }

    const segmentName = getSegmentName(route)

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

          if (spec.appendPath) {
            txInfo.transaction.nameState.popPath(route)
          }
        }
        txInfo.segmentStack.pop()
      }
    }
  }
}

/**
 * @param shim
 * @param req
 */
function _makeGetReq(shim, req) {
  return function getReqFromArgs(shim, fn, name, args) {
    const reqIdx = shim.normalizeIndex(args.length, req)
    if (reqIdx === null || !args[reqIdx]) {
      shim.logger.debug('Can not find request parameter, not recording.')
      return null
    }
    return args[reqIdx]
  }
}

/**
 * @param nextDetails
 * @param txInfo
 */
function _makeNextBinder(nextDetails, txInfo) {
  return function bindNext(shim, fn, _name, segment, args) {
    if (!segment) {
      return
    }
    txInfo.segmentStack.push(segment)

    nextDetails.wrapNext(shim, fn, _name, args, nextWrapper)

    // Called from outside to wrap functions that could be called to continue
    // to the next middleware
    /**
     * @param nodule
     * @param property
     * @param isFinal
     */
    function nextWrapper(nodule, property, isFinal) {
      shim.wrap(nodule, property, function wrapper(shim, original) {
        const parentSegment = segment || shim.getSegment()
        return shim.bindSegment(function boundNext(err) {
          // Only pop the stack if we didn't error. This way the transaction
          // name is derived from the failing middleware.
          if (_isError(shim, err)) {
            _noticeError(shim, txInfo, err)
          } else if (!isFinal && !nextDetails.isErrorWare && nextDetails.appendPath) {
            segment.transaction.nameState.popPath(nextDetails.route)
          }

          // The next call does not signify the end of the segment
          // calling next in the promise case.  Keep the segment on the
          // stack and wait for its promise to be resolved to end it.
          if (!nextDetails.isPromise) {
            txInfo.segmentStack.pop()
            segment.end()
          }
          const ret = original.apply(this, arguments)

          if (nextDetails.isPromise && shim.isPromise(ret)) {
            // After the next call has resolved, we should reinstate the
            // segment responsible for calling next in case there is
            // more work to do in that scope.
            return ret.then(function onNextFinish(v) {
              if (nextDetails.appendPath) {
                segment.transaction.nameState.appendPath(nextDetails.route)
              }

              txInfo.segmentStack.push(segment)

              return v
            })
          }

          return ret
        }, parentSegment) // Bind to parent.
      })
    }
  }
}

/**
 * Retrieves the cached transaction information from the given object if it is
 * available.
 *
 * @private
 * @param {WebFrameworkShim}      shim  - The shim used for this instrumentation.
 * @param {http.IncomingMessage}  req   - The incoming request object.
 * @returns {object?} The transaction information if available, otherwise null.
 */
function _getTransactionInfo(shim, req) {
  try {
    return req[symbols.transactionInfo] || null
  } catch (e) {
    shim.logger.debug(e, 'Failed to fetch transaction info from req')
    return null
  }
}

/**
 * Creates a recorder for middleware metrics.
 *
 * @private
 * @param shim
 * @param metricName
 * @param {string}  path    - The mounting path of the middleware.
 * @param {Segment} segment - The segment generated for this middleware.
 * @param {string}  scope   - The scope of the metric to record.
 */
function _makeMiddlewareRecorder(shim, metricName) {
  return function middlewareMetricRecorder(segment, scope) {
    const duration = segment.getDurationInMillis()
    const exclusive = segment.getExclusiveDurationInMillis()
    const transaction = segment.transaction

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
 * @param {WebFrameworkShim} shim
 *  The shim used for this web framework.
 * @param {TransactionInfo} txInfo
 *  The transaction context information for the request.
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
 * @param {WebFrameworkShim} shim
 *  The shim used for this web framework.
 * @param {?*} err
 *  The object to check for error-ness.
 * @returns {boolean} True if the given object is an error according to the shim.
 */
function _isError(shim, err) {
  return err && shim._errorPredicate(err)
}

/**
 * Copy the keys expected from source to destination.
 *
 * @private
 * @param {object} destination
 *   The spec object receiving the expected values
 * @param {object} source
 *   The spec object the values are coming from
 */
function _copyExpectedSpecParameters(destination, source) {
  const keys = ['matchArity']

  for (let i = 0; i < keys.length; ++i) {
    const key = keys[i]
    if (source[key] != null) {
      destination[key] = source[key]
    }
  }
}
