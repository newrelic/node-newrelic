var should  = require('should')
  , winston = require('winston')
  , config  = require('../lib/config')
  ;

describe('disabled test agent', function () {
  var logger;

  before(function (done) {
    logger = new (winston.Logger)({transports : [new (winston.transports.Console)()]});

    return done();
  });

  it('should handle a minimal configuration', function (done) {
    var c = config.initialize(logger, {config : {'agent_enabled' : false}});
    c.agent_enabled.should.equal(false);

    return done();
  });
});
