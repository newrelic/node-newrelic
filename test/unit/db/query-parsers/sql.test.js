/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')
const parseSql = require('../../../../lib/db/query-parsers/sql')
const CATs = require('../../../lib/cross_agent_tests/sql_parsing')

/**
 * Wraps query in double-quotes and
 * escapes \n, \r, and \t
 *
 * @param {string} sql to escape
 */
function clean(sql) {
  return '"' + sql.replace(/\n/gm, '\\n').replace(/\r/gm, '\\r').replace(/\t/gm, '\\t') + '"'
}

test('database query parser', async (t) => {
  await t.test('should accept query as a string', function () {
    const ps = parseSql('select * from someTable')
    assert.equal(ps.query, 'select * from someTable')
  })

  await t.test('should accept query as a sql property of an object', function () {
    const ps = parseSql({
      sql: 'select * from someTable'
    })
    assert.equal(ps.query, 'select * from someTable')
  })

  await t.test('SELECT SQL', async (t) => {
    await t.test('should parse a simple query', function () {
      const ps = parseSql('Select * from dude')
      assert.ok(ps)

      assert.ok(ps.operation)
      assert.equal(ps.operation, 'select')

      assert.ok(ps.collection)
      assert.equal(ps.collection, 'dude')
      assert.equal(ps.query, 'Select * from dude')
    })

    await t.test('should parse more interesting queries too', function () {
      const sql = [
        'SELECT P.postcode, ',
        'P.suburb, ',
        'R.region_state as state, ',
        'PR.region_id , ',
        'P.id ',
        'FROM postcodes as P ',
        'JOIN postcodes_regions as PR on PR.postcode = P.postcode ',
        'join ref_region as R on PR.region_id = R.region_id ',
        'join ref_state as S on S.state_id = R.region_state ',
        'WHERE S.state_code = ? ',
        'AND P.suburb_seo_key = ? ',
        'LIMIT 1'
      ].join('\n')
      const ps = parseSql(sql)
      assert.ok(ps)
      assert.equal(ps.operation, 'select')
      assert.equal(ps.collection, 'postcodes')
      assert.equal(ps.query, sql)
    })
  })

  await t.test('DELETE SQL', async (t) => {
    await t.test('should parse a simple command', function () {
      const ps = parseSql('DELETE\nfrom dude')
      assert.ok(ps)

      assert.ok(ps.operation)
      assert.equal(ps.operation, 'delete')

      assert.ok(ps.collection)
      assert.equal(ps.collection, 'dude')
      assert.equal(ps.query, 'DELETE\nfrom dude')
    })

    await t.test('should parse a command with conditions', function () {
      const ps = parseSql("DELETE\nfrom dude where name = 'man'")
      assert.ok(ps)

      assert.ok(ps.operation)
      assert.equal(ps.operation, 'delete')

      assert.ok(ps.collection)
      assert.equal(ps.collection, 'dude')
      assert.equal(ps.query, "DELETE\nfrom dude where name = 'man'")
    })
  })

  await t.test('UPDATE SQL', function (t) {
    t.test('should parse a command with gratuitous white space and conditions', function () {
      const ps = parseSql('  update test set value = 1 where id = 12')
      assert.ok(ps)

      assert.ok(ps.operation)
      assert.equal(ps.operation, 'update')

      assert.ok(ps.collection)
      assert.equal(ps.collection, 'test')
      assert.equal(ps.query, 'update test set value = 1 where id = 12')
    })
  })

  await t.test('INSERT SQL', function (t) {
    t.test('should parse a command with a subquery', function () {
      const ps = parseSql('  insert into\ntest\nselect * from dude')
      assert.ok(ps)

      assert.ok(ps.operation)
      assert.equal(ps.operation, 'insert')

      assert.ok(ps.collection)
      assert.equal(ps.collection, 'test')
      assert.equal(ps.query, 'insert into\ntest\nselect * from dude')
    })
  })

  await t.test('invalid SQL', async (t) => {
    await t.test("should return 'other' when handed garbage", function () {
      const ps = parseSql('  bulge into\ndudes\nselect * from dude')
      assert.ok(ps)
      assert.equal(ps.operation, 'other')
      assert.ok(!ps.collection)
      assert.equal(ps.query, 'bulge into\ndudes\nselect * from dude')
    })

    await t.test("should return 'other' when handed an object", function () {
      const ps = parseSql({
        key: 'value'
      })
      assert.ok(ps)
      assert.equal(ps.operation, 'other')
      assert.ok(!ps.collection)
      assert.equal(ps.query, '')
    })
  })

  await t.test('CAT', async function (t) {
    for (const cat of CATs) {
      await t.test(clean(cat.input), async (t) => {
        const ps = parseSql(cat.input)

        await t.test('should parse the operation as ' + cat.operation, function () {
          assert.equal(ps.operation, cat.operation)
        })

        if (cat.table === '(subquery)') {
          await t.test('should parse subquery collections as ' + cat.table)
        } else if (/\w+\.\w+/.test(ps.collection)) {
          await t.test('should strip database names from collection names as ' + cat.table)
        } else {
          await t.test('should parse the collection as ' + cat.table, function () {
            assert.equal(ps.collection, cat.table)
          })
        }
      })
    }
  })
})
