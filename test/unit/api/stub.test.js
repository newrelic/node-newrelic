'use strict'

var chai   = require('chai')
var should = chai.should()
var expect = chai.expect
var API    = require('../../../stub_api.js')


describe("the stubbed New Relic agent API", function() {
  var api

  beforeEach(function() {
    api = new API()
  })

  it("should export 28 API calls", function() {
    expect(Object.keys(api.constructor.prototype).length).to.equal(28)
  })

  it("exports a transaction naming function", function() {
    should.exist(api.setTransactionName)
    expect(api.setTransactionName).a('function')
  })

  it("exports a dispatcher naming function", function() {
    should.exist(api.setDispatcher)
    expect(api.setDispatcher).a('function')
  })

  it("shouldn't throw when transaction is named", function() {
    expect(function() { api.setTransactionName('TEST/*') }).not.throws()
  })

  it("exports a controller naming function", function() {
    should.exist(api.setControllerName)
    expect(api.setControllerName).a('function')
  })

  it("shouldn't throw when controller is named without an action", function() {
    expect(function() { api.setControllerName('TEST/*') }).not.throws()
  })

  it("shouldn't throw when controller is named with an action", function() {
    expect(function() { api.setControllerName('TEST/*', 'test') }).not.throws()
  })

  it("exports a transaction ignoring function", function() {
    should.exist(api.setIgnoreTransaction)
    expect(api.setIgnoreTransaction).a('function')
  })

  it("exports a function to get the current transaction handle", function() {
    should.exist(api.getTransaction)
    expect(api.getTransaction).a('function')
  })

  it("exports a function for adding naming rules", function() {
    should.exist(api.addNamingRule)
    expect(api.addNamingRule).a('function')
  })

  it("shouldn't throw when a naming rule is added", function() {
    expect(function() { api.addNamingRule(/^foo/, "/foo/*") }).not.throws()
  })

  it("exports a function for ignoring certain URLs", function() {
    should.exist(api.addIgnoringRule)
    expect(api.addIgnoringRule).a('function')
  })

  it("shouldn't throw when an ignoring rule is added", function() {
    expect(function() { api.addIgnoringRule(/^foo/, "/foo/*") }).not.throws()
  })

  it("exports a function for capturing errors", function() {
    should.exist(api.noticeError)
    expect(api.noticeError).a('function')
  })

  it("shouldn't throw when an error is added", function() {
    expect(function() { api.noticeError(new Error()) }).not.throws()
  })

  it("should return an empty string when requesting browser monitoring", function() {
    api.getBrowserTimingHeader().should.equal('')
  })

  it("exports a function for adding custom parameters", function() {
    should.exist(api.addCustomParameter)
    expect(api.addCustomParameter).a('function')
  })

  it("shouldn't throw when a custom parameter is added", function() {
    expect(function() { api.addCustomParameter('test', 'value') }).not.throws()
  })

  it("exports a function for adding multiple custom parameters at once", function() {
    should.exist(api.addCustomParameters)
    expect(api.addCustomParameters).a('function')
  })

  it("shouldn't throw when multiple custom parameters are added", function() {
    expect(function() {
      api.addCustomParameters({test: 'value', test2: 'value2'})
    }).to.not.throw()
  })

  it("shouldn't throw when a custom segment is added", function() {
    expect(function() {
      api.createTracer('name', function nop() {})
    }).not.throws()
  })

  it("should return a function when calling createTracer", function() {
    function myNop() {}
    var retVal = api.createTracer('name', myNop)
    expect(retVal).to.equal(myNop)
  })

  it('should call the function passed into `startSegment`', function(done) {
    api.startSegment('foo', false, done)
  })

  it('should not throw when a non-function is passed to `startSegment`', function() {
    expect(function() {
      api.startSegment('foo', false, null)
    }).to.not.throw()
  })

  it('should return the return value of the handler', function() {
    var obj = {}
    var ret = api.startSegment('foo', false, function() { return obj })
    expect(obj).to.equal(ret)
  })

  it("shouldn't throw when a custom web transaction is started", function() {
    expect(function() {
      api.startWebTransaction('test', function nop() {})
    }).not.throws()
  })

  it("should call the function passed into startWebTransaction", function(done) {
    api.startWebTransaction('test', function nop() {
      done()
    })
  })

  it("shouldn't throw when a callback isn't passed into startWebTransaction", function() {
    expect(function() {
      api.startWebTransaction('test')
    }).not.throws()
  })

  it("shouldn't throw when a non-function callback is passed into startWebTransaction", function() {
    expect(function() {
      api.startWebTransaction('test', 'asdf')
    }).not.throws()
  })

  it("shouldn't throw when a custom background transaction is started", function() {
    expect(function() {
      api.startBackgroundTransaction('test', 'group', function nop() {})
    }).not.throws()
  })

  it("should call the function passed into startBackgroundTransaction", function(done) {
    api.startBackgroundTransaction('test', 'group', function nop() {
      done()
    })
  })

  it("shouldn't throw when a callback isn't passed into startBackgroundTransaction", function() {
    expect(function() {
      api.startBackgroundTransaction('test', 'group')
    }).not.throws()
  })

  it("shouldn't throw when a non-function callback is passed into startBackgroundTransaction", function() {
    expect(function() {
      api.startBackgroundTransaction('test', 'group', 'asdf')
    }).not.throws()
  })

  it("shouldn't throw when a custom background transaction is started with no group", function() {
    expect(function() {
      api.startBackgroundTransaction('test', function nop() {})
    }).not.throws()
  })

  it("should call the function passed into startBackgroundTransaction with no group", function(done) {
    api.startBackgroundTransaction('test', function nop() {
      done()
    })
  })

  it("shouldn't throw when a callback isn't passed into startBackgroundTransaction with no group", function() {
    expect(function() {
      api.startBackgroundTransaction('test')
    }).not.throws()
  })

  it("shouldn't throw when a custom web transaction is added", function() {
    expect(function() {
      api.createWebTransaction('name', function nop() {})
    }).not.throws()
  })

  it("should return a function when calling createWebTransaction", function() {
    function myNop() {}
    var retVal = api.createWebTransaction('name', myNop)
    expect(retVal).to.be.equal(myNop)
  })

  it("shouldn't throw when a custom background transaction is added", function() {
    expect(function() {
      api.createBackgroundTransaction('name', function nop() {})
    }).not.throws()
  })

  it("should return a function when calling createBackgroundTransaction", function() {
    function myNop() {}
    var retVal = api.createBackgroundTransaction('name', myNop)
    expect(retVal).to.be.equal(myNop)
  })

  it("shouldn't throw when a custom background transaction with a group is added", function() {
    expect(function() {
      api.createBackgroundTransaction('name', 'group', function nop() {})
    }).not.throws()
  })

  it("should return a function when calling createBackgroundTransaction", function() {
    function myNop() {}
    var retVal = api.createBackgroundTransaction('name', 'group', myNop)
    expect(retVal).to.be.equal(myNop)
  })

  it("shouldn't throw when a transaction is ended", function() {
    expect(function() {
      api.endTransaction()
    }).not.throws()
  })

  it('exports a metric recording function', function() {
    should.exist(api.recordMetric)
    expect(api.recordMetric).a('function')
  })

  it('should not throw when calling the metric recorder', function() {
    expect(function() {
      api.recordMetric('metricname', 1)
    }).not.throws()
  })

  it('exports a metric increment function', function() {
    should.exist(api.incrementMetric)
    expect(api.incrementMetric).a('function')
  })

  it('should not throw when calling a metric incrementor', function() {
    expect(function() {
      api.incrementMetric('metric name')
    }).not.throws()
  })

  it('exports a record custom event function', function() {
    should.exist(api.recordCustomEvent)
    expect(api.recordCustomEvent).a('function')
  })

  it('should not throw when calling the custom metric recorder', function() {
    expect(function() {
      api.recordCustomEvent('EventName', {id: 10})
    }).not.throws()
  })
})
