/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const parseSql = require('../../../../../lib/db/query-parsers/sql')
const benchmark = require('../../../../lib/benchmark')
const suite = benchmark.createBenchmark({ name: 'parseSql', runs: 200_000 })

const tests = [
  {
    name: 'leading-multi-line-comment-single-line',
    fn: leadingMultiLineCommentSingleLine
  },
  {
    name: 'leading-multi-line-comment-multiple-lines',
    fn: leadingMultiLineCommentMultipleLines
  },
  {
    name: 'single-embedded-multi-line-comment',
    fn: singleEmbeddedMultiLineComment
  },
  {
    name: 'multiple-embedded-multi-line-comments',
    fn: multipleEmbeddedMultiLineComments
  },
  {
    name: 'select-statement',
    fn: selectStatement
  },
  {
    name: 'update-statement',
    fn: updateStatement
  },
  {
    name: 'delete-statement',
    fn: deleteStatement
  }
]

for (const test of tests) {
  suite.add(test)
}
suite.run()

function leadingMultiLineCommentSingleLine() {
  parseSql(`/* insert into bar some stuff */ insert into foo (col1)`)
}

function leadingMultiLineCommentMultipleLines() {
  parseSql(`/*insert into bar some stuff*/
    insert into foo (col1) values('bar')
  `)
}

function singleEmbeddedMultiLineComment() {
  parseSql(`insert /* insert into bar */ into foo`)
}

function multipleEmbeddedMultiLineComments() {
  parseSql(`insert /* comments! */ into /* insert into bar some stuff */ foo /* MOAR */ (col1)`)
}

function selectStatement() {
  parseSql(
    `with foobar (col1) as cte select * from foo as a join on cte using (col1) where a.bar = 'baz'`
  )
}

function updateStatement() {
  parseSql(`update foo set bar = 'baz' where col1 = 1`)
}

function deleteStatement() {
  parseSql(`delete from foo where bar = 'baz'`)
}
