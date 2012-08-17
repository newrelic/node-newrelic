'use strict';

var path   = require('path')
  , fs     = require('fs')
  , logger = require(path.join(__dirname, 'logger'))
  , trace  = require(path.join(__dirname, 'trace'))
  ;

var agents = [];
var instrumented = [];

/**
 * Thanks to Adam Crabtree / crabdude & Tim Caswell / creationix!
 *
 * hook.js taken from https://github.com/CrabDude/trycatch, and is probably
 * overkill.
 */
var generateShim = function generateShim(next, name) {
  var transaction;

  agents.forEach(function (agent, i) {
    transaction = agent.getTransaction();

    if (transaction && transaction.finished) {
      agent.clearTransaction(transaction);
      transaction = null;
    }
  });

  return function () {
    // FIXME: transactions should be scoped to an agent
    agents.forEach(function (agent, i) {
      agent.setTransaction(transaction);
    });

    return next.apply(this, arguments);
  };
};
require(path.join(__dirname, 'hook'))(generateShim);

var loadInstrumentationFile = function loadInstrumentationFile(agent, shortName, fileName, nodule) {
  var initialize = require(fileName);

  try {
    initialize(agent, trace, nodule);
  }
  catch(e) {
    logger.debug("Failed to instrument module " + path.basename(shortName, ".js") + ": " + e.message);
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
  // Check this synchronously.  It's important to immediately patch modules upon load.
  if (fs.existsSync(fileName)) {
    logger.verbose('instrumenting', name);
    loadInstrumentationFile(agent, name, fileName, nodule);
  }
};

/**
 * helper function taken from
 * http://blog.magnetiq.com/post/514962277/finding-out-class-names-of-javascript-objects
 */
var getObjectClass = function getObjectClass(obj) {
  if (obj && obj.constructor && obj.constructor.toString) {
    var arr = obj.constructor.toString().match(/function\s*(\w+)/);

    if (arr && arr.length === 2) return arr[1];
  }

  return '[none]';
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
   * @param {string} method The name of the method or function to extract
   *                        and wrap.
   * @param {function} wrapper A generator that, when called, returns a
   *                           wrapped version of the original function.
   */
  wrapMethod : function wrapMethod(nodule, noduleName, method, wrapper) {
    var fqmn = noduleName + '.' + method;

    if (!nodule) return logger.debug("Can't wrap " + fqmn +
                                     " from nonexistent object.");
    if (!method) return logger.debug("Must include a method name to wrap. " +
                                     "Called from: " + (new Error()).stack);

    var original = nodule[method];

    if (!original) return logger.debug(fqmn + " not defined, so not wrapping.");
    if (original.__NR_unwrap) return logger.debug(fqmn +
                                                  " already wrapped by agent.");

    var wrapped = wrapper(original);
    wrapped.__NR_unwrap = function () {
      nodule[method] = original;
      logger.debug("Removed instrumentation from " + fqmn);
    };

    nodule[method] = wrapped;
    instrumented.push(wrapped);
    logger.debug("Instrumented " + fqmn);
  },

  /**
   * Unwrap a previously wrapped method / function.
   */
  unwrapMethod : function unwrapMethod(nodule, noduleName, method) {
    var fqmn = noduleName + '.' + method;

    if (!nodule) return logger.debug("Can't unwrap " + fqmn +
                                     " from nonexistent object.");
    if (!method) return logger.debug("Must include a method name to unwrap. " +
                                     "Called from: " + (new Error()).stack);

    var wrapped = nodule[method];

    if (!wrapped) return logger.debug(fqmn + " not defined, so not unwrapping.");
    if (!wrapped.__NR_unwrap) return logger.debug(fqmn + " isn't unwrappable.");

    wrapped.__NR_unwrap();
  },

  unwrapAll : function unwrapAll() {
    instrumented.forEach(function (wrapper) {
      wrapper.__NR_unwrap();
    });
    instrumented = [];
  },

  wrapAgent : function wrapAgent(agent) {
    logger.debug('wrapping agent with shim');
    agents.push(agent);
  },

  unwrapAgent : function (agent) {
    logger.debug('unwrapping agent from shim');
    agents = agents.filter(function (item) { return item !== agent; });
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
        var m = original.apply(this, arguments);
        moduleLoad(agent, m, file);
        return m;
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
  }
};
