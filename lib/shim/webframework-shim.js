'use strict'

var logger = require('../logger.js').child({component: 'WebFrameworkShim'})
var metrics = require('../metrics/names')
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
  EXPRESS: 'Expressjs',
  RESTIFY: 'Restify'
}

/**
 * Constructs a shim associated with the given agent instance, specialized for
 * instrumenting web frameworks.
 *
 * @constructor
 * @extends Shim
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
 * @see Shim
 * @see WebFrameworkShim.FRAMEWORK_NAMES
 */
function WebFrameworkShim(agent, moduleName, frameworkId) {
  Shim.call(this, agent, moduleName)
  this._logger = logger.child({module: moduleName})
  if (frameworkId) {
    this.setFramework(frameworkId)
  }
}
module.exports = WebFrameworkShim
util.inherits(WebFrameworkShim, Shim)

// Add constants on the shim for the well-known frameworks.
WebFrameworkShim.FRAMEWORK_NAMES = FRAMEWORK_NAMES
Object.keys(FRAMEWORK_NAMES).forEach(function defineWebFrameworkMetricEnum(fwName) {
  Shim.defineProperty(WebFrameworkShim, fwName, FRAMEWORK_NAMES[fwName])
  Shim.defineProperty(WebFrameworkShim.prototype, fwName, FRAMEWORK_NAMES[fwName])
})

WebFrameworkShim.prototype.setFramework = setFramework
WebFrameworkShim.prototype.setDispatcher = setDispatcher
WebFrameworkShim.prototype.recordArgsAsMiddleware = recordArgsAsMiddleware

// -------------------------------------------------------------------------- //


// -------------------------------------------------------------------------- //

function setFramework(framework) {
  this._metrics = {
    PREFIX: framework + '/',
    MIDDLEWARE: metrics.MIDDLEWARE.PREFIX + framework + '/'
  }

  this._logger = this._logger.child({framework: framework})
  this.logger.trace({metrics: this._metrics}, 'Framework metric names set')
}

function setDispatcher() {
  this.agent.environment.setFramework(this.moduleName)
  this.agent.environment.setDispatcher(this.moduleName)
}

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
    spec.middleware = null
  }

  return this.wrap(nodule, properties, function wrapArgs(shim, fn) {
    return function wrappedMiddlwareAdder() {
      var args = shim.argsToArray.apply(shim, arguments)

      // Normalize the route index and pull out the route argument if provided.
      var routeIdx = null
      if (spec.route !== null) {
        routeIdx = shim.normalizeIndex(args.length, spec.route)
      }
      var route = routeIdx === null ? null : args[routeIdx]

      // Normalize the endpoint index as well.
      var endpointIdx = null
      if (spec.endpoint !== null) {
        routeIdx = shim.normalizeIndex(args.length, spec.endpoint)
      }

      for (var i = 0; i < args.length; ++i) {
        // If this argument is the route argument or it is _not_ a function,
        // skip it. Otherwise, call the right wrapper depending on if this is
        // a potential endpoint.
        if (i === routeIdx || !(args[i] instanceof Function)) {
          continue
        } else if (i === endpointIdx) {
          args[i] = _recordRouteHandler.call(shim, args[i], route, spec.middleware)
        } else {
          args[i] = _recordMiddlware.call(shim, args[i], route, spec.middleware)
        }
      }

      return fn.apply(this, args)
    }
  })
}

// -------------------------------------------------------------------------- //

function _recordRouteHandler(middleware, route, spec) {
  spec = spec || {req: this.FIRST, res: this.SECOND, next: this.THIRD, name: null}
  spec.name = 'Endpoint ' + (spec.name || this.getName(middleware))
  return _recordMiddlware(middleware, route, spec)
}

function _recordMiddlware(middleware, route, spec) {
  // Normalize the spec.
  spec = spec || {req: this.FIRST, res: this.SECOND, next: this.THIRD, name: null}
  if (!spec.hasOwnProperty('req')) {
    spec.req = null
  }
  if (!spec.hasOwnProperty('res')) {
    spec.res = null
  }
  if (!spec.hasOwnProperty('next')) {
    spec.next = null
  }
  var segmentName = this._metrics.MIDDLEWARE + (spec.name || this.getName(middleware))

  return this.record(middleware, function middlewareRecorder(shim, fn, fnName, args) {
    // Pull out the request object.
    var reqIdx = shim.normalizeIndex(args.length, spec.req)
    if (reqIdx === null || !args[reqIdx]) {
      shim.logger.debug('Can not find request parameter, not recording.')
      return null
    }
    var req = args[reqIdx]

    // Fetch the transaction information from that request.
    var txInfo = _getTransactionInfo.call(shim, req)
    if (!txInfo || !txInfo.transaction) {
      shim.logger.debug({txInfo: txInfo}, 'Could not get transaction info')
      return null
    }

    // If we have a route piece, add it to the transaction's namestate.
    if (route !== null) {
      txInfo.transaction.nameState.appendPath(route)
    }

    // Wrap up `next` and pop off the current route if we had one.
    var nextIdx = shim.normalizeIndex(args.length, spec.next)
    if (nextIdx !== null && args[nextIdx] instanceof Function) {
      var next = args[nextIdx]
      args[nextIdx] = function wrappedNext() {
        if (route !== null) {
          txInfo.transaction.nameState.popPath(route)
        }
        return next.apply(this, arguments)
      }
    } else {
      nextIdx = null // In case nextIdx wasn't null but the arg wasn't a function.
    }

    // Finally, return the segment descriptor with a recorder.
    return {
      name: segmentName,
      callback: nextIdx,
      recorder: _middlewareRecorder.bind(shim, txInfo.transaction.nameState.getPath()),

      // Hidden class optimization for `Shim#record`.
      extras: null,
      internal: false,
      stream: false
    }
  })
}

function _getTransactionInfo(req) {
  try {
    if (!req.hasOwnProperty('__NR_transactionInfo')) {
      this.setInternalProperty('__NR_transactionInfo', {
        transaction: this.tracer.getTransaction(),
        nameState: []
      })
    }
    return req.__NR_transactionInfo
  } catch (e) {
    this.logger.debug({error: e}, 'Failed to fetch transaction info from req')
    return null
  }
}

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
