'use strict'

var NameState = require('../../lib/transaction/name-state.js')
var tap = require('tap')

tap.test("basic naming test", function (t) {
  t.plan(1)
  var state = new NameState('Nodejs', 'GET', '/', 'path1')
  state.appendPath('path2')
  t.equal(state.getName(), 'Nodejs/GET//path1/path2')
})

tap.test("basic piece-wise set name test", function (t) {
  t.plan(1)
  var state = new NameState(null, null, null, null)
  state.setPrefix('Nodejs')
  state.setVerb('GET')
  state.setDelimiter('/')
  state.appendPath('path1')
  state.appendPath('path2')
  state.appendPath('path3')
  t.equal(state.getName(), 'Nodejs/GET//path1/path2/path3')
})

tap.test("missing component name test", function (t) {
  t.plan(4)
  var state = new NameState('Nodejs', null, null, 'path1')
  t.equal(state.getName(), 'Nodejs/path1')

  state = new NameState('Nodejs', null, '/', 'path1')
  t.equal(state.getName(), 'Nodejs//path1')

  state = new NameState(null, null, null, 'path1')
  t.equal(state.getName(), '/path1')

  state = new NameState('Nodejs', null, null, null)
  t.equal(state.getName(), null)
})

tap.test("reset deletes name test", function (t) {
  t.plan(2)
  var state = new NameState('Nodejs', 'GET', '/', 'path1')
  t.equal(state.getName(), 'Nodejs/GET//path1')

  state.reset()
  t.equal(state.getName(), null)
})

tap.test("handles regex appended to path", function (t) {
  t.plan(1)
  var state = new NameState('Nodejs', 'GET', '/', [])
  state.appendPath(new RegExp('regex1'))
  state.appendPath('path1')
  state.appendPath(/regex2/i)
  state.appendPath('path2')

  t.equal(state.getName(), 'Nodejs/GET//regex1/path1/regex2/path2')
})
