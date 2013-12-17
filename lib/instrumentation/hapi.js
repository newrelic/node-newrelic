'use strict';

var path    = require('path')
  , shimmer = require(path.join(__dirname, '..', 'shimmer.js'))
  , urltils = require(path.join(__dirname, '..', 'util', 'urltils.js'))
  , logger  = require(path.join(__dirname, '..', 'logger.js'))
                .child({component : 'hapi'})
  , record  = require(path.join(__dirname, '..', 'metrics', 'recorders', 'generic.js'))
  , NAMES   = require(path.join(__dirname, '..', 'metrics', 'names.js'))
  , VIEW    = NAMES.VIEW
  ;

function nameFromRequest(segment, request) {
  if (!segment) return logger.error("No New Relic context to set Hapi route name on.");
  if (!request) return logger.debug("No Hapi request to use for naming.");

  var transaction = segment.trace.transaction
    , path        = request.route && request.route.path
    ;

  if (!path) return logger.debug({request : request}, "No path found on Hapi route.");

  urltils.copyParameters(transaction.agent.config, request.params, segment.parameters);

  transaction.partialName = NAMES.HAPI.PREFIX + transaction.verb +
                            NAMES.ACTION_DELIMITER + path;
}

function setDispatcher(agent) {
  agent.environment.setDispatcher('hapi');
  agent.environment.setFramework('hapi');
}

module.exports = function initialize(agent, hapi) {
  if (!agent) return logger.error("Hapi instrumentation bootstrapped without agent");
  if (!hapi) return logger.error("Hapi instrumentation applied without module");

  var tracer = agent.tracer;

  function wrapRender(render) {
    return function wrappedRender(filename, context, options, callback) {
      var wrapped = callback;

      // FIXME: this is going to be the most recent segment, which may not be right
      var segment = tracer.getSegment();
      if (segment && callback) {
        wrapped = tracer.callbackProxy(function () {
          segment.end();

          return callback.apply(this, arguments);
        });
      }

      return render.call(this, filename, context, options, wrapped);
    };
  }

  function wrapStart(start) {
    return function wrappedStart() {
      setDispatcher(agent);

      /* The patched module loader doesn't access the filesystem itself, so
       * lazily apply the patch to Views.prototype.render only once a Views
       * object has been assigned as the view manager.
       */
      if (this._views) {
        logger.debug('Hapi view manager set; instrumenting render.');
        var proto = this._views.constructor.prototype;
        shimmer.wrapMethod(proto, 'hapi.Views.prototype', 'render', wrapRender);
      }

      return start.apply(this, arguments);
    };
  }

  function wrapViews(views) {
    return function wrappedViews() {
      var returned = views.apply(this, arguments);

      /* The patched module loader doesn't access the filesystem itself, so
       * lazily apply the patch to Views.prototype.render only once a Views
       * object has been assigned as the view manager.
       */
      if (this._views) {
        var proto = this._views.constructor.prototype;
        shimmer.wrapMethod(proto, 'hapi.Views.prototype', 'render', wrapRender);
      }
      else {
        logger.warn('Hapi view manager set without manager actually being created.');
      }

      return returned;
    };
  }

  function wrapReplyView(reply) {
    var view = reply.view;
    reply.view = function (template) {
      var name = VIEW.PREFIX + template + VIEW.RENDER;
      tracer.addSegment(name, record);

      return view.apply(this, arguments);
    };
  }

  function wrapHandler(handler) {
    return function (request, reply) {
      if (!tracer.getTransaction()) {
        logger.trace("Hapi route handler called outside transaction.");
        return handler.apply(this, arguments);
      }

      nameFromRequest(tracer.getSegment(), request);
      if (reply && reply.view) wrapReplyView(reply);

      return handler.apply(this, arguments);
    };
  }

  function wrapRoute(_route) {
    return function wrappedRoute(configs, env) {
      configs = (Array.isArray(configs) ? configs : [configs]);

      for (var i = 0; i < configs.length; i++) {
        var config = configs[i];
        if (config.handler) {
          shimmer.wrapMethod(config, 'hapi.route', 'handler', wrapHandler);
        }
      }

      return _route.call(this, configs, env);
    };
  }

  var proto = hapi && hapi.Server && hapi.Server.prototype;
  if (proto) {
    shimmer.wrapMethod(proto, 'hapi.Server.prototype', 'start',  wrapStart);
    shimmer.wrapMethod(proto, 'hapi.Server.prototype', 'views',  wrapViews);
    shimmer.wrapMethod(proto, 'hapi.Server.prototype', '_route', wrapRoute);
    if (proto.addRoute) {
      shimmer.wrapMethod(proto, 'hapi.Server.prototype',  'addRoute',  wrapRoute);
    }
    if (proto.addRoutes) {
      shimmer.wrapMethod(proto, 'hapi.Server.prototype', 'addRoutes', wrapRoute);
    }
  }
  else {
    logger.warn('hapi Server constructor not found; can\'t instrument');
  }
};
