var logger  = require('../lib/logger')
  , config  = require('../lib/config')
  , service = require('../lib/service')
  ;

describe('connecting to New Relic', function () {
  var agent
    , configuration
    , newRelic
    , testLicense   = 'd67afc830dab717fd163bfcb0b8b88423e9a1a3b'
    , collectorHost = 'staging-collector.newrelic.com'
    ;

  before(function (done) {
    agent = require('./lib/test_agent').createAgent();
    configuration = config.initialize(logger, {
      'config' : {
        'app_name'    : 'node.js Tests',
        'license_key' : testLicense,
        'host'        : collectorHost,
        'port'        : 80
      }
    });
    agent.config = configuration;
    newRelic = service.createNewRelicService(agent);

    return done();
  });

  it('should establish a connection', function (done) {
    newRelic.on('connect', function () {
      // TODO: this should test more, and handle failure better.
      return done();
    });
    newRelic.connect();
  });
});
