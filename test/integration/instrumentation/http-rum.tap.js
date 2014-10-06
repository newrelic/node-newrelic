'use strict'

var path       = require('path')
  , tap        = require('tap')
  , test       = tap.test
  , http       = require('http')
  , helper     = require('../../lib/agent_helper.js')
  , API        = require('../../../api.js')
  , StreamSink = require('../../../lib/util/stream-sink.js')
  

test("custom naming rules should be applied early for RUM",
     function (t) {
  t.plan(2)

  var conf  = {
    rules: {
      name: [{pattern: '/test', name: '/WORKING'}]
    }
  }

  var agent = helper.instrumentMockedAgent(null, conf)
    , api   = new API(agent)
    

  agent.config.license_key                        = 'abc1234abc1234abc1234'
  agent.config.browser_monitoring.enable          = true
  agent.config.browser_monitoring.debug           = false
  agent.config.application_id                     = 12345
  agent.config.browser_monitoring.browser_key     = 1234
  agent.config.browser_monitoring.js_agent_loader = "function () {}"

  var external = http.createServer(function cb_createServer(request, response) {
    t.equal(
      agent.getTransaction().partialName,
      'NormalizedUri/WORKING',
      'name rules should be applied'
    )
    response.end(api.getBrowserTimingHeader())
  })

  external.listen(0, function(){
    var port = external.address().port

    http.request({port: port, path: '/test'}, done).end()

    function done(res) {
      res.pipe(new StreamSink(function (err, ok) {
        t.equal(ok.substr(0,7), '<script', 'shoudl generate RUM headers')
        t.end()
      }))
    }
  })

  this.tearDown(function cb_tearDown() {
    external.close()
    helper.unloadAgent(agent)
  })
})
