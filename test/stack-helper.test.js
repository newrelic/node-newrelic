'use strict';

var path        = require('path')
  , chai        = require('chai')
  , expect      = chai.expect
  , getRawStack = require(path.join(__dirname, '..', 'lib', 'trace-legacy', 'stack-helper'))
  ;

describe('stacktrace helper', function () {
  it('should accurately return a raw stacktrace', function () {
    var stack = getRawStack();
    // nothing like a hardcoded assumption about how the test is being run. Mmmm.
    expect(stack[1].receiver.type).to.equal('test');
  });
});
