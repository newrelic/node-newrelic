'use strict'

var path   = require('path')
  , http   = require('http')
  , events = require('events')
  , chai   = require('chai')
  , expect = chai.expect
  , nock   = require('nock')
  , helper = require('../../../lib/agent_helper')
  , NAMES  = require('../../../../lib/metrics/names.js')
  , instrumentOutbound = require('../../../../lib/transaction/tracer/instrumentation/outbound.js')
  , hashes             = require('../../../../lib/util/hashes')


describe("instrumentOutbound", function () {
  var agent
    , HOSTNAME = 'localhost'
    , PORT     = 8890


  before(function () {
    agent = helper.loadMockedAgent()
  })

  after(function () {
    helper.unloadAgent(agent)
  })

  describe("when working with http.createClient", function () {
    before(function () {
      // capture the deprecation warning here
      http.createClient()
    })

    function test(expectedPort, expectedHost, port, host) {
      var client = http.createClient(port, host)
      expect(client.port).equal(expectedPort)
      expect(client.host).equal(expectedHost)
    }

    it("should provide default port and hostname", function () {
      test(80, 'localhost')
    })

    it("should accept port and provide default hostname", function () {
      test(8089, 'localhost', 8089)
    })

    it("should accept port and hostname", function () {
      test(8089, 'me', 8089, 'me')
    })

    it("should set default port on null port", function () {
      test(80, 'me', null, 'me')
    })

    it("should provide default port and hostname on nulls", function () {
      test(80, 'localhost', null, null)
    })
  })

  it("should strip query parameters from path in transaction trace segment", function () {
    var req  = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      var path  = '/asdf'
        , name  = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path


      req.path  = '/asdf?a=b&another=yourself&thing&grownup=true'
      instrumentOutbound(agent, req, HOSTNAME, PORT)
      expect(transaction.getTrace().root.children[0].name).equal(name)
    })
  })

  it("should save query parameters from path if capture is defined", function () {
    var req  = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      agent.config.capture_params = true
      req.path  = '/asdf?a=b&another=yourself&thing&grownup=true'
      instrumentOutbound(agent, req, HOSTNAME, PORT)
      expect(transaction.getTrace().root.children[0].parameters).deep.equal({
        "a"                            : "b",
        "nr_exclusive_duration_millis" : null,
        "another"                      : "yourself",
        "thing"                        : true,
        "grownup"                      : "true"
      })
    })
  })

  it("should not accept an undefined path", function () {
    var req  = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      expect(function () {
        instrumentOutbound(agent, req, HOSTNAME, PORT)
      }).to.throw(Error)
    })
  })

  it("should accept a simple path with no parameters", function () {
    var req  = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      var path  = '/newrelic'
        , name  = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path
      req.path  = path
      instrumentOutbound(agent, req, HOSTNAME, PORT)
      expect(transaction.getTrace().root.children[0].name).equal(name)
    })
  })

  it("should purge trailing slash", function () {
    var req  = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      var path  = '/newrelic/'
        , name  = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + '/newrelic'
      req.path  = path
      instrumentOutbound(agent, req, HOSTNAME, PORT)
      expect(transaction.getTrace().root.children[0].name).equal(name)
    })
  })

  it("should throw if hostname is undefined", function () {
    var req  = new events.EventEmitter()
      , undef


    helper.runInTransaction(agent, function () {
      req.path = '/newrelic'
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, req, undef, PORT)
      }).to.throw(Error)
    })
  })

  it("should throw if hostname is null", function () {
    var req  = new events.EventEmitter()


    helper.runInTransaction(agent, function () {
      req.path = '/newrelic'
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, req, null, PORT)
      }).to.throw(Error)
    })
  })

  it("should throw if hostname is an empty string", function () {
    var req  = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      req.path = '/newrelic'
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, req, '', PORT)
      }).to.throw(Error)
    })
  })

  it("should throw if port is undefined", function () {
    var req  = new events.EventEmitter()
      , undef


    helper.runInTransaction(agent, function () {
      req.path = '/newrelic'
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, req, 'hostname', undef)
      }).to.throw(Error)
    })
  })
})

describe('should add data from cat header to segment', function () {
  var encKey = 'gringletoes'
  var server
  var agent

  var app_data = [
    '123#456',
    'abc',
    0,
    0,
    -1,
    'xyz'
  ]

  before(function (done) {
    agent = helper.instrumentMockedAgent(
      {cat: true},
      {encoding_key: encKey, trusted_account_ids: [123]}
    )
    server = http.createServer(function(req, res) {
      res.writeHead(200, {
        'x-newrelic-app-data': hashes.obfuscateNameUsingKey(JSON.stringify(app_data), encKey)
      })
      res.end()
      req.resume()
    })
    server.listen(4123, done)
  })

  after(function (done) {
    helper.unloadAgent(agent)
    server.close(done)
  })

  function addSegment() {
    var transaction = agent.getTransaction()
    transaction.webSegment = {
      getDurationInMillis: function fake() {
        return 1000;
      }
    }
  }

  it('should use config.obfuscatedId as the x-newrelic-id header', function(done) {
    helper.runInTransaction(agent, function() {
      addSegment()
      http.get({host : 'localhost', port : 4123}, function(res) {
        var segment = agent.tracer.getSegment()

        expect(segment.catId).equal('123#456')
        expect(segment.catTransaction).equal('abc')
        expect(segment.name).equal('ExternalTransaction/localhost:4123/123#456/abc')
        expect(segment.parameters.transaction_guid).equal('xyz')
        res.resume()
        agent.getTransaction().end()
        done()
      }).end()
    })
  })

  it('should not explode with invalid data', function(done) {
    helper.runInTransaction(agent, function() {
      addSegment()
      http.get({host : 'localhost', port : 4123}, function(res) {
        var segment = agent.tracer.getSegment()

        expect(segment.catId).equal('123#456')
        expect(segment.catTransaction).equal('abc')

        // TODO: port in metric is a known bug. issue #142
        expect(segment.name).equal('ExternalTransaction/localhost:4123/123#456/abc')
        expect(segment.parameters.transaction_guid).equal('xyz')
        res.resume()
        agent.getTransaction().end()
        done()
      }).end()
    })
  })

  it('should collect errors only if they are not being handled', function(done) {
    helper.runInTransaction(agent, handled)

    function handled() {
      var req = http.get({host : 'localhost', port : 123456}, function() {})

      req.on('close', function() {
        expect(agent.errors.errors.length).equal(0)
        unhandled()
      })

      req.on('error', function(err) {
        expect(err.message).equal('connect ECONNREFUSED')
      })

      req.end()
    }

    function unhandled() {
      var req = http.get({host : 'localhost', port : 123456}, function() {})

      req.on('close', function() {
        expect(agent.errors.errors.length).equal(1)
        expect(agent.errors.errors[0][2]).equal('connect ECONNREFUSED')
        done()
      })

      req.end()
    }
  })
})

describe("when working with http.request", function () {
  var agent
    , HOSTNAME = 'localhost'
    , PORT     = 8890

  before(function () {
    agent = helper.instrumentMockedAgent()
    nock.disableNetConnect()
  })

  after(function () {
    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  it("should accept port and hostname", function (done) {
    var host = "http://www.google.com"
    var path = "/index.html"
    nock(host).get(path).reply(200, "Hello from Google")

    helper.runInTransaction(agent, function (transaction) {
      http.get("http://www.google.com/index.html", function (res) {
        var segment = agent.tracer.getSegment()

        expect(segment.name).equal('External/www.google.com/index.html')
        res.resume()
        transaction.end()
        done()
      })
    })
  })
})
