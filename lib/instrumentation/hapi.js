'use strict'

var shared = require('./hapi/shared')


module.exports = function initialize(agent, hapi, moduleName, shim) {
  if (!agent || !hapi || !shim) {
    shim && shim.logger.debug(
      'Hapi instrumentation function called with incorrect arguments, not instrumenting.'
    )
    return false
  }

  shim.setFramework(shim.HAPI)

  shim.setErrorPredicate(function hapiErrorPredicate(err) {
    return (err instanceof Error)
  })

  if (hapi.createServer) {
    wrapCreateServer(shim, hapi)
  } else if (hapi.Server) {
    // Server.connection was removed in v17
    if (!hapi.Server.prototype.connection) {
      return require('./hapi/hapi-17')(agent, hapi, moduleName, shim)
    }

    // See if we can find the plugin class. This should be the super class of
    // Server and will cover more scenarios.
    var Plugin = hapi.Server.super_
    if (_isPluginClass(Plugin)) {
      wrapServer(shim, Plugin)
    } else {
      wrapServer(shim, hapi.Server)
    }
  }
}

function wrapServer(shim, Server) {
  // wrap server.handler function that registers a new handler type
  // the second argument is expected to be a function that generates the handler function
  shim.wrap(Server.prototype, 'handler', function wrapHandler(shim, original) {
    return function wrappedHandler() {
      var args = shim.argsToArray.apply(shim, arguments)

      var handlerGenerator = args[1]
      if (typeof handlerGenerator === 'function') {
        args[1] = wrapGenerator(handlerGenerator)
      }

      return original.apply(this, args)

      function wrapGenerator(generator) {
        function wrappedGenerator() {
          var generatorArgs = shim.argsToArray.apply(shim, arguments)
          var handler = generator.apply(this, generatorArgs)
          if (typeof handler === 'function') {
            var route = generatorArgs[0]
            return wrapRouteHandler(shim, handler, route && route.path)
          }
          return handler
        }

        wrappedGenerator.defaults = generator.defaults

        return wrappedGenerator
      }
    }
  })

  shim.wrap(Server.prototype, 'route', function wrapRoute(shim, original) {
    return function wrappedRoute() {
      var args = shim.argsToArray.apply(shim, arguments)

      // first argument is expected to be the route configuration object
      if (!shim.isObject(args[0])) {
        return original.apply(this, args)
      }

      _wrapRoute(shim, args[0])

      return original.apply(this, args)

      function _wrapRoute(shim, route) {
        // handler function could be on the route object, or on a nested config object
        if (shim.isArray(route)) {
          for (var i = 0; i < route.length; ++i) {
            _wrapRoute(shim, route[i])
          }
        } else if (route.config) {
          _wrapRouteHandler(shim, route.config, route.path)
        } else {
          _wrapRouteHandler(shim, route, route.path)
        }
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

  shim.wrap(Server.prototype, 'ext', function wrapExt(shim, original) {
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

function wrapCreateServer(shim, hapi) {
  shim.wrap(hapi, 'createServer', function getWrapper(shim, createServer) {
    return function createServerWrapper() {
      var server = createServer.apply(this, arguments)
      wrapServer(shim, server.constructor)
      shim.unwrap(hapi, 'createServer')
      return server
    }
  })
}

function wrapRouteHandler(shim, handler, path) {
  var wrappedHandler = shim.wrap(handler, function wrapHandler(shim, original) {
    return function wrapped() {
      var reply = arguments[1]
      if (reply) {
        shim.recordRender(reply, 'view')
      }
      return original.apply(this, arguments)
    }
  })

  return shim.recordMiddleware(wrappedHandler, {
    route: path,
    req: function getReq(shim, fn, fnName, args) {
      var request = args[0]
      if (request && request.raw) {
        return request.raw.req
      }
    },
    next: function wrapNext(shim, fn, fnName, args, wrap) {
      var reply = args[1]
      if (!shim.isFunction(reply)) return
      wrap(reply, 'response', true)
    },
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

  var spec = {
    route: event,
    type: shim.MIDDLEWARE,
    next: function wrapNext(shim, fn, fnName, args, wrap) {
      var reply = args[1]
      if (!reply || !shim.isFunction(reply.continue)) return
      wrap(reply, 'continue')
    },
    req: function getReq(shim, fn, fnName, args) {
      var request = args[0]
      if (request && request.raw) {
        return request.raw.req
      }
    }
  }

  return shim.recordMiddleware(middleware, spec)
}

function _isPluginClass(Plugin) {
  if (typeof Plugin !== 'function' || !Plugin.prototype) {
    return false
  }

  var proto = Plugin.prototype
  return (
    typeof proto.handler === 'function' &&
    typeof proto.route === 'function' &&
    typeof proto.ext === 'function'
  )
}
