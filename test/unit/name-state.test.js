/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const tap = require('tap')
const NameState = require('../../lib/transaction/name-state.js')

tap.test('NameState', function (t) {
  t.autoend()
  t.test('should handle basic naming', function (t) {
    const state = new NameState('Nodejs', 'GET', '/', 'path1')
    state.appendPath('path2')
    t.equal(state.getName(), 'Nodejs/GET//path1/path2')
    t.end()
  })

  t.test('should handle piece-wise naming', function (t) {
    const state = new NameState(null, null, null, null)
    state.setPrefix('Nodejs')
    state.setVerb('GET')
    state.setDelimiter('/')
    state.appendPath('path1')
    state.appendPath('path2')
    state.appendPath('path3')
    t.equal(state.getName(), 'Nodejs/GET//path1/path2/path3')
    t.end()
  })

  t.test('should handle missing components', function (t) {
    let state = new NameState('Nodejs', null, null, 'path1')
    t.equal(state.getName(), 'Nodejs/path1')

    state = new NameState('Nodejs', null, '/', 'path1')
    t.equal(state.getName(), 'Nodejs//path1')

    state = new NameState(null, null, null, 'path1')
    t.equal(state.getName(), '/path1')

    state = new NameState('Nodejs', null, null, null)
    t.equal(state.getName(), null)
    t.end()
  })

  t.test('should delete the name when reset', function (t) {
    const state = new NameState('Nodejs', 'GET', '/', 'path1')
    t.equal(state.getName(), 'Nodejs/GET//path1')

    state.reset()
    t.equal(state.getName(), null)
    t.end()
  })

  t.test('should handle regex paths', function (t) {
    const state = new NameState('Nodejs', 'GET', '/', [])
    state.appendPath(new RegExp('regex1'))
    state.appendPath('path1')
    state.appendPath(/regex2/)
    state.appendPath('path2')

    t.equal(state.getPath(), '/regex1/path1/regex2/path2')
    t.equal(state.getName(), 'Nodejs/GET//regex1/path1/regex2/path2')
    t.end()
  })

  t.test('should pick the current stack name over marked paths', function (t) {
    const state = new NameState('Nodejs', 'GET', '/')
    state.appendPath('path1')
    state.markPath()
    state.appendPath('path2')

    t.equal(state.getPath(), '/path1/path2')
    t.equal(state.getName(), 'Nodejs/GET//path1/path2')
    t.end()
  })

  t.test('should pick marked paths if the path stack is empty', function (t) {
    const state = new NameState('Nodejs', 'GET', '/')
    state.appendPath('path1')
    state.markPath()
    state.popPath()

    t.equal(state.getPath(), '/path1')
    t.equal(state.getName(), 'Nodejs/GET//path1')
    t.end()
  })

  t.test('should not report as empty if a path has been marked', function (t) {
    const state = new NameState('Nodejs', 'GET', '/')
    t.equal(state.isEmpty(), true)

    state.appendPath('path1')
    state.markPath()
    state.popPath()

    t.equal(state.isEmpty(), false)
    t.end()
  })
})
