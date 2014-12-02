'use strict'

var shimmer = require('../shimmer.js')
var urltils = require('../util/urltils.js')
var logger = require('../logger.js').child({component : 'express'})
var record = require('../metrics/recorders/generic.js')
var NAMES = require('../metrics/names.js')

var VIEW = NAMES.VIEW
var ORIGINAL = '__NR_original'
var RESERVED = [ // http://es5.github.io/#x7.6.1.2
  // always (how would these even get here?)
  'class', 'enum', 'extends', 'super', 'const', 'export', 'import',
  // strict
  'implements', 'let', 'private', 'public', 'yield', 'interface',
  'package', 'protected', 'static'
]

/**
 * ES5 strict mode disallows some identifiers that are allowed in non-strict
 * code. Mangle function names that are on that list of keywords so they're
 * non-objectionable in strict mode (which is currently enabled everywhere
 * inside the agent, as well as at many customer sites).
 *
 * If you really need to crawl your Express apps middleware stack, change
 * your test to use name.indexOf('whatever') === 0 as the predicate instead
 * of name === 'whatever'. It's a little slower, but you shouldn't be doing
 * that anyway.
 *
 * @param {string} name The candidate function name
 *
 * @returns {string} A safe (potentially mangled) function name.
 */
function mangle(name) {
  if (RESERVED.indexOf(name) !== -1) return name + '_'

  return name
}

// Ensures that partialName begins with the express prefix
// http instrumentation will set partialName before passing the request off to express
function ensurePartialName(trans) {
  if(!trans.partialName || trans.partialName.lastIndexOf(NAMES.EXPRESS.PREFIX, 0) !== 0) {
    trans.partialName = NAMES.EXPRESS.PREFIX + trans.verb + NAMES.ACTION_DELIMITER + '/'
  }
}

function nameFromRoute(segment, route, params) {
  if (!segment) return logger.error("No New Relic context to set Express route name on.")
  if (!route) return logger.debug("No Express route to use for naming.")

  // Express 4.3.0 changed where params live. On newer versions of Express
  // params should be populated, on older it shouldn't be.
  params = params || route.params

  var transaction = segment.trace.transaction
    , path        = route.path || route.regexp


  if (!path) return logger.debug({route : route}, "No path found on Express route.")

  // when route is a regexp, route.path will be a regexp
  if (path instanceof RegExp) path = path.source


  urltils.copyParameters(transaction.agent.config, params, segment.parameters)

  ensurePartialName(transaction)

  transaction.partialName += path[0] === '/' ? path.slice(1) : path

}

module.exports = function initialize(agent, express) {
  var tracer = agent.tracer

  var interceptor
  // This is the error handler we inject for express4. Yanked from connect support.
  function sentinel(error, req, res, next) {
    if (error) {
      var transaction = agent.tracer.getTransaction()
      if (transaction) {
        transaction.exceptions.push(error)
      }
      else {
        agent.errors.add(null, error)
      }
    }

    return next(error)
  }

  function setDispatcher(app) {
    return function wrappedCreateServer() {
      agent.environment.setDispatcher('express')
      agent.environment.setFramework('express')

      return app.apply(this, arguments)
    }
  }

  /**
   * This needs to be kept up to date with Express to ensure that it's using
   * the same logic to decide where the callback is hiding.
   */
  function wrapRender(version, render) {
    /*jshint maxparams:5*/ // follow Express as closely as possible
    return function cls_wrapRender(view, options, cb, parent, sub) {
      logger.trace("Rendering Express %d view %s.", version, view)
      if (!tracer.getTransaction()) {
        logger.trace(
          'Express %d view %s rendered outside transaction, not measuring.',
          version,
          view
        )
        return render.apply(this, arguments)
      }

      var name    = VIEW.PREFIX + view + VIEW.RENDER
        , segment = tracer.addSegment(name, record)
        , wrapped


      if ('function' === typeof options) {
        cb = options
        options = null
      }

      if (cb === null || cb === undefined) {
        /* CAUTION: Need this to generate a metric, but adding a callback
         * changes Express's control flow.
         */
        wrapped = tracer.callbackProxy(function syntheticCallback(err, rendered) {
          if (err) {
            segment.end()
            logger.trace(err,
                         "Express %d rendering for metric %s failed for transaction %s:",
                         version,
                         name,
                         segment.trace.transaction.id)

            return this.req.next(err)
          }

          var returned = this.send(rendered)
          segment.end()

          logger.trace("Rendered Express %d view with metric %s for transaction %s.",
                       version,
                       name,
                       segment.trace.transaction.id)

          return returned
        }.bind(this))
      }
      else {
        wrapped = tracer.callbackProxy(function renderWrapper() {
          var returned = cb.apply(this, arguments)
          segment.end()

          return returned
        })
      }

      return render.call(this, view, options, wrapped, parent, sub)
    }
  }

  function wrapMatchRequest(version, matchRequest) {
    return function cls_wrapMatchRequest() {
      if (!tracer.getTransaction()) {
        logger.trace(
          'Express %d router called outside transaction (wrapMatchRequest).',
          version
        )
        return matchRequest.apply(this, arguments)
      }
      var route = matchRequest.apply(this, arguments)
      nameFromRoute(tracer.getSegment(), route)
      return route
    }
  }

  function wrapProcessParams(version, process_params) {
    return function cls_wrapProcessParams() {
      if (!tracer.getTransaction()) {
        logger.trace(
          'Express %d router called outside transaction (wrapProcessParams).',
          version
        )
        return process_params.apply(this, arguments)
      }
      if (arguments.length) {
        if (arguments[0].route) {
          // Express 4.3.0 changed where params live. On newer versions of
          // express params should be populated, on older it shouldn't be.
          nameFromRoute(tracer.getSegment(), arguments[0].route, arguments[0].params)
        }
      }
      return process_params.apply(this, arguments)
    }
  }

  /**
   * Problem:
   *
   * 1. Express determines whether middleware functions are error handlers by
   *    testing their arity. Not cool.
   * 2. Downstream Express users rely upon being able to iterate over their
   *    middleware stack to find specific middleware functions. Sorta less
   *    uncool, but still a pain.
   *
   * Solution:
   *
   * Use eval. This once. For this one specific purpose. Not anywhere else for
   * any reason.
   */
  function wrapHandle(__NR_handle, path) {
    var name = ''
    var arglist


    // reiterated: testing function arity is stupid
    switch (__NR_handle.length) {
      case 2:
        arglist = '(req, res)'
        break

      case 3:
        arglist = '(req, res, next)'
        break

      // don't break other error handlers
      case 4:
        arglist = '(err, req, res, next)'
        break

      default:
        arglist = '()'
    }

    if (__NR_handle.name) name = mangle(__NR_handle.name)

    var template = function () {
      var args = tracer.slice(arguments)
        , last = args.length - 1


      if (typeof args[last] === 'function') {
        args[last] = tracer.callbackProxy(args[last])
      }

      __NR_handle.apply(this, args)
    }

    var routerTemplate = function () {
      return wrappedHandle.call(this, path, template, [].slice.call(arguments))
    }

    var handlerTemplate = Object.getPrototypeOf(__NR_handle) === express.Router ?
      routerTemplate :
      template

    // I am a bad person and this makes me feel bad.
    // We use eval because we need to insert the function with a specific name to allow for lookup.
    // jshint evil:true
    var wrapped = eval(
      '(function(){return function ' + name + arglist +
      handlerTemplate.toString().substring(11) + '}())'
    )
    wrapped[ORIGINAL] = __NR_handle
    // jshint evil:false

    return wrapped
  }

  function wrapMiddlewareStack(route, use) {
    return function cls_wrapMiddlewareStack() {
      // Remove our custom error handler.
      removeInterceptor(this)

      /* We allow `use` to go through the arguments so it can reject bad things
       * for us so we don't have to also do argument type checking.
       */
      var app = use.apply(this, arguments)
      var path = typeof arguments[0] === 'string' ? arguments[0] : '/'

      /* Express adds routes to the same stack as middleware. We need to wrap
       * that adder too but we only want to wrap the middleware that are
       * added, not the Router.
       */
      if (!route) {
        // wrap most recently added unwrapped handler
        var i = this.stack.length
        var top
        while(top = this.stack[--i]) {
          if(!top.handle || typeof top.handle !== 'function' || top.handle[ORIGINAL]) {
            break
          }

          top.handle = wrapHandle(top.handle, path)
        }
      }

      if (!interceptor) {
        // call use to create a Layer object, then pop it off and store it.
        use.call(this, '/', sentinel)
        interceptor = this.stack.pop()
      }

      addInterceptor(this)

      return app
    }
  }

  function wrapAppUse(use) {
    return function wrappedAppUse() {
      var emits = []
      var arg

      // loop over middleware being used
      for(var i = 0, l = arguments.length; i < l; ++i) {
        arg = arguments[i]
        // if the middleware is an express app
        if(typeof arg === 'function' && arg.set && arg.handle && arg.emit) {
          emits[i] = arg.emit
          // patch emit so it removes the error interceptor since it tends to be
          // at the top of the stack. when you use another express app, a `mount`
          // event is fired on the app. It should be at the top of the stack
          // when this event is fired
          patchEmit(this, arg)
        }
      }

      use.apply(this, arguments)

      // restore original emit methods
      for(var i = 0, l = emits.length; i < l; ++i) {
        if(emits[i]) {
         arguments[i] = emits[i]
        }
      }

      // don't break chaining
      return this
    }
  }

  function wrapAppHandle(handle) {
    return function(req, res, next) {
      return wrappedHandle.call(this, this.mountpath, handle, [].slice.call(arguments))
    }
  }

  function wrappedHandle(path, handle, args) {
    var transaction = agent.tracer.getTransaction()
    var next = args[2]
    if (!transaction) {
      logger.trace(
        'Express %d handle for path %s called outside transaction (wrappedHandle).',
        version,
        path
      )
      next.apply(this, arguments)
      return
    }

    var orignal = transaction.partialName

    if(next) {
      args[2] = cleanup
    }

    ensurePartialName(transaction)

    if(path && path !== '/') {
      transaction.partialName += path[0] === '/' ? path.slice(1) : path
    }

    if(transaction.partialName[transaction.partialName.length - 1] !== '/') {
      transaction.partialName += '/'
    }

    handle.apply(this, args)

    function cleanup() {
      transaction.partialName = orignal
      next.apply(this, arguments)
    }
  }

  function addInterceptor(app) {
    /* Give the error tracer a better chance of intercepting errors by
     * putting it before the first error handler (a middleware that takes 4
     * parameters, in express's world). Error handlers tend to be placed
     * towards the end of the middleware chain and sometimes don't pass
     * errors along. Don't just put the interceptor at the beginning because
     * we want to allow as many middleware functions to execute as possible
     * before the interceptor is run, to increase error coverage.
     *
     * NOTE: This is heuristic, and works because interceptor propagates
     *       errors instead of terminating the middleware chain.
     *       Ignores routes.
     */
    var spliced = false
    for (var i = 0; i < app.stack.length; i++) {
      var middleware = app.stack[i]
      // Check to see if it is an error handler middleware
      if (middleware &&
          middleware.handle &&
          middleware.handle.length === 4) {
        app.stack.splice(i, 0, interceptor)
        spliced = true
        break
      }
    }
    if (!spliced) app.stack.push(interceptor)
  }

  function removeInterceptor(app) {
    if (app.stack && app.stack.length) {
      // Remove our custom error handler.
      // Move backwards so the index is not affected by the splicing.
      for (var i = app.stack.length - 1; i >= 0; i--) {
        if (app.stack[i] === interceptor) {
          app.stack.splice(i, 1)
        }
      }
    }
  }

  function patchEmit(parent, app) {
    var emit = app.emit
    app.emit = patchedEmit

    function patchedEmit() {
      removeInterceptor(parent._router)
      var result = emit.apply(app, arguments)
      addInterceptor(parent._router)
      return result
    }
  }

  /**
   * Major versions of express have very different factoring,
   * even though the core instrumentation is the same.
   */
  var version = express && express.version && express.version[0]

  /* TJ decided he didn't want to deal with the hassle of updating a
   * version field. Thanks, TJ!
   */
  if (!version && express && express.application &&
      express.application.init && express.response &&
      express.response.render && express.Router &&
      express.Router.prototype.matchRequest) {
    version = '3'
  } else if (!version && express && express.application &&
           express.application.init && express.response &&
           express.response.render && express.Router &&
           express.Router.process_params) {
    version = '4'
  }

  switch (version) {
    case '2':
      /* Express 2 doesn't directly expose its Router constructor, so create an
       * app and grab the constructor off it. Do it before instrumenting
       * createServer so the agent doesn't automatically set the dispatcher
       * to Express.
       */
      var oneoff = express.createServer()
        , Router = oneoff.routes.constructor


      shimmer.wrapMethod(express,
                         'express',
                         'createServer',
                         setDispatcher)

      /* Express 2 squirts its functionality directly onto http.ServerResponse,
       * leaving no clean way to wrap its functionality without pulling in the
       * http module ourselves.
       */
      var http = require('http')
      shimmer.wrapMethod(http.ServerResponse.prototype,
                         'http.ServerResponse.prototype',
                         'render',
                         wrapRender.bind(null, 2))

      shimmer.wrapMethod(Router.prototype,
                         'Router.prototype',
                         '_match',
                         wrapMatchRequest.bind(null, 2))
      break

    case '3':
      shimmer.wrapMethod(express.application,
                         'express.application',
                         'init',
                         setDispatcher)

      shimmer.wrapMethod(express.response,
                         'express.response',
                         'render',
                         wrapRender.bind(null, 3))

      shimmer.wrapMethod(express.Router.prototype,
                         'express.Router.prototype',
                         'matchRequest',
                         wrapMatchRequest.bind(null, 3))
      break

    case '4':
      shimmer.wrapMethod(express.application,
                         'express.application',
                         'init',
                         setDispatcher)

      shimmer.wrapMethod(express.response,
                         'express.response',
                         'render',
                         wrapRender.bind(null, 4))

      shimmer.wrapMethod(express.Router,
                         'express.Router',
                         'process_params',
                         wrapProcessParams.bind(null, 4))

      shimmer.wrapMethod(express.Router,
                         'express.Router',
                         'use',
                         wrapMiddlewareStack.bind(null, false))

      shimmer.wrapMethod(express.Router,
                         'express.Router',
                         'route',
                         wrapMiddlewareStack.bind(null, true))

      shimmer.wrapMethod(express.application,
                         'express.application',
                         'use',
                         wrapAppUse)

      shimmer.wrapMethod(express.application,
                         'express.application',
                         'handle',
                         wrapAppHandle)
      break
    default:
      logger.warn("Unrecognized version %d of Express detected; not instrumenting",
                  version)
  }
}
