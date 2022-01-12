/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = function initialize(shim, Koa) {
  if (!shim || !Koa || Object.keys(Koa.prototype).length > 1) {
    shim.logger.debug(
      'Koa instrumentation function called with incorrect arguments, not instrumenting.'
    )
    return
  }

  shim.setFramework(shim.KOA)

  shim.wrapMiddlewareMounter(Koa.prototype, 'use', wrapMiddleware)
  shim.wrapReturn(Koa.prototype, 'createContext', wrapCreateContext)

  // The application is used to handle unhandled errors in the application. We
  // want to notice those.
  shim.wrap(Koa.prototype, 'emit', function wrapper(shim, original) {
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

  return shim.recordMiddleware(middleware, {
    type: shim.MIDDLEWARE,
    promise: true,
    appendPath: true,
    next: shim.LAST,
    req: function getReq(shim, fn, fnName, args) {
      return args[0] && args[0].req
    }
  })
}

function wrapCreateContext(shim, fn, fnName, context) {
  // Many of the properties on the `context` object are just aliases for the same
  // property on the `request` or `response` objects. We take advantage of this
  // by just intercepting the `request` or `response` property and don't touch
  // the `context` property.
  //
  // See: https://github.com/koajs/koa/blob/master/lib/context.js#L186-L241

  // The `context.body` and `context.response.body` properties are how users set
  // the response contents. It is roughly equivalent to `res.send()` in Express.
  // Under the hood, these set the `_body` property on the `context.response`.
  context.__NR_body = context.response.body
  context.__NR_bodySet = false
  Object.defineProperty(context.response, '_body', {
    get: () => context.__NR_body,
    set: function setBody(val) {
      if (!context.__NR_koaRouter) {
        shim.savePossibleTransactionName(context.req)
      }
      context.__NR_body = val
      context.__NR_bodySet = true
    }
  })

  context.__NR_matchedRoute = null
  context.__NR_koaRouter = false
  Object.defineProperty(context, '_matchedRoute', {
    get: () => context.__NR_matchedRoute,
    set: (val) => {
      const match = getLayerForTransactionName(context)

      // match should never be undefined given _matchedRoute was set
      if (match) {
        const currentSegment = shim.getActiveSegment()

        // Segment/Transaction may be null, see:
        //  - https://github.com/newrelic/node-newrelic-koa/issues/32
        //  - https://github.com/newrelic/node-newrelic-koa/issues/33
        if (currentSegment) {
          const transaction = currentSegment.transaction

          if (context.__NR_matchedRoute) {
            transaction.nameState.popPath()
          }

          transaction.nameState.appendPath(match.path)
          transaction.nameState.markPath()
        }
      }

      context.__NR_matchedRoute = val
      // still true if somehow match is undefined because we are
      // using koa-router naming and don't want to allow default naming
      context.__NR_koaRouter = true
    }
  })

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
      if (!context.__NR_bodySet && !context.__NR_koaRouter) {
        shim.savePossibleTransactionName(context.req)
      }
      return statusDescriptor.set.call(this, val)
    }
  })
}

function getLayerForTransactionName(context) {
  // Context.matched might be null
  // See https://github.com/newrelic/node-newrelic-koa/pull/29
  if (!context.matched) {
    return null
  }
  for (let i = context.matched.length - 1; i >= 0; i--) {
    const layer = context.matched[i]
    if (layer.opts.end) {
      return layer
    }
  }

  return null
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
