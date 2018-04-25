'use strict'

var shared = require('./shared')

// TODO: abstract and consolidate mostly-shared hapi functionality
module.exports = function initialize(agent, hapi, moduleName, shim) {
  // At this point, framework and error predicate have both already been set via ./hapi,
  // so we only need to set the response predicate and wrap the server object
  shim.setResponsePredicate(function hapiResponsePredicate(args, result) {
    return !(result instanceof Error) && (result !== args[1].continue)
  })

  shim.wrapReturn(hapi, 'Server', serverFactoryWrapper)
}

function serverFactoryWrapper(shim, fn, fnName, server) {
  serverPostConstructor.call(server, shim)
}

function serverPostConstructor(shim) {
  var proto = Object.getPrototypeOf(this)

  if (shim.isWrapped(proto.decorate)) {
    shim.logger.trace('Already wrapped Server proto, not wrapping again')
    return
  }

  shim.wrap(proto, 'decorate', function wrapDecorate(shim, original) {
    return function wrappedDecorate(type) {
      // server.decorate also accepts 'request', 'toolkit', 'server' types,
      // but we're only concerned with 'handler'
      if (type !== 'handler') {
        return original.apply(this, arguments)
      }

      // Convert arguments to usable array
      var args = shim.argsToArray.apply(shim, arguments)

      // Wrap the third server.decorate arg, the user-defined handler
      shim.wrap(args, shim.THIRD, function wrapHandler(shim, fn) {
        if (typeof fn !== 'function') {
          return
        }

        if (fn.defaults) {
          wrappedHandler.defaults = fn.defaults
        }

        return wrappedHandler

        function wrappedHandler(route) {
          var ret = fn.apply(this, arguments)

          return (typeof ret === 'function')
            ? wrapRouteHandler(shim, ret, route && route.path)
            : ret
        }
      })

      return original.apply(this, args)
    }
  })

  shim.wrap(proto, 'route', function wrapRoute(shim, original) {
    return function wrappedRoute() {
      var args = shim.argsToArray.apply(shim, arguments)

      if (!shim.isObject(args[0])) {
        return original.apply(this, args)
      }

      // If route is created via a plugin, pull prefix if it exists
      const prefix = this.realm
        && this.realm.modifiers
        && this.realm.modifiers.route
        && this.realm.modifiers.route.prefix
        || ''

      _wrapRoute(shim, args[0])

      return original.apply(this, args)

      function _wrapRoute(shim, route) {
        const routePath = prefix + route.path
        if (shim.isArray(route)) {
          for (var i = 0; i < route.length; ++i) {
            _wrapRoute(shim, route[i])
          }
          return
        } else if (route.options) {
          // v17 now prefers `options` property...
          if (route.options.pre) {
            // config objects can also contain multiple OTHER handlers in a `pre` array
            route.options.pre = wrapPreHandlers(shim, route.options.pre, routePath)
          }
          if (route.options.handler) {
            _wrapRouteHandler(shim, route.options, routePath)
            return
          }
        } else if (route.config) {
          // ... but `config` still works
          if (route.config.pre) {
            route.config.pre = wrapPreHandlers(shim, route.config.pre, routePath)
          }
          if (route.config.handler) {
            _wrapRouteHandler(shim, route.config, routePath)
            return
          }
        }
        _wrapRouteHandler(shim, route, routePath)
      }

      function _wrapRouteHandler(shim, container, path) {
        if (typeof container.handler !== 'function') {
          return
        }
        shim.wrap(container, 'handler', function wrapHandler(shim, handler) {
          return wrapRouteHandler(shim, handler, path)
        })
      }
    }
  })

  shim.wrap(proto, 'ext', function wrapExt(shim, original) {
    return function wrappedExt(event, method) {
      var args = shim.argsToArray.apply(shim, arguments)

      if (shim.isArray(event)) {
        for (var i = 0; i < event.length; i++) {
          event[i].method = wrapMiddleware(shim, event[i].method, event[i].type)
        }
      } else if (shim.isObject(event)) {
        event.method = wrapMiddleware(shim, event.method, event.type)
      } else if (shim.isString(event)) {
        args[1] = wrapMiddleware(shim, method, event)
      } else {
        shim.logger.debug('Unsupported event type %j', event)
        return
      }

      return original.apply(this, args)
    }
  })
}

function wrapPreHandlers(shim, container, path) {
  if (shim.isArray(container)) {
    for (var i = 0; i < container.length; ++i) {
      container[i] = wrapPreHandlers(shim, container[i], path)
    }
    return container
  } else if (shim.isFunction(container)) {
    return wrapRouteHandler(shim, container, path)
  } else if (container.method && shim.isFunction(container.method)) {
    return shim.wrap(container, 'method', function wrapHandler(shim, handler) {
      return wrapRouteHandler(shim, handler, path)
    })
  }
}

function wrapRouteHandler(shim, handler, path) {
  return shim.recordMiddleware(handler, {
    route: path,
    req: function getReq(shim, fn, fnName, args) {
      var request = args[0]
      if (request && request.raw) {
        return request.raw.req
      }
    },
    promise: true,
    params: function getParams(shim, fn, fnName, args) {
      var req = args[0]
      return req && req.params
    }
  })
}

function wrapMiddleware(shim, middleware, event) {
  if (!shared.ROUTE_EVENTS[event]) {
    return middleware
  }

  return shim.recordMiddleware(middleware, {
    route: event,
    type: shim.MIDDLEWARE,
    promise: true,
    req: function getReq(shim, fn, fnName, args) {
      var req = args[0]
      return req && req.raw && req.raw.req
    }
  })
}
