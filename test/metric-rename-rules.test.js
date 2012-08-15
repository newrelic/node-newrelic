'use strict';

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , RenameRules = require(path.join(__dirname, '..', 'lib', 'metric', 'rename-rules'))
  ;

describe('RenameRules', function () {
  it("should parse a set of rules passed into the constructor", function () {
    var rules = new RenameRules([[{name : 'Test/RenameMe1'}, 'Test/Rollup'],
                                 [{name : 'Test/RenameMe2', scope : 'TEST'}, 'Test/Rollup']]);
    expect(rules.lookup('Test/RenameMe1')).equal('Test/Rollup');
    expect(rules.lookup('Test/RenameMe2', 'TEST')).equal('Test/Rollup');
  });
});
