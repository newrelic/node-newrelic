/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const tap = require('tap')
const tests = require('../../lib/cross_agent_tests/sql_obfuscation/sql_obfuscation')
const obfuscate = require('../../../lib/util/sql/obfuscate')

tap.test('sql obfuscation', (t) => {
  tests.forEach((test) => {
    t.test(test.name, (t) => {
      for (let i = 0; i < test.dialects.length; ++i) {
        runTest(test, test.dialects[i])
      }
      t.end()
    })
  })

  function runTest(test, dialect) {
    t.test(dialect, (t) => {
      const obfuscated = obfuscate(test.sql, dialect)
      if (test.obfuscated.length === 1) {
        t.equal(obfuscated, test.obfuscated[0])
      } else {
        t.ok(test.obfuscated.includes(obfuscated))
      }
      t.end()
    })
  }

  t.test('should handle line endings', (t) => {
    const result = obfuscate('select * from foo where --abc\r\nbar=5', 'mysql')
    t.equal(result, 'select * from foo where ?\r\nbar=?')
    t.end()
  })

  t.test('should handle large JSON inserts', (t) => {
    const JSONData = '{"data": "' + new Array(8400000).fill('a').join('') + '"}'
    const result = obfuscate(
      'INSERT INTO "Documents" ("data") VALUES (\'' + JSONData + '\')', 'postgres')
    t.equal(result, 'INSERT INTO "Documents" ("data") VALUES (?)')
    t.end()
  })

  t.end()
})
