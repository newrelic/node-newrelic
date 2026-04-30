/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const symbols = require('../../symbols')
const { MiddlewareSpec, MiddlewareMounterSpec } = require('../../shim/specs')

module.exports = function initialize(shim, Koa) {
  // Koa's exports are different depending on using CJS or MJS - https://github.com/koajs/koa/issues/1513
  const proto = Koa.prototype || Koa.default?.prototype

  if (!shim || !Koa || !proto || Object.keys(proto).length > 1) {
    shim.logger.debug(
      'Koa instrumentation function called with incorrect arguments, not instrumenting.'
    )
    return
  }

  shim.setFramework(shim.KOA)

  shim.wrapMiddlewareMounter(
    proto,
    'use',
    new MiddlewareMounterSpec({
      wrapper: wrapMiddleware
    })
  )
  shim.wrapReturn(proto, 'createContext', wrapCreateContext)

  // The application is used to handle unhandled errors in the application. We
  // want to notice those.
  shim.wrap(proto, 'emit', function wrapper(shim, original) {
    return function wrappedEmit(evt, err, ctx) {
      if (evt === 'error' && ctx) {
        shim.noticeError(ctx.req, err)
      }
      return original.apply(this, arguments)
    }
  })
}

function wrapMiddleware(shim, middleware) {
  // Skip middleware that are already wrapped.
  if (shim.isWrapped(middleware)) {
    return middleware
  }

  if (middleware.router) {
    shim.logger.info(
      [
        'Found uninstrumented router property on Koa middleware.',
        'This may indicate either an unsupported routing library is being used,',
        'or a particular version of a supported library is not fully instrumented.'
      ].join(' ')
    )
  }

  return shim.recordMiddleware(
    middleware,
    new MiddlewareSpec({
      type: shim.MIDDLEWARE,
      promise: true,
      appendPath: true,
      next: shim.LAST,
      req: function getReq(shim, fn, fnName, args) {
        return args[0] && args[0].req
      }
    })
  )
}

/**
 * Many of the properties on the `context` object are just aliases for the same
 * property on the `request` or `response` objects. We take advantage of this
 * by just intercepting the `request` or `response` property and don't touch
 * the `context` property.
 * See: https://github.com/koajs/koa/blob/master/lib/context.js#L186-L241
 *
 * @param {Shim} shim instance of shim
 * @param {Function} _fn createContext function
 * @param {string} _fnName name of function
 * @param {object} context koa ctx object
 */
function wrapCreateContext(shim, _fn, _fnName, context) {
  wrapResponseBody(shim, context)
  wrapMatchedRoute(shim, context)
  wrapResponseStatus(shim, context)
}

function wrapResponseBody(shim, context) {
  // The `context.body` and `context.response.body` properties are how users set
  // the response contents. It is roughly equivalent to `res.send()` in Express.
  // Under the hood, these set the `_body` property on the `context.response`.
  context[symbols.koaBody] = context.response.body
  context[symbols.koaBodySet] = false

  Object.defineProperty(context.response, '_body', {
    get: () => context[symbols.koaBody],
    set: function setBody(val) {
      if (!context[symbols.koaRouter]) {
        shim.savePossibleTransactionName(context.req)
      }
      context[symbols.koaBody] = val
      context[symbols.koaBodySet] = true
    }
  })
}

function wrapMatchedRoute(shim, context) {
  context[symbols.koaMatchedRoute] = null
  context[symbols.koaRouter] = false

  Object.defineProperty(context, '_matchedRoute', {
    get: () => context[symbols.koaMatchedRoute],
    set: (val) => {
      // match should never be undefined given _matchedRoute was set
      if (val) {
        const transaction = shim.tracer.getTransaction()

        // Segment/Transaction may be null, see:
        //  - https://github.com/newrelic/node-newrelic-koa/issues/32
        //  - https://github.com/newrelic/node-newrelic-koa/issues/33
        if (transaction) {
          if (context[symbols.koaMatchedRoute]) {
            transaction.nameState.popPath()
          }

          transaction.nameState.appendPath(val)
          transaction.nameState.markPath()
        }
      }

      context[symbols.koaMatchedRoute] = val
      // still true if somehow match is undefined because we are
      // using koa-router naming and don't want to allow default naming
      context[symbols.koaRouter] = true
    }
  })
}

function wrapResponseStatus(shim, context) {
  // Sometimes people just set `context.status` or `context.response.status`
  // without setting a body. When this happens we'll want to use that as the
  // response point to name the transaction. `context.status` is just an alias
  // for `context.response.status` so we only wrap the latter.
  const statusDescriptor = getInheritedPropertyDescriptor(context.response, 'status')
  if (!statusDescriptor) {
    shim.logger.debug('Failed to find status descriptor on context.response')
    return
  } else if (!statusDescriptor.get || !statusDescriptor.set) {
    shim.logger.debug(statusDescriptor, 'Status descriptor missing getter/setter pair')
    return
  }

  Object.defineProperty(context.response, 'status', {
    get: () => statusDescriptor.get.call(context.response),
    set: function setStatus(val) {
      if (!context[symbols.koaBodySet] && !context[symbols.koaRouter]) {
        shim.savePossibleTransactionName(context.req)
      }
      return statusDescriptor.set.call(this, val)
    }
  })
}

function getInheritedPropertyDescriptor(obj, property) {
  let proto = obj
  let descriptor = null
  do {
    descriptor = Object.getOwnPropertyDescriptor(proto, property)
    proto = Object.getPrototypeOf(proto)
  } while (!descriptor && proto)

  return descriptor
}
