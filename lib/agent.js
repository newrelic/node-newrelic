'use strict';

var path                = require('path')
  , fs                  = require('fs')
  , events              = require('events')
  , util                = require('util')
  , trace               = require(path.join(__dirname, 'trace'))
  , logger              = require(path.join(__dirname, 'logger'))
  , sampler             = require(path.join(__dirname, 'sampler'))
  , shimmer             = require(path.join(__dirname, 'shimmer'))
  , CollectorConnection = require(path.join(__dirname, 'collector', 'connection'))
  , ErrorService        = require(path.join(__dirname, 'error'))
  , MetricNormalizer    = require(path.join(__dirname, 'metric', 'normalizer'))
  , StatsEngine         = require(path.join(__dirname, 'stats', 'engine'))
  ;

function noop() {}

function Agent(options) {
  events.EventEmitter.call(this);

  var self = this;

  try {
    this.config = require(path.join(__dirname, 'config')).initialize(logger);
  }
  catch (e) {
    logger.error(e);
    this.start = function () { return false; };
    this.stop = noop;
    return false;
  }

  logger.level = this.config.log_level || 'info';

  this.options     = options || {};
  this.environment = require(path.join(__dirname, 'environment'));
  this.version     = this.config.version;

  this.metricNormalizer = new MetricNormalizer(logger);
  this.errors           = new ErrorService(logger, this.config);
  this.statsEngine      = new StatsEngine();

  var reconnectAttempt = function (error) {
    logger.error("An error occurred connecting to " + self.config.host + ":" + self.config.port + " - " + error);
    self.connect();
  };

  var collectorSetup = function collectorSetup() {
    if (self.connection) return;

    // Allow the connection to be mocked externally
    self.connection = self.options.connection || new CollectorConnection(self);

    // add listeners
    self.connection.on('connect',            self.config.onConnect.bind(self.config));
    self.connection.on('connect',            self.metricNormalizer.parseMetricRules.bind(self.metricNormalizer));
    self.connection.on('metricDataError',    self.statsEngine.mergeMetricData.bind(self.statsEngine));
    self.connection.on('metricDataResponse', self.statsEngine.parseMetricIds.bind(self.statsEngine));
    self.connection.on('errorDataError',     self.errors.onSendError.bind(self.errors));
    self.connection.on('connectError',       function (error) {
      setTimeout(function () { reconnectAttempt(error); }, 15 * 1000);
    });

    self.connection.connect();

    self.emit('connect');
  };

  this.on('connectReady', collectorSetup.bind(this));
  this.config.on('change', this.statsEngine.onConnect.bind(this.statsEngine));
}
util.inherits(Agent, events.EventEmitter);

Agent.prototype.connect = function connect() {
  if (!this.applicationPort) {
    logger.debug("no applicationPort set, waiting to connect");
    setTimeout(function () { this.emit('connectReady'); }, 15 * 1000);
  }
  else {
    this.emit('connectReady');
  }
};

Agent.prototype.start = function () {
  if (this.config.agent_enabled !== true) {
    return logger.warn('The New Relic Node.js agent is disabled in config.js. Not starting!');
  }

  var self = this;

  var harvest = function () {
    if (self.connection && self.connection.isConnected()) {
      // coalesce and reset the state of the error tracker
      var allErrors = self.statsEngine.unscopedStats.byName("Errors/all");
      allErrors.incrementCallCount(self.errors.errorCount);
      self.connection.sendTracedErrors(self.errors.errors);
      self.errors.clear();

      // coalesce and reset the state of the gathered metrics
      var md = self.statsEngine.getMetricData();
      self.statsEngine.clear();

      // push that thar data to the collector
      // FIXME: should have a concept of recovery upon failure as part of this function
      self.connection.sendMetricData(self.statsEngine.lastSendTime / 1000, Date.now() / 1000, md);
    }
  };

  // notice a module loading and patch it if there's a file in the instrumentation
  // directory with a name that matches the module name
  var moduleLoad = function moduleLoad(theModule, name) {
    if (path.extname(name) === '.js') return;

    name = path.basename(name);
    var instrumentationDir = path.join(__dirname, 'instrumentation');
    var fileName = instrumentationDir + "/" + name + '.js';
    // we have to check this synchronously.  it's important that we patch immediately when modules load
    if (fs.existsSync(fileName)) {
      logger.verbose('instrumenting', name);
      loadInstrumentationFile(name, fileName, theModule);
    }
  };

  // patch the module.load function so that we see modules loading and
  // have an opportunity to patch them with instrumentation
  var patchModule = function patchModule() {
    logger.debug('Patching module loading...');
    var module = require('module');

    var load = shimmer.preserveMethod(module, '_load');
    module._load = function (file) {
      var m = load.apply(this, arguments);
      moduleLoad(m, file);
      return m;
    };
  };

  // we load all of the core instrumentation up front.  These are always available, they're
  // pretty much always used, and we might not see the modules load through our module patching.
  var loadInstrumentation = function loadInstrumentation() {
    var coreDir = path.join(__dirname, 'core_instrumentation');
    var files = fs.readdirSync(coreDir);

    // load the core instrumentation files
    files.forEach(function (name) {
      if (path.extname(name) !== '.js') return;

      var fileName = coreDir + "/" + name;
      loadInstrumentationFile(name, fileName, require(path.basename(name, ".js")));
    });
  };

  var loadInstrumentationFile = function loadInstrumentationFile(shortName, fileName, theModule) {
    var inst = require(fileName);

    try {
      inst.initialize(self, trace, theModule);
    }
    catch(e) {
      logger.debug("Failed to instrument module " + path.basename(shortName, ".js") + ": " + e.message);
      return false;
    }

    return true;
  };

  logger.info("Starting the New Relic node.js agent");

  this.harvestIntervalId = setInterval(harvest, 60 * 1000);
  shimmer.wrapAgent(this);
  patchModule();
  loadInstrumentation();
  sampler.start(this.statsEngine);

  this.connect();
};

Agent.prototype.stop = function () {
  logger.info('Stopping the New Relic node.js agent');
  if (this.harvestIntervalId) clearInterval(this.harvestIntervalId);
  sampler.stop();
  shimmer.unwrapAgent(this);
};

Agent.prototype.noticeAppPort = function (port) {
  logger.debug("Noticed application running on port " + port);
  this.applicationPort = port;
  this.emit('connectReady');
};

Agent.prototype.createTransaction = function () {
  return this.transaction = trace.createTransaction(this);
};

Agent.prototype.getTransaction = function () {
  if (this.transaction) {
    if (this.transaction.finished) {
      this.transaction = null;
    }

    return this.transaction;
  }
  return null;
};

Agent.prototype.setTransaction = function (transaction) {
  if (!(transaction && transaction.finished)) {
    this.transaction = transaction;
  }
};

Agent.prototype.clearTransaction = function (transaction) {
  if (this.transaction === transaction) {
    logger.debug('clearing transaction');
    this.transaction = null;
  }
};

Agent.prototype.incrementCounter = function (metricName) {
  this.statsEngine.unscopedStats.byName(metricName).incrementCallCount();
};


module.exports = Agent;
