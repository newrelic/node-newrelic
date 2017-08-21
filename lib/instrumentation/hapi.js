'use strict'

var logger = require('../logger').child({component: 'hapi'})

module.exports = function initialize(agent, hapi, moduleName, shim) {
  if (!agent || !hapi || !shim) {
    logger.debug('Hapi instrumentation function called with incorrect arguments,' +
      ' not instrumenting.')
    return false
  }

  shim.setFramework(shim.HAPI)

  shim.setErrorPredicate(function expressErrorPredicate(err) {
    return (err instanceof Error)
  })

  if (hapi.createServer) {
    wrapCreateServer(shim, hapi)
  } else if (hapi.Server) {
    wrapServer(shim, hapi.Server)
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
        return function wrappedGenerator() {
          var generatorArgs = shim.argsToArray.apply(shim, arguments)
          var handler = generator.apply(this, generatorArgs)
          if (typeof handler === 'function') {
            var route = generatorArgs[0]
            return wrapRouteHandler(shim, handler, route && route.path)
          }
          return handler
        }
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

      var route = args[0]
      // handler function could be on the route object, or on a nested config object
      if (route.config) {
        _wrapRouteHandler(shim, route.config, route.path)
      } else {
        _wrapRouteHandler(shim, route)
      }

      return original.apply(this, args)

      function _wrapRouteHandler(shim, container, path) {
        if (typeof container.handler !== 'function') {
          return
        }
        shim.wrap(container, 'handler', function wrapHandler(shim, handler) {
          return wrapRouteHandler(shim, handler, path || route.path)
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
