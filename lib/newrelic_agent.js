'use strict';

var path             = require('path')
  , fs               = require('fs')
  , events           = require('events')
  , util             = require('util')
  , collector        = require(path.join(__dirname, 'collector', 'connection'))
  , trace            = require(path.join(__dirname, 'trace'))
  , logger           = require(path.join(__dirname, 'logger'))
  , sampler          = require(path.join(__dirname, 'sampler'))
  , shimmer          = require(path.join(__dirname, 'shimmer'))
  , ErrorService     = require(path.join(__dirname, 'error'))
  , MetricNormalizer = require(path.join(__dirname, 'metric', 'normalizer'))
  , StatsEngine      = require(path.join(__dirname, 'stats', 'engine'))
  ;

function noop() {}

var agent;
var invocationOptions;

function Agent(options) {
  events.EventEmitter.call(this);

  var self = this
    , harvestIntervalId
    ;

  try {
    this.config = require('./config').initialize(logger);
  }
  catch (e) {
    logger.error(e);
    this.start = function () { return false; };
    this.stop = noop;
    return false;
  }

  logger.setLevel(this.config.log_level || 'info');

  this.options     = options || {};
  this.environment = require('./environment');
  this.version     = this.config.version;

  this.metricNormalizer = new MetricNormalizer(logger);
  this.errorService     = new ErrorService(logger, this.config);
  this.statsEngine      = new StatsEngine();

  this.on('connectReady', function () { doConnect(self); });
  this.config.on('change', this.statsEngine.onConnect.bind(this.statsEngine));

  function connect() {
    if (!self.applicationPort) {
      logger.debug("no applicationPort set, waiting to connect");
      setTimeout(function () { self.emit('connectReady'); }, 15 * 1000);
    }
  }

  function doConnect() {
    if (self.connection) return;

    // Allow the connection to be mocked externally
    self.connection = self.options.connection || collector.createCollectorConnection(self);

    // add listeners
    self.connection.on('connect',            self.config.onConnect.bind(self.config));
    self.connection.on('connect',            self.metricNormalizer.parseMetricRules.bind(self.metricNormalizer));
    self.connection.on('metricDataError',    self.statsEngine.mergeMetricData.bind(self.statsEngine));
    self.connection.on('metricDataResponse', self.statsEngine.parseMetricIds.bind(self.statsEngine));
    self.connection.on('errorDataError',     self.errorService.onSendError.bind(self.errorService));
    self.connection.on('connectError',       function (error) {
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
    logger.debug('Patching module loading...');
    var module = require('module');

    var load = shimmer.preserveMethod(module, '_load');
    module._load = function (file) {
      var m = load.apply(this, arguments);
      moduleLoad(m, file);
      return m;
    };
  }

  // notice a module loading and patch it if there's a file in the instrumentation
  // directory with a name that matches the module name
  function moduleLoad(theModule, name) {
    if (path.extname(name) === '.js') return;

    name = path.basename(name);
    var instrumentationDir = path.join(__dirname, 'instrumentation');
    var fileName = instrumentationDir + "/" + name + '.js';
    // we have to check this synchronously.  it's important that we patch immediately when modules load
    if (fs.existsSync(fileName)) {
      logger.verbose('instrumenting', name);
      loadInstrumentationFile(name, fileName, theModule);
    }
  }

  // we load all of the core instrumentation up front.  These are always available, they're
  // pretty much always used, and we might not see the modules load through our module patching.
  function loadInstrumentation() {
    var coreDir = path.join(__dirname, 'core_instrumentation');
    var files = fs.readdirSync(coreDir);

    // load the core instrumentation files
    files.forEach(function (name) {
      if (path.extname(name) !== '.js') return;

      var fileName = coreDir + "/" + name;
      loadInstrumentationFile(name, fileName, require(path.basename(name, ".js")));
    });
  }

  function loadInstrumentationFile(shortName, fileName, theModule) {
    var inst = require(fileName);

    logger.debug('[agent.loadInstrumentationFile] instrumentation loaded from', fileName);
    try {
      inst.initialize(self, trace, theModule);
    }
    catch(e) {
      logger.debug("Failed to instrument module " + path.basename(shortName, ".js") + ": " + e.message);
      return false;
    }

    return true;
  }

  var harvest = function () {
    if (this.connection && this.connection.isConnected()) {
      this.errorService.onBeforeHarvest(this.statsEngine, this.connection);
      this.statsEngine.harvest(this.connection);
    }
  };

  this.start = function () {
    if (this.config.agent_enabled !== true) {
      logger.info('The New Relic node.js agent is disabled');
      return;
    }

    logger.info("Starting the New Relic node.js agent");
    logger.info("Config is", this.config);

    harvestIntervalId = setInterval(harvest, 60 * 1000);
    shimmer.wrapAgent(this);

    patchModule();
    loadInstrumentation();
    connect();
    sampler.start(this.statsEngine);
  };

  this.stop = function () {
    logger.info('Stopping the New Relic node.js agent');
    if (harvestIntervalId) {
      clearInterval(harvestIntervalId);
    }
    sampler.stop();
    shimmer.unwrapAgent(this);
  };
}
util.inherits(Agent, events.EventEmitter);

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


module.exports = function (options) {
  if (!options && !invocationOptions && agent) return agent;

  invocationOptions = options;

  agent = new Agent(options);
  agent.start();

  return agent;
};
