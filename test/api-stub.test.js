'use strict';

var path   = require('path')
  , chai   = require('chai')
  , should = chai.should()
  , expect = chai.expect
  , API    = require(path.join(__dirname, '..', 'stub_api.js'))
  ;

describe("the stubbed New Relic agent API", function () {
  var api;

  beforeEach(function () {
    api = new API();
  });

  it("should export 6 API calls", function () {
    expect(Object.keys(api.constructor.prototype).length).equal(6);
  });

  it("exports a transaction naming function", function () {
    should.exist(api.setTransactionName);
    expect(api.setTransactionName).a('function');
  });

  it("shouldn't throw when transaction is named", function () {
    expect(function () { api.setTransactionName('TEST/*'); }).not.throws();
  });

  it("exports a controller naming function", function () {
    should.exist(api.setControllerName);
    expect(api.setControllerName).a('function');
  });

  it("shouldn't throw when controller is named without an action", function () {
    expect(function () { api.setControllerName('TEST/*'); }).not.throws();
  });

  it("shouldn't throw when controller is named with an action", function () {
    expect(function () { api.setControllerName('TEST/*', 'test'); }).not.throws();
  });

  it("exports a transaction ignoring function", function () {
    should.exist(api.setIgnoreTransaction);
    expect(api.setIgnoreTransaction).a('function');
  });

  it("exports a function for adding naming rules", function () {
    should.exist(api.addNamingRule);
    expect(api.addNamingRule).a('function');
  });

  it("shouldn't throw when a naming rule is added", function () {
    expect(function () { api.addNamingRule(/^foo/, "/foo/*"); }).not.throws();
  });

  it("exports a function for ignoring certain URLs", function () {
    should.exist(api.addIgnoringRule);
    expect(api.addIgnoringRule).a('function');
  });

  it("shouldn't throw when an ignoring rule is added", function () {
    expect(function () { api.addIgnoringRule(/^foo/, "/foo/*"); }).not.throws();
  });

  it("exports a function for capturing errors", function () {
    should.exist(api.noticeError);
    expect(api.noticeError).a('function');
  });

  it("shouldn't throw when an error is added", function () {
    expect(function () { api.noticeError(new Error()); }).not.throws();
  });
});
