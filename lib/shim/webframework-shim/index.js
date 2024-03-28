/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const genericRecorder = require('../../metrics/recorders/generic')
const logger = require('../../logger.js').child({ component: 'WebFrameworkShim' })
const metrics = require('../../metrics/names')
const TransactionShim = require('../transaction-shim')
const Shim = require('../shim')
const specs = require('../specs')
const util = require('util')
const { assignError, getTransactionInfo, isError, MIDDLEWARE_TYPE_NAMES } = require('./common')
const wrapMiddlewareMounter = require('./middleware-mounter')
const { _recordMiddleware } = require('./middleware')

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

/**
 * Sets the function used to convert the route handed to middleware-adding
 * methods into a string.
 *
 * - `setRouteParser(parser)`
 *
 * @memberof WebFrameworkShim.prototype
 * @param {RouteParserFunction} parser - The parser function to use.
 * @returns {undefined}
 */
function setRouteParser(parser) {
  if (!this.isFunction(parser)) {
    this.logger.debug('Given route parser is not a function.')
    return
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

  return this.record(nodule, properties, function renderRecorder(shim, fn, name, args) {
    const viewIdx = shim.normalizeIndex(args.length, spec.view)
    if (viewIdx === null) {
      shim.logger.debug('Invalid spec.view (%d vs %d), not recording.', spec.view, args.length)
      return null
    }

    spec.recorder = genericRecorder
    spec.name = metrics.VIEW.PREFIX + args[viewIdx] + metrics.VIEW.RENDER
    return spec
  })
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

  const wrapSpec = new specs.WrapSpec({
    matchArity: spec.matchArity,
    wrapper: function wrapMiddleware(shim, middleware) {
      return _recordMiddleware(shim, middleware, spec)
    }
  })

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
  if (spec && this.isString(spec.name)) {
    spec.route = '[param handler :' + spec.name + ']'
  } else {
    spec.route = '[param handler]'
  }
  spec.type = MIDDLEWARE_TYPE_NAMES.PARAMWARE

  const wrapSpec = new specs.WrapSpec({
    matchArity: spec.matchArity,
    wrapper: function wrapParamware(shim, middleware, name) {
      spec.name = name
      return _recordMiddleware(shim, middleware, spec)
    }
  })

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
  const txInfo = getTransactionInfo(this, req)
  if (txInfo && isError(this, err)) {
    assignError(txInfo, err)
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
  const txInfo = getTransactionInfo(this, req)
  if (txInfo && txInfo.error === err) {
    txInfo.errorHandled = true
  }
}

/**
 * Sets a function to call when an error is noticed to determine if it is really
 * an error.
 *
 * @memberof WebFrameworkShim.prototype
 * @param {function(object): boolean} pred
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
  const txInfo = getTransactionInfo(this, req)
  if (txInfo && txInfo.transaction) {
    txInfo.transaction.nameState.markPath()
  }
}

/**
 * Sets a function to call with the result of a middleware to determine if it has
 * responded.
 *
 * @memberof WebFrameworkShim.prototype
 * @param {function(args, object): boolean} pred
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
 *  @returns {string} route name
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
