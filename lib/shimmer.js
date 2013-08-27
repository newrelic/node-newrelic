'use strict';

var path   = require('path')
  , fs     = require('fs')
  , logger = require(path.join(__dirname, 'logger')).child({component : 'shimmer'})
  ;

/*
 * CONSTANTS
 */

var CORE_INSTRUMENTATION = {
  http  : 'http.js',
  https : 'http.js',
  fs    : 'fs.js'
};

/**
 * Unwrapping is only likely to be used by test code, and is a fairly drastic
 * maneuver, but it should be pretty safe if there's a desire to reboot the
 * agent in flight.
 *
 * All of the wrapped methods are tracked in this variable and used by unwrapAll
 * below.
 */
var instrumented = [];

// polyfill for Node < 0.8
var existsSync = fs.existsSync || path.existsSync;

/**
 * All instrumentation files must export the same interface: a single
 * initialization function that takes the agent and the module to be
 * instrumented.
 */
function instrument(agent, shortName, fileName, nodule) {
  try {
    require(fileName)(agent, nodule);
  }
  catch (error) {
    logger.debug(error, "Failed to instrument module %s.",
                 path.basename(shortName, ".js"));
  }
}

function _postLoad(agent, nodule, name) {
  // necessary to prevent instrument() from causing an infinite loop
  if (path.extname(name) !== '.js') {
    name = path.basename(name);
    var filename = path.join(__dirname, 'instrumentation', name + '.js');

    if (existsSync(filename)) {
      logger.debug('Instrumenting %s.', name);
      instrument(agent, name, filename, nodule);
    }
  }

  return nodule;
}

var shimmer = module.exports = {
  /**
   * If debug isn't false, the agent will retain references to wrapped methods
   * for the entire lifetime of the agent. Some instrumentation depends on
   * wrapping functions on individual objects, and this will cause the agent
   * to retain references to a large number of dead objects.
   */
  debug : false,

  /**
   * Don't throw, but do log and bail out if wrapping fails.
   *
   * Provide an escape hatch by creating a closure around the original method
   * and object / module wrapped into a helper function that will restore the
   * original function / method. See Sinon for a systematic use of this
   * pattern.
   *
   * @param {object} nodule Class or module containing the function to wrap.
   * @param {object} noduleName Human-readable module / Class name. More
   *                            helpful than you'd think.
   * @param {string} methods One or more names of methods or functions to extract
   *                         and wrap.
   * @param {function} wrapper A generator that, when called, returns a
   *                           wrapped version of the original function.
   */
  wrapMethod : function wrapMethod(nodule, noduleName, methods, wrapper) {
    if (!methods) {
      return logger.warn(new Error(),
                         "Must include a method name to wrap. Called from:");
    }

    if (!noduleName) noduleName = '[unknown]';
    if (!Array.isArray(methods)) methods = [methods];

    methods.forEach(function (method) {
      var fqmn = noduleName + '.' + method;

      if (!nodule) return logger.debug("Can't wrap %s from nonexistent object.",
                                       fqmn);
      if (!wrapper) return logger.debug("Can't wrap %s without a wrapper generator.",
                                        fqmn);

      var original = nodule[method];

      if (!original) return logger.trace("%s not defined, so not wrapping.", fqmn);
      if (original.__NR_unwrap) return logger.debug("%s already wrapped by agent.", fqmn);

      var wrapped = wrapper(original);
      wrapped.__NR_original = original;
      wrapped.__NR_unwrap = function () {
        nodule[method] = original;
        logger.debug("Removed instrumentation from %s.", fqmn);
      };

      nodule[method] = wrapped;
      if (shimmer.debug) instrumented.push(wrapped);
      logger.trace("Instrumented %s.", fqmn);
    });
  },

  unwrapMethod : function unwrapMethod(nodule, noduleName, method) {
    if (!noduleName) noduleName = '[unknown]';
    if (!method) return logger.debug("Must include a method name to unwrap. " +
                                     "Called from: %s", new Error().stack);

    var fqmn = noduleName + '.' + method;

    if (!nodule) return logger.debug("Can't unwrap %s from nonexistent object.",
                                     fqmn);
    var wrapped = nodule[method];

    // keep instrumented up to date
    var pos = instrumented.indexOf(wrapped);
    if (pos !== -1) instrumented.splice(pos, 1);

    if (!wrapped) return logger.debug("%s not defined, so not unwrapping.", fqmn);
    if (!wrapped.__NR_unwrap) return logger.debug("%s isn't unwrappable.", fqmn);

    wrapped.__NR_unwrap();
  },

  unwrapAll : function unwrapAll() {
    instrumented.forEach(function (wrapper) {
      wrapper.__NR_unwrap();
    });
    instrumented = [];
  },

  /**
   * Patch the module.load function so that we see modules loading and
   * have an opportunity to patch them with instrumentation.
   */
  patchModule : function patchModule(agent) {
    logger.debug("Wrapping module loader.");
    var Module = require('module');

    shimmer.wrapMethod(Module, 'Module', '_load', function (load) {
      return function (file) {
        return _postLoad(agent, load.apply(this, arguments), file);
      };
    });
  },

  unpatchModule : function unpatchModule() {
    logger.debug("Unwrapping to previous module loader.");
    var Module = require('module');

    shimmer.unwrapMethod(Module, 'Module', '_load');
  },

  bootstrapInstrumentation : function bootstrapInstrumentation(agent) {
    Object.keys(CORE_INSTRUMENTATION).forEach(function (mojule) {
      var filename = CORE_INSTRUMENTATION[mojule]
        , filepath = path.join(__dirname, 'instrumentation', 'core', filename)
        ;

      instrument(agent, filename, filepath, require(mojule));
    });
  },

  /**
   * NOT FOR USE IN PRODUCTION CODE
   *
   * If an instrumented module has a dependency on another instrumented
   * module, and multiple tests are being run in a single test suite
   * with their own setup and teardown between tests, it's possible
   * transitive dependencies will be unwrapped in the module cache
   * in-place (which needs to happen to prevent stale closures from
   * channeling instrumentation data to incorrect agents, but which means the
   * transitive dependencies won't get rewrapped the next time the parent
   * module is required).
   *
   * Since this only applies in test code, it's not worth the drastic
   * monkeypatching to Module necessary to walk the list of child
   * modules and rewrap them.
   *
   * Use this to re-apply any applicable instrumentation.
   */
  reinstrument : function reinstrument(agent, path) {
    return _postLoad(agent, require(path), path);
  }
};
