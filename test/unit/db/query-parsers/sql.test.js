/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const test = require('node:test')
const assert = require('node:assert')

const match = require('../../../lib/custom-assertions/match')
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

        assert.equal(ps.operation, cat.operation, `should parse the operation as ${cat.operation}`)

        if (cat.table === '(subquery)') {
          t.todo('should parse subquery collections as ' + cat.table)
        } else if (/\w+\.\w+/.test(ps.collection)) {
          t.todo('should strip database names from collection names as ' + cat.table)
        } else {
          assert.equal(ps.collection, cat.table, `should parse the collection as ${cat.table}`)
        }
      })
    }
  })
})

test('logs correctly if input is incorrect', () => {
  let logs = []
  const logger = {
    traceEnabled() {
      return true
    },
    trace(msg, data) {
      logs.push([msg, data])
    },
    debug(error, msg) {
      logs.push([error, msg])
    }
  }

  let result = parseSql({ an: 'invalid object' }, { logger })
  assert.deepStrictEqual(result, { operation: 'other', collection: null, query: '' })
  assert.deepStrictEqual(logs, [
    ['parseSQL got a non-string sql that looks like: %s', `{"an":"invalid object"}`]
  ])

  logs = []
  logger.trace = () => {
    throw Error('boom')
  }
  result = parseSql({ an: 'invalid object' }, { logger })
  assert.deepStrictEqual(result, { operation: 'other', collection: null, query: '' })
  assert.equal(logs[0][1], 'Unable to stringify SQL')
})

test('reports correct info if single line comments present', () => {
  const expected = { operation: 'insert', collection: 'bar', table: 'bar' }
  let statement = `-- insert into bar some stuff
  insert into bar
    (col1, col2) -- the columns
  values('a', 'b') -- the values
  `
  let found = parseSql(statement)
  match(found, expected)

  statement = `# insert into bar some stuff
  insert into bar
    (col1, col2) # the columns
  values('a', 'b') # the values
  `
  found = parseSql(statement)
  match(found, expected)

  statement = `--insert into bar some stuff
  insert into bar
    (col1, col2) --the columns
  values('--hoorah', '#foobar') #the values
  `
  found = parseSql(statement)
  match(found, expected)
})

test('reports correct info if multi-line comments present', () => {
  const expected = { operation: 'insert', collection: 'foo', table: 'foo' }

  let statement = `/*insert into bar some stuff*/
    insert into foo (col1) values('bar')
    `
  let found = parseSql(statement)
  match(found, expected)

  statement = `/****
      insert into bar some stuff
    ****/
    insert into
    foo (col1)
    values('bar')
    `
  found = parseSql(statement)
  match(found, expected)

  statement = `insert /* insert into bar */ into foo`
  found = parseSql(statement)
  match(found, expected)

  statement = `/* insert into bar some stuff */ insert into foo (col1)`
  found = parseSql(statement)
  match(found, expected)

  statement = `insert into /* insert into bar some stuff */ foo (col1)`
  found = parseSql(statement)
  match(found, expected)

  statement = `insert /* comments! */ into /* insert into bar some stuff */ foo /* MOAR */ (col1)`
  found = parseSql(statement)
  match(found, expected)
})

test('handles quoted names', () => {
  const expected = { operation: 'insert', collection: 'foo', table: 'foo' }

  let statement = 'insert into `foo` (col1)'
  let found = parseSql(statement)
  match(found, expected)

  statement = `insert into 'foo' (col1)`
  found = parseSql(statement)
  match(found, expected)

  statement = `insert into "foo" (col1)`
  found = parseSql(statement)
  match(found, expected)

  expected.collection = 'foo``foo'
  expected.table = 'foo``foo'
  statement = 'insert into `foo``foo`'
  found = parseSql(statement)
  match(found, expected)

  expected.collection = `foo''foo`
  expected.table = `foo''foo`
  statement = "insert into `foo''foo`"
  found = parseSql(statement)
  match(found, expected)

  expected.collection = `foo"foo`
  expected.table = `foo"foo`
  statement = 'insert into `foo"foo`'
  found = parseSql(statement)
  match(found, expected)
})

test('handles fully qualified names', () => {
  const expected = { operation: 'insert', collection: 'myDb.foo', table: 'foo', database: 'myDb' }

  let statement = 'insert into `myDb`.`foo` (col1)'
  let found = parseSql(statement)
  match(found, expected)

  statement = `insert into 'myDb'.'foo' (col1)`
  found = parseSql(statement)
  match(found, expected)

  statement = `insert into "myDb"."foo" (col1)`
  found = parseSql(statement)
  match(found, expected)
})

test('handles leading CTE', () => {
  let statement = `with cte1 as (
      select
        linking_col
      from
        linking_table
    )
    select
      foo_col
    from
      foo_table a
      join cte1 linking_col
    where
      a.bar_col = 'bar'`
  let found = parseSql(statement)
  match(found, {
    operation: 'select',
    collection: 'foo_table',
    table: 'foo_table',
    database: undefined
  })

  statement = `with cte1 as (select * from foo) update bar set bar.a = cte1.a`
  found = parseSql(statement)
  match(found, {
    operation: 'update',
    collection: 'bar',
    table: 'bar',
    database: undefined
  })
})

test('maps `SELECT ? + ? AS solution` to "unknown" collection', () => {
  const statement = 'SELECT ? + ? AS solution'
  const found = parseSql(statement)
  match(found, {
    operation: 'select',
    collection: 'unknown',
    table: 'unknown'
  })
})

test('handles odd characters attached to table names', () => {
  const expected = { operation: 'select', collection: 'unit-test', table: 'unit-test' }

  let statement = 'select test from unit-test;'
  let found = parseSql(statement)
  match(found, expected)

  expected.collection = 'schema.unit-test'
  statement = 'select test from schema.unit-test;'
  found = parseSql(statement)
  match(found, expected)
})

test('handles subqueries in place of table identifiers', () => {
  const expected = { operation: 'select', collection: 'foo', table: 'foo' }
  const statement = 'select * from (select foo from foo) where bar = "baz"'
  const found = parseSql(statement)
  match(found, expected)
})
