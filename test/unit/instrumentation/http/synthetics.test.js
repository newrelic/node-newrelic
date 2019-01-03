'use strict'

var expect = require('chai').expect
var hashes = require('../../../../lib/util/hashes')
var helper = require('../../../lib/agent_helper')


describe('synthetics outbound header', function() {
  var http
  var server
  var agent
  var ENCODING_KEY = 'Old Spice'
  var SYNTHETICS_DATA_ARRAY = [
    1, // version
    567, // account id
    'moe', // synthetics resource id
    'larry', // synthetics job id
    'curly' // synthetics monitor id
  ]
  var SYNTHETICS_DATA = {
    version: SYNTHETICS_DATA_ARRAY[0],
    accountId: SYNTHETICS_DATA_ARRAY[1],
    resourceId: SYNTHETICS_DATA_ARRAY[2],
    jobId: SYNTHETICS_DATA_ARRAY[3],
    monitorId: SYNTHETICS_DATA_ARRAY[4]
  }
  var SYNTHETICS_HEADER = hashes.obfuscateNameUsingKey(
    JSON.stringify(SYNTHETICS_DATA_ARRAY),
    ENCODING_KEY
  )

  var PORT = 9873
  var CONNECT_PARAMS = {
    hostname: 'localhost',
    port: PORT
  }

  before(function(done) {
    agent = helper.instrumentMockedAgent({
      cross_application_tracer: {enabled: true},
      trusted_account_ids: [23, 567],
      encoding_key: ENCODING_KEY
    })
    http = require('http')
    server = http.createServer(function(req, res) {
      req.resume()
      res.end()
    })
    server.listen(PORT, done)
  })

  after(function(done) {
    helper.unloadAgent(agent)
    server.close(function() {
      done()
    })
  })

  it('should be propegated if on tx', function(done) {
    helper.runInTransaction(agent, function(transaction) {
      transaction.syntheticsData = SYNTHETICS_DATA
      transaction.syntheticsHeader = SYNTHETICS_HEADER
      var req = http.request(CONNECT_PARAMS, function(res) {
        res.resume()
        transaction.end()
        expect(res.headers['x-newrelic-synthetics']).equal(SYNTHETICS_HEADER)
        done()
      })
      req.end()
    })
  })

  it('should not be propegated if not on tx', function(done) {
    helper.runInTransaction(agent, function(transaction) {
      http.get(CONNECT_PARAMS, function(res) {
        res.resume()
        transaction.end()
        expect(res.headers).to.not.have.property('x-newrelic-synthetics')
        done()
      })
    })
  })
})

describe('synthetics inbound header', function() {
  var http
  var server
  var agent
  var synthData

  var ENCODING_KEY = 'Old Spice'

  var PORT = 9873
  var CONNECT_PARAMS = {
    hostname: 'localhost',
    port: PORT
  }

  function createServer(done, requestHandler) {
    http = require('http')
    var s = http.createServer(function(req, res) {
      requestHandler(req, res)
      res.end()
      req.resume()
    })
    s.listen(PORT, done)
    return s
  }

  beforeEach(function() {
    synthData = [
      1, // version
      567, // account id
      'moe', // synthetics resource id
      'larry', // synthetics job id
      'curly' // synthetics monitor id
    ]
    agent = helper.instrumentMockedAgent({
      cross_application_tracer: {enabled: true},
      trusted_account_ids: [23, 567],
      encoding_key: ENCODING_KEY
    })

    http = require('http')
  })

  afterEach(function(done) {
    helper.unloadAgent(agent)
    server.close(done)
  })

  it('should exist if account id and version are ok', function(done) {
    var synthHeader = hashes.obfuscateNameUsingKey(
      JSON.stringify(synthData),
      ENCODING_KEY
    )
    var options = Object.assign({}, CONNECT_PARAMS)
    options.headers = {
      'X-NewRelic-Synthetics': synthHeader
    }
    server = createServer(
      function onListen() {
        http.get(options, function(res) {
          res.resume()
        })
      },
      function onRequest() {
        var tx = agent.getTransaction()
        expect(tx).to.exist
        expect(tx).to.have.property('syntheticsHeader', synthHeader)
        expect(tx).property('syntheticsData').to.be.an('object')
        expect(tx).to.have.nested.property('syntheticsData.version', synthData[0])
        expect(tx).to.have.nested.property('syntheticsData.accountId', synthData[1])
        expect(tx).to.have.nested.property('syntheticsData.resourceId', synthData[2])
        expect(tx).to.have.nested.property('syntheticsData.jobId', synthData[3])
        expect(tx).to.have.nested.property('syntheticsData.monitorId', synthData[4])
        done()
      }
    )
  })

  it('should propegate inbound synthetics header on response', function(done) {
    var synthHeader = hashes.obfuscateNameUsingKey(
      JSON.stringify(synthData),
      ENCODING_KEY
    )
    var options = Object.assign({}, CONNECT_PARAMS)
    options.headers = {
      'X-NewRelic-Synthetics': synthHeader
    }
    server = createServer(
      function onListen() {
        http.get(options, function(res) {
          res.resume()
        })
      },
      function onRequest(req, res) {
        res.writeHead(200)
        expect(res._headers).to.have.property('x-newrelic-synthetics', synthHeader)
        done()
      }
    )
  })
})
