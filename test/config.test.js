/*global before:false beforeEach:false after:false afterEach:false describe:false it:false*/
var logger  = require('../lib/logger')
  , config  = require('../lib/config')
  ;

describe('disabled test agent', function () {
  it('should handle a minimal configuration', function (done) {
    var c = config.initialize(logger, {config : {'agent_enabled' : false}});
    c.agent_enabled.should.equal(false);

    return done();
  });
});
