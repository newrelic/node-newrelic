'use strict';

var path   = require('path')
  , fs     = require('fs')
  , logger = require(path.join(__dirname, 'logger'))
  , trace  = require(path.join(__dirname, 'trace'))
  ;

var agents = [];

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

// Thanks Adam Crabtree! (dude@noderiety.com)
// taken from https://github.com/CrabDude/trycatch
require(path.join(__dirname, 'hook'))(generateShim);

var loadInstrumentationFile = function loadInstrumentationFile(agent, shortName, fileName, nodule) {
  var inst = require(fileName);

  try {
    inst.initialize(agent, trace, nodule);
  }
  catch(e) {
    logger.debug("Failed to instrument module " + path.basename(shortName, ".js") + ": " + e.message);
    return false;
  }

  return true;
};

// notice a module loading and patch it if there's a file in the instrumentation
// directory with a name that matches the module name
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
  wrapAgent : function wrapAgent(agent) {
    logger.debug('wrapping agent with shim');
    agents.push(agent);
  },
  unwrapAgent : function (agent) {
    logger.debug('unwrapping agent from shim');
    agents = agents.filter(function (item) { return item !== agent; });
  },
  preserveMethod : function preserveMethod(nodule, method) {
    var wrapped = '__NR_ORIG_' + method;
    if (!nodule[wrapped]) {
      logger.debug('preserving ' + getObjectClass(nodule) + '.' + method + ' as ' + wrapped);
      nodule[wrapped] = nodule[method];
    }

    return nodule[wrapped];
  },
  /**
   * Patch the module.load function so that we see modules loading and
   * have an opportunity to patch them with instrumentation.
   *
   */
  patchModule : function patchModule(agent) {
    logger.debug('Patching module loading.');
    var module = require('module');

    var load = shimmer.preserveMethod(module, '_load');
    module._load = function (file) {
      var m = load.apply(this, arguments);
      moduleLoad(agent, m, file);
      return m;
    };
  },
  /**
   * we load all of the core instrumentation up front.  These are always available, they're
   * pretty much always used, and we might not see the modules load through our module patching.
   *
   */
  bootstrapInstrumentation : function bootstrapInstrumentation(agent) {
    var coreDir = path.join(__dirname, 'core_instrumentation');
    var files = fs.readdirSync(coreDir);

    // load the core instrumentation files
    files.forEach(function (name) {
      if (path.extname(name) !== '.js') return;

      var fileName = coreDir + "/" + name;
      loadInstrumentationFile(agent, name, fileName, require(path.basename(name, ".js")));
    });
  }
};
