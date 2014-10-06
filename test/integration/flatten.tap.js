'use strict'

var tap  = require('tap')
  , test = tap.test
  , flatten = require('../../lib/util/flatten')
  

test('flatten flattens things', function (t) {
  t.deepEqual(flatten({}, '', {a: 5, b: true}), {a: 5, b: true}, '1 level')
  t.deepEqual(flatten({}, '', {a: 5, b: {c: true, d: 7}}), {a: 5, 'b.c': true, 'b.d': 7}, '2 levels')
  t.deepEqual(flatten({}, '', {a: 5, b: {c: true, d: 7, e: {foo: 'efoo', bar: 'ebar'}}}), {a: 5, 'b.c': true, 'b.d': 7, 'b.e.foo': 'efoo', 'b.e.bar': 'ebar'}, '3 levels')

  t.end()
})

test('flatten a recursive object', function (t) {
  var obj = {}
  obj.x = obj
  t.deepEqual(flatten({}, '', obj), {})

  t.end()
})
