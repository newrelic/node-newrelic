'use strict'

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , expect = chai.expect
  , API    = require('../../../stub_api.js')
  

describe("the stubbed New Relic agent API", function () {
  var api

  beforeEach(function () {
    api = new API()
  })

  it("should export 11 API calls", function () {
    expect(Object.keys(api.constructor.prototype).length).equal(12)
  })

  it("exports a transaction naming function", function () {
    should.exist(api.setTransactionName)
    expect(api.setTransactionName).a('function')
  })

  it("shouldn't throw when transaction is named", function () {
    expect(function () { api.setTransactionName('TEST/*'); }).not.throws()
  })

  it("exports a controller naming function", function () {
    should.exist(api.setControllerName)
    expect(api.setControllerName).a('function')
  })

  it("shouldn't throw when controller is named without an action", function () {
    expect(function () { api.setControllerName('TEST/*'); }).not.throws()
  })

  it("shouldn't throw when controller is named with an action", function () {
    expect(function () { api.setControllerName('TEST/*', 'test'); }).not.throws()
  })

  it("exports a transaction ignoring function", function () {
    should.exist(api.setIgnoreTransaction)
    expect(api.setIgnoreTransaction).a('function')
  })

  it("exports a function for adding naming rules", function () {
    should.exist(api.addNamingRule)
    expect(api.addNamingRule).a('function')
  })

  it("shouldn't throw when a naming rule is added", function () {
    expect(function () { api.addNamingRule(/^foo/, "/foo/*"); }).not.throws()
  })

  it("exports a function for ignoring certain URLs", function () {
    should.exist(api.addIgnoringRule)
    expect(api.addIgnoringRule).a('function')
  })

  it("shouldn't throw when an ignoring rule is added", function () {
    expect(function () { api.addIgnoringRule(/^foo/, "/foo/*"); }).not.throws()
  })

  it("exports a function for capturing errors", function () {
    should.exist(api.noticeError)
    expect(api.noticeError).a('function')
  })

  it("shouldn't throw when an error is added", function () {
    expect(function () { api.noticeError(new Error()); }).not.throws()
  })

  it("should return an empty string when requesting browser monitoring", function () {
    api.getBrowserTimingHeader().should.equal('')
  })

  it("exports a function for adding custom parameters", function () {
    should.exist(api.addCustomParameter)
    expect(api.addCustomParameter).a('function')
  })

  it("shouldn't throw when a custom parameter is added", function () {
    expect(function () { api.addCustomParameter('test', 'value'); }).not.throws()
  })

  it("shouldn't throw when a custom segment is added", function () {
    expect(function () {
      api.createTracer('name', function nop(){})
    }).not.throws()
  })

  it("should return a function when calling createTracer", function () {
    function myNop () {}
    var retVal = api.createTracer('name', myNop)
    expect(retVal).to.be.equal(myNop)
  })

  it("shouldn't throw when a custom web transaction is added", function () {
    expect(function () {
      api.createWebTransaction('name', function nop(){})
    }).not.throws()
  })

  it("should return a function when calling createWebTransaction", function () {
    function myNop () {}
    var retVal = api.createWebTransaction('name', myNop)
    expect(retVal).to.be.equal(myNop)
  })

  it("shouldn't throw when a custom background transaction is added", function () {
    expect(function () {
      api.createBackgroundTransaction('name', function nop(){})
    }).not.throws()
  })

  it("should return a function when calling createBackgroundTransaction", function () {
    function myNop () {}
    var retVal = api.createBackgroundTransaction('name', myNop)
    expect(retVal).to.be.equal(myNop)
  })

  it("shouldn't throw when a transaction is ended", function () {
    expect(function () {
      api.endTransaction()
    }).not.throws()
  })
})
