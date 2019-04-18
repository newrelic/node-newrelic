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
  const router = middleware.router

  if (router && router.stack && router.stack.length) {
    const stack = router.stack
    for (let i = 0; i < stack.length; ++i) {
      const layer = stack[i]
      const spec = {
        route: layer.path,
        type: shim.MIDDLEWARE,
        next: shim.LAST,
        promise: true,
        appendPath: false,
        req: function getReq(shim, fn, fnName, args) {
          return args[0] && args[0].req
        }
      }
      layer.stack = layer.stack.map(function wrapLayerMiddleware(m) {
        return shim.recordMiddleware(m, spec)
      })
    }
    const wrappedRouter = shim.recordMiddleware(middleware, {
      type: shim.ROUTER,
      promise: true,
      appendPath: false,
      req: function getReq(shim, fn, fnName, args) {
        return args[0] && args[0].req
      }
    })
    Object.keys(router).forEach(function copyKeys(k) {
      wrappedRouter[k] = router[k]
    })
    return wrappedRouter
  }

  // Skip middleware that are already wrapped.
  if (shim.isWrapped(middleware)) {
    return middleware
  }

  return shim.recordMiddleware(middleware, {
    type: shim.MIDDLEWARE,
    promise: true,
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
      if (!context.__NR_matchedSet) {
        shim.savePossibleTransactionName(context.req)
      }
      context.__NR_body = val
      context.__NR_bodySet = true
    }
  })

  context.__NR_matchedRoute = null
  context.__NR_matchedSet = false
  Object.defineProperty(context, '_matchedRoute', {
    get: () => context.__NR_matchedRoute,
    set: (val) => {
      const match = getLayerForTransactionName(context)

      // match should never be undefined given _matchedRoute was set
      if (match) {
        const tx = shim.agent.tracer.getTransaction()
        tx.nameState.appendPath(match.path)
        tx.nameState.markPath()
      }

      context.__NR_matchedRoute = val
      // still true if somehow match is undefined because we are
      // using koa-router naming and don't want to allow default naming
      context.__NR_matchedSet = true
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
      if (!context.__NR_bodySet) {
        shim.savePossibleTransactionName(context.req)
      }
      return statusDescriptor.set.call(this, val)
    }
  })
}

function getLayerForTransactionName(context) {
  let match = null
  for (let i = 0; i < context.matched.length; i++) {
    const layer = context.matched[i]
    if (!layer.opts.end) {
      continue
    }

    if (!match || layer.paramNames.length < match.paramNames.length) {
      match = layer
    }
  }

  return match
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
