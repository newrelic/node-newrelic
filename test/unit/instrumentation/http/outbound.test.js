'use strict'

var http = require('http')
var events = require('events')
var chai = require('chai')
var expect = chai.expect
var helper = require('../../../lib/agent_helper')
var NAMES = require('../../../../lib/metrics/names.js')
var instrumentOutbound = require('../../../../lib/transaction/tracer/instrumentation/outbound.js')
var hashes = require('../../../../lib/util/hashes')
var nock = require('nock')
var semver = require('semver')

describe('instrumentOutbound', function () {
  var agent
  var HOSTNAME = 'localhost'
  var PORT = 8890


  before(function () {
    agent = helper.loadMockedAgent()
  })

  after(function () {
    helper.unloadAgent(agent)
  })

  describe('when working with http.createClient', function () {
    before(function () {
      // capture the deprecation warning here
      http.createClient()
    })

    function test(expectedPort, expectedHost, port, host) {
      var client = http.createClient(port, host)
      expect(client.port).equal(expectedPort)
      expect(client.host).equal(expectedHost)
    }

    it('should provide default port and hostname', function () {
      test(80, 'localhost')
    })

    it('should accept port and provide default hostname', function () {
      test(8089, 'localhost', 8089)
    })

    it('should accept port and hostname', function () {
      test(8089, 'me', 8089, 'me')
    })

    it('should set default port on null port', function () {
      test(80, 'me', null, 'me')
    })

    it('should provide default port and hostname on nulls', function () {
      test(80, 'localhost', null, null)
    })
  })

  it('should strip query parameters from path in transaction trace segment', function () {
    var req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      var path = '/asdf'
      var name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path

      instrumentOutbound(agent, HOSTNAME, PORT, makeFakeRequest)
      expect(transaction.trace.root.children[0].name).equal(name)

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
    })
  })

  it('should save query parameters from path if capture is defined', function () {
    var req = new events.EventEmitter()
    helper.runInTransaction(agent, function (transaction) {
      agent.config.capture_params = true
      instrumentOutbound(agent, HOSTNAME, PORT, makeFakeRequest)
      expect(transaction.trace.root.children[0].parameters).deep.equal({
        'a'                            : 'b',
        'nr_exclusive_duration_millis' : null,
        'another'                      : 'yourself',
        'thing'                        : true,
        'grownup'                      : 'true'
      })

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
    })
  })

  it('should not accept an undefined path', function () {
    var req = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      expect(function () {
        instrumentOutbound(agent, HOSTNAME, PORT, makeFakeRequest)
      }).to.throw(Error)
    })

    function makeFakeRequest() {
      return req
    }
  })

  it('should accept a simple path with no parameters', function () {
    var req = new events.EventEmitter()
    var path = '/newrelic'
    helper.runInTransaction(agent, function (transaction) {
      var name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path
      req.path = path
      instrumentOutbound(agent, HOSTNAME, PORT, makeFakeRequest)
      expect(transaction.trace.root.children[0].name).equal(name)
    })

    function makeFakeRequest() {
      req.path = path
      return req
    }
  })

  it('should purge trailing slash', function () {
    var req = new events.EventEmitter()
    var path = '/newrelic/'
    helper.runInTransaction(agent, function (transaction) {
      var name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + '/newrelic'
      req.path = path
      instrumentOutbound(agent, HOSTNAME, PORT, makeFakeRequest)
      expect(transaction.trace.root.children[0].name).equal(name)
    })

    function makeFakeRequest() {
      req.path = path
      return req
    }
  })

  it('should throw if hostname is undefined', function () {
    var req = new events.EventEmitter()
    var undef

    helper.runInTransaction(agent, function () {
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, undef, PORT, makeFakeRequest)
      }).to.throw(Error)
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
  })

  it('should throw if hostname is null', function () {
    var req = new events.EventEmitter()

    helper.runInTransaction(agent, function () {
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, null, PORT, makeFakeRequest)
      }).to.throw(Error)
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
  })

  it('should throw if hostname is an empty string', function () {
    var req = new events.EventEmitter()
    helper.runInTransaction(agent, function () {
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, '', PORT, makeFakeRequest)
      }).to.throw(Error)
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
  })

  it('should throw if port is undefined', function () {
    var req = new events.EventEmitter()
    var undef

    helper.runInTransaction(agent, function () {
      expect(function TestUndefinedHostname() {
        instrumentOutbound(agent, 'hostname', undef, makeFakeRequest)
      }).to.throw(Error)
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
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
        var segment = agent.tracer.getTransaction().trace.root.children[0]

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
        var segment = agent.tracer.getTransaction().trace.root.children[0]

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

    function handled(transaction) {
      var req = http.get({host : 'localhost', port : 12345}, function() {})

      req.on('close', function() {
        expect(transaction.exceptions).length(0)
        unhandled(transaction)
      })

      req.on('error', function(err) {
        expect(err.message).match(/connect ECONNREFUSED( 127.0.0.1:12345)?/)
      })

      req.end()
    }

    function unhandled(transaction) {
      var req = http.get({host : 'localhost', port : 12345}, function() {})

      req.on('close', function() {
        expect(transaction.exceptions).length(1)
        expect(transaction.exceptions[0][0].message).match(/connect ECONNREFUSED( 127.0.0.1:12345)?/)
        done()
      })

      req.end()
    }
  })
})

describe('when working with http.request', function () {
  var agent
  var HOSTNAME = 'localhost'
  var PORT = 8890

  before(function () {
    agent = helper.instrumentMockedAgent()
    nock.disableNetConnect()
  })

  after(function () {
    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  it('should accept port and hostname', function (done) {
    var host = 'http://www.google.com'
    var path = '/index.html'
    nock(host).get(path).reply(200, 'Hello from Google')

    helper.runInTransaction(agent, function (transaction) {
      http.get('http://www.google.com/index.html', function (res) {
        var segment = agent.tracer.getSegment()

        expect(segment.name).equal('External/www.google.com/index.html')
        res.resume()
        transaction.end()
        done()
      })
    })
  })

  it('should start and end segment', function (done) {
    var host = 'http://www.google.com'
    var path = '/index.html'
    nock(host).get(path).delay(10).reply(200, 'Hello from Google')

    helper.runInTransaction(agent, function (transaction) {
      http.get('http://www.google.com/index.html', function (res) {
        var segment = agent.tracer.getSegment()

        expect(segment.timer.hrstart).instanceof(Array)
        expect(segment.timer.hrDuration).equal(null)

        res.resume()
        res.on('end', function onEnd() {
          expect(segment.timer.hrDuration).instanceof(Array)
          expect(segment.timer.duration).above(0)
          transaction.end()
          done()
        })
      })
    })
  })
})
