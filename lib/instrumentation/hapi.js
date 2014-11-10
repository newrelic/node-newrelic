'use strict'

var shimmer = require('../shimmer.js')
var urltils = require('../util/urltils.js')
var logger = require('../logger.js').child({component : 'hapi'})
var record = require('../metrics/recorders/generic.js')
var NAMES = require('../metrics/names.js')
var VIEW = NAMES.VIEW


function nameFromRequest(segment, request) {
  if (!segment) return logger.error("No New Relic context to set Hapi route name on.")
  if (!request) return logger.debug("No Hapi request to use for naming.")

  var transaction = segment.trace.transaction
  var path = request.route && request.route.path


  if (!path) return logger.debug({request : request}, "No path found on Hapi route.")

  urltils.copyParameters(transaction.agent.config, request.params, segment.parameters)

  transaction.partialName = NAMES.HAPI.PREFIX + transaction.verb +
                            NAMES.ACTION_DELIMITER + path
}

function setDispatcher(agent) {
  agent.environment.setDispatcher('hapi')
  agent.environment.setFramework('hapi')
}

module.exports = function initialize(agent, hapi) {
  if (!agent) return logger.error("Hapi instrumentation bootstrapped without agent")
  if (!hapi) return logger.error("Hapi instrumentation applied without module")

  var tracer = agent.tracer

  function wrapRender(render) {
    return function wrappedRender(filename, context, options, callback) {
      var wrapped = callback

      // FIXME: this is going to be the most recent segment, which may not be right
      var segment = tracer.getSegment()
      if (segment && callback) {
        wrapped = tracer.callbackProxy(function cb_callbackProxy() {
          segment.end()

          return callback.apply(this, arguments)
        })
      }

      return render.call(this, filename, context, options, wrapped)
    }
  }

  function wrapStart(start) {
    return function wrappedStart() {
      setDispatcher(agent)

      /* The patched module loader doesn't access the filesystem itself, so
       * lazily apply the patch to Views.prototype.render only once a Views
       * object has been assigned as the view manager.
       */
      if (this._views) {
        logger.debug('Hapi view manager set; instrumenting render.')
        var proto = this._views.constructor.prototype
        shimmer.wrapMethod(proto, 'hapi.Views.prototype', 'render', wrapRender)
      }

      return start.apply(this, arguments)
    }
  }

  function wrapViews(views) {
    return function wrappedViews() {
      var returned = views.apply(this, arguments)

      /* The patched module loader doesn't access the filesystem itself, so
       * lazily apply the patch to Views.prototype.render only once a Views
       * object has been assigned as the view manager.
       */
      if (this._views) {
        var proto = this._views.constructor.prototype
        shimmer.wrapMethod(proto, 'hapi.Views.prototype', 'render', wrapRender)
      } else {
        logger.warn('Hapi view manager set without manager actually being created.')
      }

      return returned
    }
  }

  function wrapReplyView(reply) {
    var view = reply.view
    reply.view = function (template) {
      if (tracer.getTransaction()) {
        var name = VIEW.PREFIX + template + VIEW.RENDER
        tracer.addSegment(name, record)
      }

      return view.apply(this, arguments)
    }
  }

  function wrapHandler(handler) {
    return function cls_wrapHandler(request, reply) {
      if (!tracer.getTransaction()) {
        logger.trace("Hapi route handler called outside transaction.")
        return handler.apply(this, arguments)
      }

      nameFromRequest(tracer.getSegment(), request)
      if (reply && reply.view) wrapReplyView(reply)

      return handler.apply(this, arguments)
    }
  }

  function tableVisitor(before, after, vhost, visit) {
    if (!vhost) vhost = '*'

    if (after) {
      Object.keys(after).forEach(function cb_forEach(method) {
        var beforeHandlers = before && before[method]
        var afterHandlers = after[method]
        for (var i = 0; i < afterHandlers.length; i++) {
          var route = afterHandlers[i]
          logger.debug('Instrumented hapi route [host %s] %s %s',
                       vhost, method, route.path)
          if (!beforeHandlers || beforeHandlers.indexOf(route) === -1) {
            // hapi@6.9.0 started nesting the route handler 1 layer deeper
            if(route.route) {
              route = route.route
            }

            if(route.settings && route.settings.handler) {
              route.settings.handler = visit(route.settings.handler)
            } else {
              logger.warn('Could not find handler to instrument for hapi route [host %s] %s %s',
                  vhost, method, route.path)
            }
          }
        }
      })
    }
  }

  function wrapRoute(_route) {
    return function wrappedRoute(configs, env) {
      var server = this

      var router = server._router
      if (!router) return logger.warn("no router found on hapi server")

      var vhosts = router.vhosts
      var beforeHosts
      if (vhosts) {
        logger.debug("capturing vhosts on hapi router")

        Object.keys(vhosts).forEach(function cb_forEach(host) {
          beforeHosts[host] = {}
          Object.keys(vhosts[host]).forEach(function cb_forEach(method) {
            beforeHosts[host][method] = vhosts[host][method].slice()
          })
        })
      }

      var symbol
      if (typeof router.table === 'function') {
      // hapi 2: router.table -> router.routes & router.table is a function
        symbol = 'routes'
      } else {
      // hapi 1: when vhosts aren't used, router.table contains the routes
        symbol = 'table'
      }

      var table = router[symbol]
      var beforeTable = {}
      if (table) {
        Object.keys(table).forEach(function cb_forEach(method) {
          beforeTable[method] = table[method].slice()
        })
      }

      var returned = _route.call(this, configs, env)

      vhosts = router.vhosts
      if (vhosts) {
        Object.keys(vhosts).forEach(function cb_forEach(host) {
          tableVisitor(beforeHosts[host], vhosts[host], host, wrapHandler)
        })
      }

      table = router[symbol]
      if (table) tableVisitor(beforeTable, table, undefined, wrapHandler)

      return returned
    }
  }

  function wrapCreateServer(createServer) {
    return function createServerWrapper() {
      var server = createServer.apply(this, arguments)
      shimServerPrototype(server.constructor.prototype)
      // Now that we have instrumented the server prototype, uninstrument
      // createServer as it serves no purpose.
      shimmer.unwrapMethod(hapi, 'hapi', 'createServer')
      return server
    }
  }

  function shimServerPrototype(proto) {
    shimmer.wrapMethod(proto, 'hapi.Server.prototype', 'start',  wrapStart)
    shimmer.wrapMethod(proto, 'hapi.Server.prototype', 'views',  wrapViews)
    shimmer.wrapMethod(proto, 'hapi.Server.prototype', '_route', wrapRoute)
  }

  var proto = hapi && hapi.Server && hapi.Server.prototype
  // Hapi 1 - 7.1.1
  if (proto && proto.start && proto.views && proto._route) {
    shimServerPrototype(proto)
  // Hapi 7.2+
  } else if (proto && Object.keys(proto).length === 0) {
    // This gets removed on first invocation as it is just used to patch a
    // deeper prototype.
    shimmer.wrapMethod(hapi, 'hapi', 'createServer', wrapCreateServer)
  } else {
    logger.warn('hapi Server constructor not found; can\'t instrument')
  }
}
