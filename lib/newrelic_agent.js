var module  = require('module')
  , path    = require('path')
  , fs      = require('fs')
  , events  = require('events')
  , util    = require('util')
  , stats   = require('./stats')
  , service = require('./service')
  , metric  = require('./metric')
  , error   = require('./error')
  , trace   = require('./trace')
  , logger  = require('./logger')
  ;

function noop() {}

function wrapCallback(obj, func) {
  return function () {
    func.apply(obj, arguments);
  };
}

function Agent() {
  events.EventEmitter.call(this);
  var self = this;

  try {
    self.config = require('./config').initialize(logger);
  }
  catch (e) {
    logger.error(e);
    this.start = function () { return false; };
    this.stop = noop;
    return false;
  }

  self.version = self.config.version;
  self.metricNormalizer = new metric.MetricNormalizer(logger);
  self.errorService = new error.ErrorService(logger, self.config);
  trace.addTransactionListener(self.errorService, self.errorService.onTransactionFinished);

  logger.setLevel(self.config.getLogLevel());

  self.statsEngine = stats.createStatsEngine(logger);
  trace.addTransactionListener(self.statsEngine, self.statsEngine.onTransactionFinished);
  self.config.on('change', wrapCallback(self.statsEngine, self.statsEngine.onConnect));

  // NewRelicService
  var nrService;
  var instrumentation = [];
  var harvestIntervalId;
  var sampler = require('./sampler');
  self.environment = require('./environment');

  this.stop = function () {
    logger.info('Stopping the New Relic node.js agent');
    if (harvestIntervalId) {
      clearInterval(harvestIntervalId);
    }
    sampler.stop();
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

    nrService = service.createNewRelicService(self, self.config);
    nrService.on('connect', wrapCallback(self.config, self.config.onConnect));
    nrService.on('connect', wrapCallback(self.metricNormalizer, self.metricNormalizer.parseMetricRules));
    nrService.on('metricDataError', wrapCallback(self.statsEngine, self.statsEngine.mergeMetricData));
    nrService.on('metricDataResponse', wrapCallback(self.statsEngine, self.statsEngine.parseMetricIds));
    nrService.on('errorDataError', wrapCallback(self.errorService, self.errorService.onSendError));
    nrService.on('connectError', function (error) {
      setTimeout(function () {
        logger.error("An error occurred connecting to " + self.config.host + ":" + self.config.port + " - " + error);
        connect();
      }, 15 * 1000);
    });
    nrService.connect();
  }

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
      // self.emit('beforeHarvest', self.statsEngine, nrService);
      // self.emit('harvest', self.statsEngine, nrService);
      self.errorService.onBeforeHarvest(self.statsEngine, nrService);
      self.statsEngine.harvest(nrService);
    }
  }

  function startHarvest() {
    harvestIntervalId = setInterval(harvest, 60*1000);
  }

  this.start = function () {
    if (self.config.agent_enabled !== true) {
      logger.info('The New Relic node.js agent is disabled');
      return;
    }

    logger.info('Starting the New Relic node.js agent');

    patchModule();

    loadInstrumentation();
    startHarvest();
    connect();
    sampler.start(self.statsEngine);
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

  this.createTransaction = function () {
    return self.transaction = trace.createTransaction(self);
  };

  this.incrementCounter = function (metric_name) {
    self.statsEngine.getUnscopedStats().getStats(metric_name).incrementCallCount();
  };
}
util.inherits(Agent, events.EventEmitter);

var agent = new Agent();

exports._agent = agent;
exports.stop = agent.stop;
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
