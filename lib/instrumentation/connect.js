'use strict'

module.exports = function initialize(agent, connect, moduleName, shim) {
  if (!connect) {
    shim.logger.debug('Connect not supplied, not instrumenting.')
    return false
  }

  shim.setFramework(shim.CONNECT)

  shim.setRouteParser(function parseRoute(shim, fn, fnName, route) {
    return route.url
  })

  var proto = (connect && connect.HTTPServer && connect.HTTPServer.prototype) || // v1
              (connect && connect.proto) // v2

  shim.wrapMiddlewareMounter(proto, 'use', {
    route: shim.FIRST,
    endpoint: shim.LAST,
    wrapper: wrapMiddleware
  })

  wrapConnectExport(shim, connect, !proto)
}

function wrapMiddleware(shim, middleware, name, route) {
  var spec = {
    matchArity: true,
    route: route,
    type: shim.MIDDLEWARE,
    next: shim.LAST,
    req: shim.FIRST
  }

  if (middleware.length === 4) {
    spec.type = shim.ERRORWARE
    spec.req = shim.SECOND
  }

  if (shim.isWrapped(middleware)) {
    // In some cases the middleware will be instrumented by a framework
    // that uses connect (e.g. express v3) and we omit the connect
    // instrumentation.
    return middleware
  }

  return shim.recordMiddleware(middleware, spec)
}

function wrapConnectExport(shim, connect, v3) {
  shim.wrapExport(connect, function wrapExport(shim, fn) {
    var wrapper = shim.wrap(fn, function wrapConnect(shim, _fn) {
      return function wrappedConnect() {
        var res = _fn.apply(this, arguments)
        if (v3) {
          shim.wrapMiddlewareMounter(res, 'use', {
            route: shim.FIRST,
            wrapper: wrapMiddleware
          })
        }
        return res
      }
    })
    shim.proxy(fn, Object.keys(fn), wrapper)
    return wrapper
  })
}
