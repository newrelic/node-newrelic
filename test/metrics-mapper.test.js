'use strict';

var path         = require('path')
  , chai         = require('chai')
  , expect       = chai.expect
  , MetricMapper = require(path.join(__dirname, '..', 'lib', 'metrics', 'mapper.js'))
  ;

describe('MetricMapper', function () {
  it("shouldn't throw if passed a null set of mappings", function () {
    var map;

    expect(function () { map = new MetricMapper(); }).not.throws();
    expect(function () { map.load(null); }).not.throws();
  });

  it("shouldn't throw if passed an undefined set of mappings", function () {
    var map;

    expect(function () { map = new MetricMapper(); }).not.throws();
    expect(function () { map.load(undefined); }).not.throws();
  });

  it("shouldn't throw if passed an empty list", function () {
    var map;

    expect(function () { map = new MetricMapper(); }).not.throws();
    expect(function () { map.load([]); }).not.throws();
  });

  it("shouldn't throw if passed garbage input", function () {
    var map;

    expect(function () { map = new MetricMapper(); }).not.throws();
    expect(function () { map.load({name : 'garbage'}, 1001); }).not.throws();
  });

  it("should load a set of mappings passed into the constructor", function () {
    var map = new MetricMapper([[{name : 'Test/RenameMe1'}, 1001],
                                 [{name : 'Test/RenameMe2', scope : 'TEST'}, 1002]]);

    expect(map.length).equal(2);
    expect(Object.keys(map.unscoped).length).equal(1);
    expect(Object.keys(map.scoped).length).equal(1);

    expect(map.lookup('Test/RenameMe1')).equal(1001);
    expect(map.lookup('Test/RenameMe2', 'TEST')).equal(1002);
  });

  it("should load mappings passed in after creation", function () {
    var map = new MetricMapper();

    map.load([[{name : 'Test/RenameMe1'}, 1001]]);
    map.load([[{name : 'Test/RenameMe2', scope : 'TEST'}, 1002]]);

    expect(map.length).equal(2);
    expect(Object.keys(map.unscoped).length).equal(1);
    expect(Object.keys(map.scoped).length).equal(1);

    expect(map.lookup('Test/RenameMe1')).equal(1001);
    expect(map.lookup('Test/RenameMe2', 'TEST')).equal(1002);
  });
});
