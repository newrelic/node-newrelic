/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { test } = require('tap')
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

test('database query parser', function (t) {
  t.autoend()
  t.test('should accept query as a string', function (t) {
    const ps = parseSql('select * from someTable')
    t.equal(ps.query, 'select * from someTable')
    t.end()
  })

  t.test('should accept query as a sql property of an object', function (t) {
    const ps = parseSql({
      sql: 'select * from someTable'
    })
    t.equal(ps.query, 'select * from someTable')
    t.end()
  })

  t.test('SELECT SQL', function (t) {
    t.autoend()
    t.test('should parse a simple query', function (t) {
      const ps = parseSql('Select * from dude')
      t.ok(ps)

      t.ok(ps.operation)
      t.equal(ps.operation, 'select')

      t.ok(ps.collection)
      t.equal(ps.collection, 'dude')
      t.equal(ps.query, 'Select * from dude')
      t.end()
    })

    t.test('should parse more interesting queries too', function (t) {
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
      t.ok(ps)
      t.equal(ps.operation, 'select')
      t.equal(ps.collection, 'postcodes')
      t.equal(ps.query, sql)
      t.end()
    })
  })

  t.test('DELETE SQL', function (t) {
    t.autoend()
    t.test('should parse a simple command', function (t) {
      const ps = parseSql('DELETE\nfrom dude')
      t.ok(ps)

      t.ok(ps.operation)
      t.equal(ps.operation, 'delete')

      t.ok(ps.collection)
      t.equal(ps.collection, 'dude')
      t.equal(ps.query, 'DELETE\nfrom dude')
      t.end()
    })

    t.test('should parse a command with conditions', function (t) {
      const ps = parseSql("DELETE\nfrom dude where name = 'man'")
      t.ok(ps)

      t.ok(ps.operation)
      t.equal(ps.operation, 'delete')

      t.ok(ps.collection)
      t.equal(ps.collection, 'dude')
      t.equal(ps.query, "DELETE\nfrom dude where name = 'man'")
      t.end()
    })
  })

  t.test('UPDATE SQL', function (t) {
    t.autoend()
    t.test('should parse a command with gratuitous white space and conditions', function (t) {
      const ps = parseSql('  update test set value = 1 where id = 12')
      t.ok(ps)

      t.ok(ps.operation)
      t.equal(ps.operation, 'update')

      t.ok(ps.collection)
      t.equal(ps.collection, 'test')
      t.equal(ps.query, 'update test set value = 1 where id = 12')
      t.end()
    })
  })

  t.test('INSERT SQL', function (t) {
    t.autoend()
    t.test('should parse a command with a subquery', function (t) {
      const ps = parseSql('  insert into\ntest\nselect * from dude')
      t.ok(ps)

      t.ok(ps.operation)
      t.equal(ps.operation, 'insert')

      t.ok(ps.collection)
      t.equal(ps.collection, 'test')
      t.equal(ps.query, 'insert into\ntest\nselect * from dude')
      t.end()
    })
  })

  t.test('invalid SQL', function (t) {
    t.autoend()
    t.test("should return 'other' when handed garbage", function (t) {
      const ps = parseSql('  bulge into\ndudes\nselect * from dude')
      t.ok(ps)
      t.equal(ps.operation, 'other')
      t.notOk(ps.collection)
      t.equal(ps.query, 'bulge into\ndudes\nselect * from dude')
      t.end()
    })

    t.test("should return 'other' when handed an object", function (t) {
      const ps = parseSql({
        key: 'value'
      })
      t.ok(ps)
      t.equal(ps.operation, 'other')
      t.notOk(ps.collection)
      t.equal(ps.query, '')
      t.end()
    })
  })

  t.test('CAT', function (t) {
    t.autoend()
    CATs.forEach(function (cat) {
      t.test(clean(cat.input), function (t) {
        t.autoend()
        const ps = parseSql(cat.input)

        t.test('should parse the operation as ' + cat.operation, function (t) {
          t.equal(ps.operation, cat.operation)
          t.end()
        })

        if (cat.table === '(subquery)') {
          t.test('should parse subquery collections as ' + cat.table)
        } else if (/\w+\.\w+/.test(ps.collection)) {
          t.test('should strip database names from collection names as ' + cat.table)
        } else {
          t.test('should parse the collection as ' + cat.table, function (t) {
            t.equal(ps.collection, cat.table)
            t.end()
          })
        }
      })
    })
  })
})
