/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const record = require('../../metrics/recorders/generic')
// This object defines all the events that we want to wrap extensions
// for, as they are the only ones associated with requests.
const ROUTE_EVENTS = {
  onRequest: true,
  onPreAuth: true,
  onCredentials: true,
  onPostAuth: true,
  onPreHandler: true,
  onPostHandler: true,
  onPreResponse: true,

  // Server events
  onPreStart: false,
  onPostStart: false,
  onPreStop: false,
  onPostStop: false
}

module.exports = function initialize(agent, hapi, moduleName, shim) {
  if (!agent || !hapi || !shim) {
    shim &&
      shim.logger.debug(
        'Hapi instrumentation function called with incorrect arguments, not instrumenting.'
      )
    return false
  }

  shim.setFramework(shim.HAPI)

  shim.setErrorPredicate(function hapiErrorPredicate(err) {
    return err instanceof Error
  })

  // At this point, framework and error predicate have both already been set via ./hapi,
  // so we only need to set the response predicate and wrap the server object
  shim.setResponsePredicate(function hapiResponsePredicate(args, result) {
    return !(result instanceof Error) && result !== args[1].continue
  })

  // 'Server' and 'server' both point to the same export,
  // but we can't make any assumption about which will be used.
  // Since we wrap the prototype, the second wrap should exit early.
  shim.wrapReturn(hapi, 'server', serverFactoryWrapper)
  shim.wrapReturn(hapi, 'Server', serverFactoryWrapper)
}

function serverFactoryWrapper(shim, fn, fnName, server) {
  serverPostConstructor.call(server, shim)
}

function serverPostConstructor(shim) {
  const proto = Object.getPrototypeOf(this)

  if (shim.isWrapped(proto.decorate)) {
    shim.logger.trace('Already wrapped Server proto, not wrapping again')
    return
  }

  wrapProtoDecorate(shim, proto)
  wrapProtoRoute(shim, proto)
  wrapProtoExt(shim, proto)
}

function wrapProtoDecorate(shim, proto) {
  shim.wrap(proto, 'decorate', function wrapDecorate(shim, original) {
    return function wrappedDecorate(type) {
      // server.decorate also accepts 'request', 'toolkit', 'server' types,
      // but we're only concerned with 'handler'
      if (type !== 'handler') {
        return original.apply(this, arguments)
      }

      // Convert arguments to usable array
      const args = shim.argsToArray.apply(shim, arguments)

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
          const ret = fn.apply(this, arguments)

          return typeof ret === 'function' ? wrapRouteHandler(shim, ret, route && route.path) : ret
        }
      })

      return original.apply(this, args)
    }
  })
}

function wrapProtoRoute(shim, proto) {
  shim.wrap(proto, 'route', function wrapRoute(shim, original) {
    return function wrappedRoute() {
      const args = shim.argsToArray.apply(shim, arguments)

      if (!shim.isObject(args[0])) {
        return original.apply(this, args)
      }

      // If route is created via a plugin, pull prefix if it exists
      const prefix =
        (this.realm &&
          this.realm.modifiers &&
          this.realm.modifiers.route &&
          this.realm.modifiers.route.prefix) ||
        ''

      _wrapRoute(shim, args[0], prefix)

      return original.apply(this, args)
    }
  })
}

function _wrapRoute(shim, route, prefix) {
  const routePath = prefix + route.path
  if (shim.isArray(route)) {
    for (let i = 0; i < route.length; ++i) {
      _wrapRoute(shim, route[i], prefix)
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

function wrapProtoExt(shim, proto) {
  shim.wrap(proto, 'ext', function wrapExt(shim, original) {
    return function wrappedExt(event, method) {
      const args = shim.argsToArray.apply(shim, arguments)

      if (shim.isArray(event)) {
        for (let i = 0; i < event.length; i++) {
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
    for (let i = 0; i < container.length; ++i) {
      container[i] = wrapPreHandlers(shim, container[i], path)
    }
    return container
  } else if (shim.isFunction(container)) {
    return wrapPreHandler(shim, container, path)
  } else if (container.method && shim.isFunction(container.method)) {
    return shim.wrap(container, 'method', function wrapHandler(shim, handler) {
      return wrapPreHandler(shim, handler, path)
    })
  }
}

function wrapPreHandler(shim, container, path) {
  return shim.record(container, (shim) => {
    return { name: [shim.HAPI, ' pre handler: ', '(', path, ')'].join(''), recorder: record }
  })
}

function wrapRouteHandler(shim, handler, path) {
  return shim.recordMiddleware(handler, {
    route: path,
    req: function getReq(shim, fn, fnName, args) {
      const [request] = args
      return request?.raw?.req
    },
    promise: true,
    params: function getParams(shim, fn, fnName, args) {
      const [req] = args
      return req?.params
    }
  })
}

function wrapMiddleware(shim, middleware, event) {
  if (!ROUTE_EVENTS[event]) {
    return middleware
  }

  return shim.recordMiddleware(middleware, {
    route: event,
    type: event === 'onPreResponse' ? shim.ERRORWARE : shim.MIDDLEWARE,
    promise: true,
    req: function getReq(_shim, _fn, _fnName, args) {
      const [req] = args
      return req?.raw?.req
    }
  })
}
