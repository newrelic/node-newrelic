'use strict'
function TestMod() {}
TestMod.prototype.foo = function foo(bar) {
  return `value of ${bar}`
}
module.exports = TestMod

