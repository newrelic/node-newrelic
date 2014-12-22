'use strict'

var tap = require('tap')
var test = tap.test
var http = require('http')
var helper = require('../../lib/agent_helper.js')
var API = require('../../../api.js')
var StreamSink = require('../../../lib/util/stream-sink.js')
var hashes = require('../../../lib/util/hashes.js')


var DATA_PREFIX = 'NREUM.info = '

test('custom naming rules should be applied early for RUM', function (t) {
  t.plan(3)

  var conf  = {
    rules: {
      name: [{pattern: '/test', name: '/WORKING'}]
    },
    license_key: 'abc1234abc1234abc1234',
    browser_monitoring: {
      enable: true,
      debug: false
    },
    application_id: 12345,
  }

  var agent = helper.instrumentMockedAgent(null, conf)
  var api = new API(agent)

  // These can't be set at config time as they are server only options
  agent.config.browser_monitoring.browser_key = 1234
  agent.config.browser_monitoring.js_agent_loader = 'function () {}'

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
      res.pipe(new StreamSink(function (err, header) {
        t.equal(header.substr(0,7), '<script', 'should generate RUM headers')
        header.split(';').forEach(function (element) {
          if (element.substr(0, DATA_PREFIX.length) === DATA_PREFIX) {
            var dataString = element.substr(DATA_PREFIX.length, element.length)
            var data = JSON.parse(dataString)
            var tx = hashes.deobfuscateNameUsingKey(
              data.transactionName,
              agent.config.license_key.substr(0,13)
            )
            t.equal(tx, 'NormalizedUri/WORKING', 'url normalized before RUM')
          }
        })
        t.end()
      }))
    }
  })

  this.tearDown(function cb_tearDown() {
    external.close()
    helper.unloadAgent(agent)
  })
})

test('custom web transactions should have rules applied for RUM', function (t) {
  t.plan(2)

  var conf  = {
    rules: {
      name: [{pattern: '/test', name: '/WORKING'}]
    },
    license_key: 'abc1234abc1234abc1234',
    browser_monitoring: {
      enable: true,
      debug: false
    },
    application_id: 12345,
  }

  var agent = helper.instrumentMockedAgent(null, conf)
  var api = new API(agent)

  // These can't be set at config time as they are server only options
  agent.config.browser_monitoring.browser_key = 1234
  agent.config.browser_monitoring.js_agent_loader = 'function () {}'


  var handler = api.createWebTransaction('/test', function () {
    var header = api.getBrowserTimingHeader()
    t.equal(header.substr(0,7), '<script', 'should generate RUM headers')
    header.split(';').forEach(function (element) {
      if (element.substr(0, DATA_PREFIX.length) === DATA_PREFIX) {
        var dataString = element.substr(DATA_PREFIX.length, element.length)
        var data = JSON.parse(dataString)
        var tx = hashes.deobfuscateNameUsingKey(
          data.transactionName,
          agent.config.license_key.substr(0,13)
        )
        t.equal(tx, 'NormalizedUri/WORKING', 'url normalized before RUM')
      }
    })
    t.end()
  })

  handler()

  this.tearDown(function cb_tearDown() {
    helper.unloadAgent(agent)
  })
})
