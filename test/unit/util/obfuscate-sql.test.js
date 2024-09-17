/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const assert = require('node:assert')
const test = require('node:test')
const tests = require('../../lib/cross_agent_tests/sql_obfuscation/sql_obfuscation')
const obfuscate = require('../../../lib/util/sql/obfuscate')

function runTest(t, testCase, dialect) {
  const obfuscated = obfuscate(testCase.sql, dialect)
  if (testCase.obfuscated.length === 1) {
    assert.equal(obfuscated, testCase.obfuscated[0])
  } else {
    assert.ok(testCase.obfuscated.includes(obfuscated))
  }
}

for (const testCase of tests) {
  for (const dialect of testCase.dialects) {
    test(`${dialect}: ${testCase.name}`, (t) => {
      runTest(t, testCase, dialect)
    })
  }
}

test('should handle line endings', () => {
  const result = obfuscate('select * from foo where --abc\r\nbar=5', 'mysql')
  assert.equal(result, 'select * from foo where ?\r\nbar=?')
})

test('should handle large JSON inserts', () => {
  const JSONData = '{"data": "' + new Array(8400000).fill('a').join('') + '"}'
  const result = obfuscate(
    'INSERT INTO "Documents" ("data") VALUES (\'' + JSONData + "')",
    'postgres'
  )
  assert.equal(result, 'INSERT INTO "Documents" ("data") VALUES (?)')
})
