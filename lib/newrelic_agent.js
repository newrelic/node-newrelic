var module  = require('module')
  , path    = require('path')
  , fs      = require('fs')
  , stats   = require('./stats')
  , service = require('./service')
  , metric  = require('./metric')
  , error   = require('./error')
  , trace   = require('./trace')
  , events  = require('events')
  , util    = require('util')
  , winston = require('winston')
  , logger  = require('./logger').getLogger()
  ;

function getLogger() {
  return logger;
}

function noop() {}

function wrapCallback(obj, func) {
  return function () {
    func.apply(obj, arguments);
  };
}

function Agent() {
  events.EventEmitter.call(this);
  var self = this;

  var config;
  try {
    config = require('./config').initialize(logger);
  }
  catch (e) {
    logger.error(e);
    this.start = function () { return false; };
    this.stop = noop;
    return false;
  }

  var version = config.getVersion();
  var instrumentation = [];
  var metricNormalizer = new metric.MetricNormalizer(logger);
  var errorService = new error.ErrorService(logger, config);
  trace.addTransactionListener(errorService, errorService.onTransactionFinished);

  logger.setLevel(config.getLogLevel());

  var statsEngine = stats.createStatsEngine(logger);
  trace.addTransactionListener(statsEngine, statsEngine.onTransactionFinished);
  config.on('change', wrapCallback(statsEngine, statsEngine.onConnect));

  // NewRelicService
  var nrService;
  var harvestIntervalId;
  var sampler = require('./sampler');
  var environment = require('./environment');

  this.stop = function () {
    logger.info('Stopping the New Relic node.js agent');
    if (harvestIntervalId) {
      clearInterval(harvestIntervalId);
    }
    sampler.stop();
  };

  this.getConfig = function () {
    return config;
  };

  this.getVersion = function () {
    return version;
  };

  this.noticeAppPort = function (port) {
    self.applicationPort = port;
    logger.debug("Noticed application running on port " + port);
  };

  function connect() {
    setTimeout(function () {
      doConnect();
    }, this.applicationPort ? 0 : 1000);
  }

  function doConnect() {
    if (nrService) return;

    nrService = service.createNewRelicService(self, config);
    nrService.on('connect', wrapCallback(config, config.onConnect));
    nrService.on('connect', wrapCallback(metricNormalizer, metricNormalizer.parseMetricRules));
    nrService.on('metricDataError', wrapCallback(statsEngine, statsEngine.mergeMetricData));
    nrService.on('metricDataResponse', wrapCallback(statsEngine, statsEngine.parseMetricIds));
    nrService.on('errorDataError', wrapCallback(errorService, errorService.onSendError));
    nrService.on('connectError', function (error) {
      setTimeout(function () {
        logger.error("An error occurred connecting to " + config.host + ":" + config.getPort() + " - " + error);
        connect();
      }, 15 * 1000);
    });
    nrService.connect();
  }

  this.getStatsEngine = function () {
    return statsEngine;
  };

  this.getErrorService = function () {
    return errorService;
  };

  this.getMetricNormalizer = function () {
    return metricNormalizer;
  };

  // patch the module.load function so that we see modules loading and
  // have an opportunity to patch them with instrumentation
  function patchModule() {
    var module = require('module');
    var moduleLoadFunction = module._load;

    module._load = function (file) {
      var m = moduleLoadFunction.apply(this, arguments);
      moduleLoad(m, file);
      return m;
    };
  }

  // notice a module loading and patch it if there's a file in the instrumentation
  // directory with a name that matches the module name
  function moduleLoad(theModule, name) {
    if (path.extname(name) == '.js') return;

    name = path.basename(name);
    var instrumentationDir = path.join(__dirname,'instrumentation');
    var fileName = instrumentationDir + "/" + name + '.js';
    // we have to check this synchronously.  it's important that we patch immediately when modules load
    if (path.existsSync(fileName)) {
      // FIXME for some reason the logger doesn't work here.  console logging does.  wtf?
      loadInstrumentationFile(name, fileName, theModule);
    }
  }

  // we load all of the core instrumentation up front.  These are always available, they're
  // pretty much always used, and we might not see the modules load through our module patching.
  function loadInstrumentation() {
    var coreDir = path.join(__dirname,'core_instrumentation');
    var files = fs.readdirSync(coreDir);

    // load the core instrumentation files
    files.forEach(function (name) {
      var fileName = coreDir + "/" + name;
      loadInstrumentationFile(name, fileName, require(path.basename(name, ".js")));
    });
  }

  function loadInstrumentationFile(shortName, fileName, theModule) {
    if (theModule.__NR_INITIALIZED) return true;

    var inst = require(fileName);
    var success = true;

    try {
      inst.initialize(self, trace, theModule);
    }
    catch(e) {
      logger.debug(e.message);
      success = false;
    }

    logger.debug("Module " + path.basename(shortName, ".js") + " : " + success);
    instrumentation.push(fileName);
    theModule.__NR_INITIALIZED = true;

    return success;
  }

  function harvest() {
    logger.debug("Harvest");

    if (nrService && nrService.isConnected()) {
      // self.emit('beforeHarvest', statsEngine, nrService);
      // self.emit('harvest', statsEngine, nrService);
      errorService.onBeforeHarvest(statsEngine, nrService);
      statsEngine.harvest(nrService);
    }
  }

  function startHarvest() {
    harvestIntervalId = setInterval(harvest, 60*1000);
  }

  this.start = function () {
    if (config.agent_enabled !== true) {
      logger.info('The New Relic node.js agent is disabled');
      return;
    }

    logger.info('Starting the New Relic node.js agent');

    patchModule();

    loadInstrumentation();
    startHarvest();
    connect();
    sampler.start(statsEngine);
  };

  this.clearTransaction = function (transaction) {
    if (self.transaction == transaction) {
      self.transaction = null;
    }
  };

  this.setTransaction = function (transaction) {
    if (!(transaction && transaction.isFinished())) {
      self.transaction = transaction;
    }
  };

  this.getTransaction = function () {
    if (self.transaction) {
      if (self.transaction.isFinished()) self.transaction = null;

      return self.transaction;
    }
    return null;
  };

  this.getLogger = getLogger;

  this.createTransaction = function () {
    return self.transaction = trace.createTransaction(self);
  };

  this.getEnvironment = function () {
    return environment;
  };

  this.incrementCounter = function (metric_name) {
    self.getStatsEngine().getUnscopedStats().getStats(metric_name).incrementCallCount();
  };
}

//Agent.prototype.getLogger = getLogger;

util.inherits(Agent, events.EventEmitter);

agent = new Agent();

exports.stop = agent.stop;
exports.getLogger = getLogger;
exports.incrementCounter = agent.incrementCounter;

function generateShim(next, name) {
  var _currentTransaction = agent.getTransaction();
  if (_currentTransaction && _currentTransaction.isFinished()) {
    agent.clearTransaction(_currentTransaction);
    _currentTransaction = null;
  }

  // we only need to wrap if there's a transaction to pass
  /*
     if (!_currentTransaction) {
     return next;
     }*/

  return function () {
    agent.setTransaction(_currentTransaction);
    return next.apply(this, arguments);
  };
}

if (false !== agent.start()) {
  // Thanks Adam Crabtree! (dude@noderiety.com)
  require('./hook')(generateShim);
}
