'use strict';

var path      = require('path')
  , fs        = require('fs')
  , logger    = require(path.join(__dirname, 'logger')).child({component : 'shimmer'})
  ;

/**
 * Unwrapping is only likely to be used by test code, and is a fairly drastic
 * maneuver, but it should be pretty safe if there's a desire to reboot the
 * agent in flight.
 *
 * All of the wrapped methods are tracked in this variable and used by unwrapAll
 * below.
 */
var instrumented = [];

var loadInstrumentationFile = function loadInstrumentationFile(agent, shortName, fileName, nodule) {
  var initialize = require(fileName);

  try {
    initialize(agent, nodule);
  }
  catch (error) {
    logger.debug(error, "Failed to instrument module %s.",
                 path.basename(shortName, ".js"));
    return false;
  }

  return true;
};

/**
 * notice a module loading and patch it if there's a file in the instrumentation
 * directory with a name that matches the module name
 */
var moduleLoad = function moduleLoad(agent, nodule, name) {
  if (path.extname(name) === '.js') return;

  name = path.basename(name);
  var instrumentationDir = path.join(__dirname, 'instrumentation');
  var fileName = instrumentationDir + "/" + name + '.js';

  // polyfill for Node < 0.8
  var existsSync = fs.existsSync || path.existsSync;

  // Check this synchronously.  It's important to immediately patch modules upon load.
  if (existsSync(fileName)) {
    logger.trace('Instrumenting %s.', name);
    loadInstrumentationFile(agent, name, fileName, nodule);
  }
};

var shimmer = module.exports = {
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
    if (!noduleName) noduleName = '[unknown]';
    if (!methods) return logger.debug("Must include a method name to wrap. " +
                                     "Called from: %s", new Error().stack);

    if (!Array.isArray(methods)) methods = [methods];

    methods.forEach(function (method) {
      var fqmn = noduleName + '.' + method;

      if (!nodule) return logger.debug("Can't wrap %s from nonexistent object.", fqmn);
      if (!wrapper) return logger.debug("Can't wrap %s without a wrapper generator.", fqmn);

      var original = nodule[method];

      if (!original) return logger.debug("%s not defined, so not wrapping.", fqmn);
      if (original.__NR_unwrap) return logger.debug("%s already wrapped by agent.", fqmn);

      var wrapped = wrapper(original);
      wrapped.__NR_unwrap = function () {
        nodule[method] = original;
        logger.debug("Removed instrumentation from %s.", fqmn);
      };

      nodule[method] = wrapped;
      instrumented.push(wrapped);
      logger.debug("Instrumented %s.", fqmn);
    });
  },

  /**
   * Unwrap a previously wrapped method / function.
   */
  unwrapMethod : function unwrapMethod(nodule, noduleName, method) {
    if (!noduleName) noduleName = '[unknown]';
    if (!method) return logger.debug("Must include a method name to unwrap. " +
                                     "Called from: %s", new Error().stack);

    var fqmn = noduleName + '.' + method;

    if (!nodule) return logger.debug("Can't unwrap %s from nonexistent object.", fqmn);
    var wrapped = nodule[method];

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
   *
   */
  patchModule : function patchModule(agent) {
    logger.debug('Patching module loading.');
    var nodule = require('module');

    shimmer.wrapMethod(nodule, 'module', '_load', function (original) {
      return function (file) {
        var nodule = original.apply(this, arguments);
        moduleLoad(agent, nodule, file);
        return nodule;
      };
    });
  },

  unpatchModule : function unpatchModule() {
    logger.debug('Restoring previous module loader.');
    var module = require('module');

    shimmer.unwrapMethod(module, 'module', '_load');
  },

  /**
   * we load all of the core instrumentation up front.  These are always available, they're
   * pretty much always used, and we might not see the modules load through our module patching.
   *
   */
  bootstrapInstrumentation : function bootstrapInstrumentation(agent) {
    var coreDir = path.join(__dirname, 'instrumentation', 'core');
    var files = fs.readdirSync(coreDir);

    // load the core instrumentation files
    files.forEach(function (name) {
      if (path.extname(name) !== '.js') return;

      var fileName = coreDir + "/" + name;
      loadInstrumentationFile(agent, name, fileName, require(path.basename(name, ".js")));
    });
  },
};
