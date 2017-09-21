'use strict'

var logger = require('../logger').child({component: 'hapi'})

module.exports = function initialize(agent, hapi, moduleName, shim) {
  if (!agent || !hapi || !shim) {
    logger.debug(
      'Hapi instrumentation function called with incorrect arguments, not instrumenting.'
    )
    return false
  }

  shim.setFramework(shim.HAPI)

  shim.setErrorPredicate(function expressErrorPredicate(err) {
    return (err instanceof Error)
  })

  if (hapi.createServer) {
    wrapCreateServer(shim, hapi)
  } else if (hapi.Server) {
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

  shim.wrapMiddlewareMounter(Server.prototype, 'ext', {
    route: shim.FIRST,
    wrapper: function wrapMiddleware(shim, middleware, name, route) {
      var method = null
      var spec = {
        route: route,
        type: shim.MIDDLEWARE,
        req: function getReq(shim, fn, fnName, args) {
          return args[0].raw.req
        },
        next: function wrapNext(shim, fn, fnName, args, wrap) {
          var reply = args[1]
          if (!reply || !shim.isFunction(reply.continue)) return
          wrap(reply, 'continue')
        }
      }
      return shim.recordMiddleware(middleware, method, spec)
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
    params: function getParams(shim, fn, fnName, args, req) {
      var req = args[0]
      if (!req) return
      return req.params
    }
  })
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
