'use strict';

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , nock         = require('nock')
  , helper       = require(path.join(__dirname, 'lib', 'agent_helper.js'))
  ;

/*
 *
 * CONSTANTS
 *
 */
var RUN_ID = 1337
  ;

describe("the New Relic agent", function () {
  before(function () {
    nock.disableNetConnect();
  });

  after(function () {
    nock.enableNetConnect();
  });

  describe("_sendEvents", function () {
    var agent, events;

    beforeEach(function () {
      agent = helper.loadMockedAgent();

      // FLAG: insights
      agent.config.feature_flag.insights = true;

      agent.collector = {
        analyticsEvents: function (_events, callback) {
          events = _events;
          process.nextTick(callback);
        }
      };
    });

    afterEach(function () {
      helper.unloadAgent(agent);
    });

    it("should pass events to server", function (done) {
      var events0 = [
        [{},{}]
      ];
      agent.events = events0;
      agent._sendEvents(function () {
        expect(events[1]).equals(events0);
        done();
      });
    });

    it("should send agent run id", function (done) {
      agent.config.run_id = RUN_ID;
      agent._sendEvents(function () {
        expect(events[0]).equals(RUN_ID);
        done();
      });
    });

  });
});
