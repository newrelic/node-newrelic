/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const NameState = require('../../lib/transaction/name-state.js')

test('should handle basic naming', () => {
  const state = new NameState('Nodejs', 'GET', '/', 'path1')
  state.appendPath('path2')
  assert.equal(state.getName(), 'Nodejs/GET//path1/path2')
})

test('should handle piece-wise naming', () => {
  const state = new NameState(null, null, null, null)
  state.setPrefix('Nodejs')
  state.setVerb('GET')
  state.setDelimiter('/')
  state.appendPath('path1')
  state.appendPath('path2')
  state.appendPath('path3')
  assert.equal(state.getName(), 'Nodejs/GET//path1/path2/path3')
})

test('should handle missing components', () => {
  let state = new NameState('Nodejs', null, null, 'path1')
  assert.equal(state.getName(), 'Nodejs/path1')

  state = new NameState('Nodejs', null, '/', 'path1')
  assert.equal(state.getName(), 'Nodejs//path1')

  state = new NameState(null, null, null, 'path1')
  assert.equal(state.getName(), '/path1')

  state = new NameState('Nodejs', null, null, null)
  assert.equal(state.getName(), null)
})

test('should delete the name when reset', () => {
  const state = new NameState('Nodejs', 'GET', '/', 'path1')
  assert.equal(state.getName(), 'Nodejs/GET//path1')

  state.reset()
  assert.equal(state.getName(), null)
})

test('should handle regex paths', () => {
  const state = new NameState('Nodejs', 'GET', '/', [])
  state.appendPath(new RegExp('regex1'))
  state.appendPath('path1')
  state.appendPath(/regex2/)
  state.appendPath('path2')

  assert.equal(state.getPath(), '/regex1/path1/regex2/path2')
  assert.equal(state.getName(), 'Nodejs/GET//regex1/path1/regex2/path2')
})

test('should pick the current stack name over marked paths', () => {
  const state = new NameState('Nodejs', 'GET', '/')
  state.appendPath('path1')
  state.markPath()
  state.appendPath('path2')

  assert.equal(state.getPath(), '/path1/path2')
  assert.equal(state.getName(), 'Nodejs/GET//path1/path2')
})

test('should pick marked paths if the path stack is empty', () => {
  const state = new NameState('Nodejs', 'GET', '/')
  state.appendPath('path1')
  state.markPath()
  state.popPath()

  assert.equal(state.getPath(), '/path1')
  assert.equal(state.getName(), 'Nodejs/GET//path1')
})

test('should not report as empty if a path has been marked', () => {
  const state = new NameState('Nodejs', 'GET', '/')
  assert.equal(state.isEmpty(), true)

  state.appendPath('path1')
  state.markPath()
  state.popPath()

  assert.equal(state.isEmpty(), false)
})
