var path    = require('path')
  , fs      = require('fs')
  , events  = require('events')
  , util    = require('util')
  , stats   = require(path.join(__dirname, 'stats'))
  , service = require(path.join(__dirname, 'service'))
  , metric  = require(path.join(__dirname, 'metric'))
  , error   = require(path.join(__dirname, 'error'))
  , trace   = require(path.join(__dirname, 'trace'))
  , logger  = require(path.join(__dirname, 'logger'))
  , sampler = require(path.join(__dirname, 'sampler'))
  ;

function noop() {}

function Agent() {
  events.EventEmitter.call(this);

  // NewRelicService
  var self = this
    , instrumentation = []
    , harvestIntervalId
    ;

  try {
    self.config = require('./config').initialize(logger);
  }
  catch (e) {
    logger.error(e);
    self.start = function () { return false; };
    self.stop = noop;
    return false;
  }

  logger.setLevel(self.config.log_level || 'info');

  self.environment = require('./environment');
  self.version = self.config.version;

  self.metricNormalizer = new metric.MetricNormalizer(logger);
  self.errorService = new error.ErrorService(logger, self.config);
  self.statsEngine = new stats.StatsEngine(logger);

  self.config.on('change', self.statsEngine.onConnect.bind(self.statsEngine));

  function connect() {
    setTimeout(function () { doConnect(); }, self.applicationPort ? 0 : 1000);
  }

  function doConnect() {
    if (self.connection) return;

    self.connection = service.createNewRelicService(self, self.config);
    self.connection.on('connect', self.config.onConnect.bind(self.config));
    self.connection.on('connect', self.metricNormalizer.parseMetricRules.bind(self.metricNormalizer));
    self.connection.on('metricDataError', self.statsEngine.mergeMetricData.bind(self.statsEngine));
    self.connection.on('metricDataResponse', self.statsEngine.parseMetricIds.bind(self.statsEngine));
    self.connection.on('errorDataError', self.errorService.onSendError.bind(self.errorService));
    self.connection.on('connectError', function (error) {
      setTimeout(function () {
        logger.error("An error occurred connecting to " + self.config.host + ":" + self.config.port + " - " + error);
        connect();
      }, 15 * 1000);
    });
    self.connection.connect();

    self.emit('connect');
  }

  // patch the module.load function so that we see modules loading and
  // have an opportunity to patch them with instrumentation
  function patchModule() {
    var module = require('module');
    var moduleLoadFunction = module._load;

    module._load = function (file) {
      var m = moduleLoadFunction.apply(self, arguments);
      moduleLoad(m, file);
      return m;
    };
  }

  // notice a module loading and patch it if there's a file in the instrumentation
  // directory with a name that matches the module name
  function moduleLoad(theModule, name) {
    if (path.extname(name) === '.js') return;

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
      if (name.slice(-3) !== '.js') return;

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
    if (self.connection && self.connection.isConnected()) {
      // self.emit('beforeHarvest', self.statsEngine, self.connection);
      // self.emit('harvest', self.statsEngine, self.connection);
      self.errorService.onBeforeHarvest(self.statsEngine, self.connection);
      self.statsEngine.harvest(self.connection);
      self.errorService.onBeforeHarvest(self.statsEngine, connection);
      self.statsEngine.harvest(connection);
    }
  }

  self.start = function () {
    if (self.config.agent_enabled !== true) {
      logger.info('The New Relic node.js agent is disabled');
      return;
    }

    logger.info('Starting the New Relic node.js agent');

    harvestIntervalId = setInterval(harvest, 60 * 1000);

    patchModule();
    loadInstrumentation();
    connect();
    sampler.start(self.statsEngine);
  };

  self.stop = function () {
    logger.info('Stopping the New Relic node.js agent');
    if (harvestIntervalId) {
      clearInterval(harvestIntervalId);
    }
    sampler.stop();
  };
}
util.inherits(Agent, events.EventEmitter);

Agent.prototype.noticeAppPort = function (port) {
  this.applicationPort = port;
  logger.debug("Noticed application running on port " + port);
};

Agent.prototype.createTransaction = function () {
  return this.transaction = trace.createTransaction(this);
};

Agent.prototype.getTransaction = function () {
  if (this.transaction) {
    if (this.transaction.isFinished()) this.transaction = null;

    return this.transaction;
  }
  return null;
};

Agent.prototype.setTransaction = function (transaction) {
  if (!(transaction && transaction.isFinished())) {
    this.transaction = transaction;
  }
};

Agent.prototype.clearTransaction = function (transaction) {
  if (this.transaction === transaction) {
    this.transaction = null;
  }
};

Agent.prototype.incrementCounter = function (metric_name) {
  this.statsEngine.getUnscopedStats().getStats(metric_name).incrementCallCount();
};

var agent = new Agent();

exports.agent = agent;
exports.stop = agent.stop;
exports.incrementCounter = agent.incrementCounter;

function generateShim(next, name) {
  var _currentTransaction = agent.getTransaction();
  if (_currentTransaction && _currentTransaction.isFinished()) {
    agent.clearTransaction(_currentTransaction);
    _currentTransaction = null;
  }

  return function () {
    agent.setTransaction(_currentTransaction);
    return next.apply(this, arguments);
  };
}

if (false !== agent.start()) {
  // Thanks Adam Crabtree! (dude@noderiety.com)
  require('./hook')(generateShim);
}
