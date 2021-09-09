/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const logger = require('../../logger').child({ component: 'sql_query_parser' })
const StatementMatcher = require('../statement-matcher')
const stringify = require('json-stringify-safe')

const OPERATIONS = [
  new StatementMatcher(
    'select',
    /^[^\S]*?select\b[\s\S]+?\bfrom[\s\n\r\[\(]+([^\]\s\n\r,)(;]*)/gim
  ),
  new StatementMatcher('update', /^[^\S]*?update[^\S]+?([^\s\n\r,;]+)/gim),
  new StatementMatcher(
    'insert',
    /^[^\S]*?insert(?:[^\S]+ignore)?[^\S]+into[^\S]+([^\s\n\r(,;]+)/gim
  ),
  new StatementMatcher('delete', /^[^\S]*?delete[^\S]+?from[^\S]+([^\s\n\r,(;]+)/gim)
]
const COMMENT_PATTERN = /\/\\*.*?\\*\//g

// This must be called synchronously after the initial db call for backtraces to
// work correctly

module.exports = function parseSql(sql) {
  // Sometimes we get an object here from MySQL. We have been unable to
  // reproduce it, so we'll just log what that object is and return a statement
  // type of `other`.
  if (typeof sql === 'object' && sql.sql !== undefined) {
    sql = sql.sql
  }
  if (typeof sql !== 'string') {
    if (logger.traceEnabled()) {
      try {
        logger.trace('parseSQL got an a non-string sql that looks like: %s', stringify(sql))
      } catch (err) {
        logger.debug(err, 'Unabler to stringify SQL')
      }
    }
    return {
      operation: 'other',
      collection: null,
      query: ''
    }
  }

  sql = sql.replace(COMMENT_PATTERN, '').trim()

  let parsedStatement

  for (let i = 0, l = OPERATIONS.length; i < l; i++) {
    parsedStatement = OPERATIONS[i].getParsedStatement(sql)
    if (parsedStatement) {
      break
    }
  }

  if (parsedStatement) {
    return parsedStatement
  }

  return {
    operation: 'other',
    collection: null,
    query: sql
  }
}
