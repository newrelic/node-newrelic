'use strict';

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , RenameRules = require(path.join(__dirname, '..', 'lib', 'metrics', 'rename-rules'))
  ;

describe('RenameRules', function () {
  it("shouldn't throw if passed a null set of rules", function () {
    var rules;

    expect(function () { rules = new RenameRules(); }).not.throws();
    expect(function () { rules.load(null); }).not.throws();
  });

  it("shouldn't throw if passed an undefined set of rules", function () {
    var rules;

    expect(function () { rules = new RenameRules(); }).not.throws();
    expect(function () { rules.load(undefined); }).not.throws();
  });

  it("shouldn't throw if passed an empty rule list", function () {
    var rules;

    expect(function () { rules = new RenameRules(); }).not.throws();
    expect(function () { rules.load([]); }).not.throws();
  });

  it("shouldn't throw if passed garbage input", function () {
    var rules;

    expect(function () { rules = new RenameRules(); }).not.throws();
    expect(function () { rules.load({name : 'garbage'}, 1001); }).not.throws();
  });

  it("should load a set of rules passed into the constructor", function () {
    var rules = new RenameRules([[{name : 'Test/RenameMe1'}, 1001],
                                 [{name : 'Test/RenameMe2', scope : 'TEST'}, 1002]]);

    expect(rules.length).equal(2);
    expect(Object.keys(rules.unscoped).length).equal(1);
    expect(Object.keys(rules.scoped).length).equal(1);

    expect(rules.lookup('Test/RenameMe1')).equal(1001);
    expect(rules.lookup('Test/RenameMe2', 'TEST')).equal(1002);
  });

  it("should load rules passed in after creation", function () {
    var rules = new RenameRules();

    rules.load([[{name : 'Test/RenameMe1'}, 1001]]);
    rules.load([[{name : 'Test/RenameMe2', scope : 'TEST'}, 1002]]);

    expect(rules.length).equal(2);
    expect(Object.keys(rules.unscoped).length).equal(1);
    expect(Object.keys(rules.scoped).length).equal(1);

    expect(rules.lookup('Test/RenameMe1')).equal(1001);
    expect(rules.lookup('Test/RenameMe2', 'TEST')).equal(1002);
  });
});
