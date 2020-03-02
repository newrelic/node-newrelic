'use strict'

var http = require('http')
var https = require('https')
var url = require('url')
var events = require('events')
var expect = require('chai').expect
var helper = require('../../../lib/agent_helper')
var NAMES = require('../../../../lib/metrics/names')
var instrumentOutbound = require('../../../../lib/instrumentation/core/http-outbound')
var hashes = require('../../../../lib/util/hashes')
var nock = require('nock')
var Segment = require('../../../../lib/transaction/trace/segment')


describe('instrumentOutbound', function() {
  var agent
  var HOSTNAME = 'localhost'
  var PORT = 8890


  before(function() {
    agent = helper.loadMockedAgent()
  })

  after(function() {
    helper.unloadAgent(agent)
  })

  it('should omit query parameters from path if attributes.enabled is false', function() {
    helper.unloadAgent(agent)
    agent = helper.loadMockedAgent({
      attributes: {
        enabled: false
      }
    })
    var req = new events.EventEmitter()
    helper.runInTransaction(agent, function(transaction) {
      instrumentOutbound(agent, {host: HOSTNAME, port: PORT}, makeFakeRequest)
      expect(transaction.trace.root.children[0].getAttributes()).to.deep.equal({})

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
    })
    helper.unloadAgent(agent)
    agent = helper.loadMockedAgent()
  })

  it('should omit query parameters from path if high_security is true', function() {
    helper.unloadAgent(agent)
    agent = helper.loadMockedAgent({
      high_security: true
    })
    var req = new events.EventEmitter()
    helper.runInTransaction(agent, function(transaction) {
      instrumentOutbound(agent, {host: HOSTNAME, port: PORT}, makeFakeRequest)
      expect(transaction.trace.root.children[0].getAttributes()).to.deep.equal({
        'procedure': 'GET',
        'url': `http://${HOSTNAME}:${PORT}/asdf`,
      })

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
    })
    helper.unloadAgent(agent)
    agent = helper.loadMockedAgent()
  })

  it('should strip query parameters from path in transaction trace segment', function() {
    var req = new events.EventEmitter()
    helper.runInTransaction(agent, function(transaction) {
      var path = '/asdf'
      var name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path

      instrumentOutbound(agent, {host: HOSTNAME, port: PORT}, makeFakeRequest)
      expect(transaction.trace.root.children[0].name).equal(name)

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
    })
  })

  it('should save query parameters from path if attributes.enabled is true', function() {
    var req = new events.EventEmitter()
    helper.runInTransaction(agent, function(transaction) {
      agent.config.attributes.enabled = true
      instrumentOutbound(agent, {host: HOSTNAME, port: PORT}, makeFakeRequest)
      expect(transaction.trace.root.children[0].getAttributes()).to.deep.equal({
        'url': `http://${HOSTNAME}:${PORT}/asdf`,
        'procedure': 'GET',
        'request.parameters.a': 'b',
        'request.parameters.another': 'yourself',
        'request.parameters.thing': true,
        'request.parameters.grownup': 'true'
      })

      function makeFakeRequest() {
        req.path = '/asdf?a=b&another=yourself&thing&grownup=true'
        return req
      }
    })
  })

  it('should not accept an undefined path', function() {
    var req = new events.EventEmitter()
    helper.runInTransaction(agent, function() {
      expect(function() {
        instrumentOutbound(agent, {host: HOSTNAME, port: PORT}, makeFakeRequest)
      }).to.throw(Error)
    })

    function makeFakeRequest() {
      return req
    }
  })

  it('should accept a simple path with no parameters', function() {
    var req = new events.EventEmitter()
    var path = '/newrelic'
    helper.runInTransaction(agent, function(transaction) {
      var name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + path
      req.path = path
      instrumentOutbound(agent, {host: HOSTNAME, port: PORT}, makeFakeRequest)
      expect(transaction.trace.root.children[0].name).equal(name)
    })

    function makeFakeRequest() {
      req.path = path
      return req
    }
  })

  it('should purge trailing slash', function() {
    var req = new events.EventEmitter()
    var path = '/newrelic/'
    helper.runInTransaction(agent, function(transaction) {
      var name = NAMES.EXTERNAL.PREFIX + HOSTNAME + ':' + PORT + '/newrelic'
      req.path = path
      instrumentOutbound(agent, {host: HOSTNAME, port: PORT}, makeFakeRequest)
      expect(transaction.trace.root.children[0].name).equal(name)
    })

    function makeFakeRequest() {
      req.path = path
      return req
    }
  })

  it('should not throw if hostname is undefined', function() {
    var req = new events.EventEmitter()

    helper.runInTransaction(agent, function() {
      let req2 = null
      expect(() => {
        req2 = instrumentOutbound(agent, {port: PORT}, makeFakeRequest)
      }).to.not.throw()

      expect(req2).to.equal(req).and.not.have.property('__NR_transactionInfo')
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
  })

  it('should not throw if hostname is null', function() {
    var req = new events.EventEmitter()

    helper.runInTransaction(agent, function() {
      let req2 = null
      expect(() => {
        req2 = instrumentOutbound(agent, {host: null, port: PORT}, makeFakeRequest)
      }).to.not.throw()

      expect(req2).to.equal(req).and.not.have.property('__NR_transactionInfo')
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
  })

  it('should not throw if hostname is an empty string', function() {
    var req = new events.EventEmitter()
    helper.runInTransaction(agent, function() {
      let req2 = null
      expect(() => {
        req2 = instrumentOutbound(agent, {host: '', port: PORT}, makeFakeRequest)
      }).to.not.throw()

      expect(req2).to.equal(req).and.not.have.property('__NR_transactionInfo')
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
  })

  it('should not throw if port is undefined', function() {
    var req = new events.EventEmitter()

    helper.runInTransaction(agent, function() {
      let req2 = null
      expect(() => {
        req2 = instrumentOutbound(agent, {host: 'hostname'}, makeFakeRequest)
      }).to.not.throw()

      expect(req2).to.equal(req).and.not.have.property('__NR_transactionInfo')
    })

    function makeFakeRequest() {
      req.path = '/newrelic'
      return req
    }
  })
})

describe('should add data from cat header to segment', function() {
  var encKey = 'gringletoes'
  var server
  var agent

  var appData = [
    '123#456',
    'abc',
    0,
    0,
    -1,
    'xyz'
  ]

  before(function(done) {
    agent = helper.instrumentMockedAgent({
      cross_application_tracer: {enabled: true},
      encoding_key: encKey,
      trusted_account_ids: [123]
    })
    var obfData = hashes.obfuscateNameUsingKey(JSON.stringify(appData), encKey)
    server = http.createServer(function(req, res) {
      res.writeHead(200, {'x-newrelic-app-data': obfData})
      res.end()
      req.resume()
    })
    server.listen(4123, done)
  })

  after(function(done) {
    helper.unloadAgent(agent)
    server.close(done)
  })

  function addSegment() {
    var transaction = agent.getTransaction()
    transaction.type = 'web'
    transaction.baseSegment = new Segment(transaction, 'base-segment')
  }

  it('should use config.obfuscatedId as the x-newrelic-id header', function(done) {
    helper.runInTransaction(agent, function() {
      addSegment()
      http.get({host : 'localhost', port : 4123}, function(res) {
        var segment = agent.tracer.getTransaction().trace.root.children[0]

        expect(segment.catId).equal('123#456')
        expect(segment.catTransaction).equal('abc')
        expect(segment.name).equal('ExternalTransaction/localhost:4123/123#456/abc')
        expect(segment.getAttributes().transaction_guid).equal('xyz')
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
        expect(segment.getAttributes().transaction_guid).equal('xyz')
        res.resume()
        agent.getTransaction().end()
        done()
      }).end()
    })
  })

  it('should collect errors only if they are not being handled', function(done) {
    var emit = events.EventEmitter.prototype.emit
    events.EventEmitter.prototype.emit = function(evnt) {
      if (evnt === 'error') {
        this.once('error', function() {})
      }
      return emit.apply(this, arguments)
    }
    // This is really fucking gross.
    afterEach(function() {
      events.EventEmitter.prototype.emit = emit
    })


    helper.runInTransaction(agent, handled)
    var errRegex = /connect ECONNREFUSED( 127.0.0.1:12345)?/

    function handled(transaction) {
      var req = http.get({host : 'localhost', port : 12345}, function() {})

      req.on('close', function() {
        expect(transaction.exceptions).length(0)
        unhandled(transaction)
      })

      req.on('error', function(err) {
        expect(err.message).match(errRegex)
      })

      req.end()
    }

    function unhandled(transaction) {
      var req = http.get({host : 'localhost', port : 12345}, function() {})

      req.on('close', function() {
        expect(transaction.exceptions).length(1)
        expect(transaction.exceptions[0][0].message).match(errRegex)
        done()
      })

      req.end()
    }
  })
})

describe('when working with http.request', function() {
  var agent

  before(function() {
    agent = helper.instrumentMockedAgent()
    nock.disableNetConnect()
  })

  after(function() {
    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  it('should accept port and hostname', function(done) {
    var host = 'http://www.google.com'
    var path = '/index.html'
    nock(host).get(path).reply(200, 'Hello from Google')

    helper.runInTransaction(agent, function(transaction) {
      http.get('http://www.google.com/index.html', function(res) {
        var segment = agent.tracer.getSegment()

        expect(segment.name).equal('External/www.google.com/index.html')
        res.resume()
        transaction.end()
        done()
      })
    })
  })

  it('should conform to external segment spec', function(done) {
    var host = 'http://www.google.com'
    var path = '/index.html'
    nock(host).post(path).reply(200)

    helper.runInTransaction(agent, function(transaction) {
      var opts = url.parse(`${host}${path}`)
      opts.method = 'POST'

      var req = http.request(opts, function(res) {
        var attributes = transaction.trace.root.children[0].getAttributes()
        expect(attributes.url).equal('http://www.google.com/index.html')
        expect(attributes.procedure).equal('POST')
        res.resume()
        transaction.end()
        done()
      })
      req.end()
    })
  })

  it('should start and end segment', function(done) {
    var host = 'http://www.google.com'
    var path = '/index.html'
    nock(host).get(path).delay(10).reply(200, 'Hello from Google')

    helper.runInTransaction(agent, function(transaction) {
      http.get('http://www.google.com/index.html', function(res) {
        var segment = agent.tracer.getSegment()

        expect(segment.timer.hrstart).instanceof(Array)
        expect(segment.timer.hrDuration).equal(null)

        res.resume()
        res.on('end', function onEnd() {
          expect(segment.timer.hrDuration).instanceof(Array)
          expect(segment.timer.getDurationInMillis()).above(0)
          transaction.end()
          done()
        })
      })
    })
  })

  describe('when parent segment opaque', () => {
    it('should not modify parent segment', (done) => {
      const host = 'http://www.google.com'
      const paramName = 'testParam'
      const path = `/index.html?${paramName}=value`

      nock(host).get(path).reply(200, 'Hello from Google')

      helper.runInTransaction(agent, (transaction) => {
        const parentSegment = agent.tracer.createSegment('ParentSegment')
        parentSegment.opaque = true
        agent.tracer.segment = parentSegment // make the current active segment

        http.get(`${host}${path}`, (res) => {
          const segment = agent.tracer.getSegment()

          expect(segment).to.equal(parentSegment)
          expect(segment.name).to.equal('ParentSegment')

          const attributes = segment.getAttributes()

          expect(attributes).to.not.have.property('url')

          expect(attributes)
            .to.not.have.property(`request.parameters.${paramName}`)

          res.resume()
          transaction.end()
          done()
        })
      })
    })
  })

  describe('generates distributed tracing headers', () => {
    it('should add both headers to outbound request', (done) => {
      helper.unloadAgent(agent)
      agent = helper.instrumentMockedAgent({
        distributed_tracing: {
          enabled: true
        },
        feature_flag: {
        }
      })
      agent.config.trusted_account_key = 190
      agent.config.account_id = 190
      agent.config.primary_application_id = '389103'
      const host = 'http://www.google.com'
      const path = '/index.html'
      let headers

      nock(host).get(path).reply(200, function() {
        headers = this.req.headers
        expect(headers.traceparent).to.exist
        expect(headers.traceparent.split('-').length).to.equal(4)
        expect(headers.tracestate).to.exist
        expect(headers.tracestate.includes('null')).to.be.false
        expect(headers.tracestate.includes('true')).to.be.false

        expect(headers.newrelic).to.exist
      })

      helper.runInTransaction(agent, (transaction) => {
        http.get(`${host}${path}`, (res) => {
          res.resume()
          transaction.end()
          const tc = transaction.traceContext
          const valid = tc._validateAndParseTraceStateHeader(headers.tracestate)
          expect(valid.entryValid).to.equal(true)
          done()
        })
      })
    })

    it('should only add w3c header when exclude_newrelic_header: true', (done) => {
      helper.unloadAgent(agent)
      agent = helper.instrumentMockedAgent({
        distributed_tracing: {
          enabled: true,
          exclude_newrelic_header: true
        },
        feature_flag: {
        }
      })
      agent.config.trusted_account_key = 190
      agent.config.account_id = 190
      agent.config.primary_application_id = '389103'
      const host = 'http://www.google.com'
      const path = '/index.html'
      let headers

      nock(host).get(path).reply(200, function() {
        headers = this.req.headers
        expect(headers.traceparent).to.exist
        expect(headers.traceparent.split('-').length).to.equal(4)
        expect(headers.tracestate).to.exist
        expect(headers.tracestate.includes('null')).to.be.false
        expect(headers.tracestate.includes('true')).to.be.false

        expect(headers.newrelic).to.not.exist
      })

      helper.runInTransaction(agent, (transaction) => {
        http.get(`${host}${path}`, (res) => {
          res.resume()
          transaction.end()
          const tc = transaction.traceContext
          const valid = tc._validateAndParseTraceStateHeader(headers.tracestate)
          expect(valid.entryValid).to.equal(true)
          done()
        })
      })
    })
  })
})

describe("node >= v10 api", () => {
  let agent

  before(function() {
    if (!global.URL) { this.skip("Don't test Node v10+ API on this version of Node") }
  })

  beforeEach(function() {
    agent = helper.instrumentMockedAgent()
    nock.disableNetConnect()
  })

  afterEach(function() {
    nock.enableNetConnect()
    helper.unloadAgent(agent)
  })

  function getMethodFromName(nodule, method) {
    let _nodule

    if (nodule === 'http') { _nodule = http }
    if (nodule === 'https') { _nodule = https }

    return _nodule[method]
  }

  // Iterates through the given module and method, testing each signature combination. For
  // testing the http/https modules and get/request methods.
  function testSignatures(nodule, method) {
    const host = 'www.newrelic.com'
    const port = nodule === 'https' ? ':443' : ''
    const path = '/index.html'
    const leftPart = `${nodule}://${host}`
    const _url = `${leftPart}${path}`

    function testSignature(testOpts) {
      const {urlType, headers, callback, swapHost} = testOpts

      // Setup the arguments and the test name
      let args = []   // Setup arguments to the get/request function
      let names = []  // Capture parameters for the name of the test

      // See if a URL argument is being used
      if (urlType === 'string') {
        args.push(_url)
        names.push('URL string')
      } else if (urlType === 'object') {
        args.push(global.URL ? new global.URL(_url) : _url)
        names.push('URL object')
      }

      // See if an options argument should be used
      let opts = {}
      if (headers) {
        opts.headers = {test: 'test'}
        names.push('options')
      }
      // If options specifies a hostname, it will override the url parameter
      if (swapHost) {
        opts.hostname = 'www.google.com'
        names.push('options with different hostname')
      }
      if (Object.keys(opts).length > 0) {
        args.push(opts)
      }

      // If the callback argument should be setup, just add it to the name for now, and
      // setup within the it() call since the callback needs to access the done() function
      if (callback) {
        names.push('callback')
      }

      // Name the test and start it
      const testName = names.join(', ')
      it(testName, function(done) {
        // If testing the options overriding the URL argument, set up nock differently
        if (swapHost) {
          nock(`${nodule}://www.google.com`).get(path).reply(200, 'Hello from Google')
        } else {
          nock(leftPart).get(path).reply(200, 'Hello from New Relic')
        }

        // Setup a function to test the response. Here to get access to done()
        let callbackTester = (res) => {
          testResult(res, testOpts, done)
        }

        // Add callback to the arguments, if used
        if (callback) {
          args.push(callbackTester)
        }

        helper.runInTransaction(agent, function() {
          // Methods have to be retrieved within the transaction scope for instrumentation
          const request = getMethodFromName(nodule, method)
          const clientRequest = request(...args)
          clientRequest.end()

          // If not using a callback argument, setup the callback on the 'response' event
          if (!callback) {
            clientRequest.on('response', callbackTester)
          }
        })
      })
    }

    function testResult(res, {headers, swapHost}, done) {
      let external = `External/${host}${port}${path}`
      let str = 'Hello from New Relic'
      if (swapHost) {
        external = `External/www.google.com${port}/index.html`
        str = 'Hello from Google'
      }

      const segment = agent.tracer.getSegment()

      expect(segment.name).equal(external)
      expect(res.statusCode).to.equal(200)

      res.on('data', (data) => {
        if (headers) {
          expect(res.req.headers.test).to.equal('test')
        }
        expect(data.toString()).to.equal(str)
        done()
      })
    }

    testSignature({
      urlType: 'object',
    })

    testSignature({
      urlType: 'string',
    })

    testSignature({
      urlType: 'string',
      headers: true,
    })

    testSignature({
      urlType: 'object',
      headers: true,
    })

    testSignature({
      urlType: 'string',
      callback: true
    })

    testSignature({
      urlType: 'object',
      callback: true
    })

    testSignature({
      urlType: 'string',
      headers: true,
      callback: true
    })

    testSignature({
      urlType: 'object',
      headers: true,
      callback: true
    })

    testSignature({
      urlType: 'string',
      headers: true,
      callback: true,
      swapHost: true
    })

    testSignature({
      urlType: 'object',
      headers: true,
      callback: true,
      swapHost: true
    })
  }

  describe("http.get",      () => { testSignatures('http',  'get') })
  describe("http.request",  () => { testSignatures('http',  'request') })
  describe("https.get",     () => { testSignatures('https', 'get') })
  describe("https.request", () => { testSignatures('https', 'request') })
})
