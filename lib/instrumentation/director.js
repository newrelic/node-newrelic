'use strict'

module.exports = function initialize(agent, director, moduleName, shim) {
  shim.setFramework(shim.DIRECTOR)

  shim.setRouteParser(function routeParser(shim, fn, fnName, route) {
    return route instanceof Array ? route.join('/') : route
  })

  var methods = ['on', 'route']
  var proto = director.Router.prototype
  shim.wrapMiddlewareMounter(proto, methods, {
    route: shim.SECOND,
    wrapper: function wrapMiddleware(shim, middleware, name, path) {
      return shim.recordMiddleware(middleware, {
        route: path,
        req: function getReq() {
          return this.req
        },
        params: function getParams() {
          return this.params
        },
        next: shim.LAST
      })
    }
  })

  shim.wrap(proto, 'mount', function wrapMount(shim, mount) {
    return function wrappedMount(routes, path) {
      var isAsync = this.async
      shim.wrap(routes, director.http.methods, function wrapRoute(shim, route) {
        return shim.recordMiddleware(route, {
          route: path.join('/'),
          req: function getReq() {
            return this.req
          },
          params: function getParams() {
            return this.params
          },
          next: isAsync ? shim.LAST : null
        })
      })
      var args = [routes, path]
      return mount.apply(this, args)
    }
  })
}
