'use strict';

var path = require('path')
  , chai   = require('chai')
  , expect = chai.expect
  , should = chai.should()
  , environment = require(path.join(__dirname, '..', 'lib', 'environment'))
  ;

function find(settings, name) {
  var items = settings.filter(function (candidate) {
    return candidate[0] === name;
  });

  expect(items.length).equal(1);

  return items[0][1];
}

describe("the environment scraper", function () {
  var settings;

  before(function () {
    settings = environment.toJSON();
  });

  it("should have some settings", function () {
    expect(settings.length).above(1);
  });

  it("should find at least one CPU", function () {
    expect(find(settings, 'Processors')).above(0);
  });

  it("should have found an operating system", function () {
    should.exist(find(settings, 'OS'));
  });

  it("should have found an operating system version", function () {
    should.exist(find(settings, 'OS version'));
  });

  it("should have found the system architecture", function () {
    should.exist(find(settings, 'Architecture'));
  });

  it("should have built a flattened package list", function () {
    expect(find(settings, 'Packages').length).above(5);
  });

  it("should have built a flattened dependency list", function () {
    expect(find(settings, 'Dependencies').length).above(5);
  });
});
