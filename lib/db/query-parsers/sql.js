/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const defaultLogger = require('../../logger').child({ component: 'sql_query_parser' })
const stringify = require('json-stringify-safe')

/**
 * In a query like `select * from (select * from foo)`, extract the subquery
 * as the statement to retrieve the target identifier from.
 *
 * @type {RegExp}
 */
const selectSubquery = /from\s*?\((?<subquery>select.*?)\)\s*?/i

/**
 * Matches queries with leading common table expressions and assigns the
 * actual query to a match group named `query`.
 *
 * @type {RegExp}
 */
const cteMatcher = /^\s*?with[\w\W]*?\)\s*?(?<query>(?:insert|update|delete|select)[\w\W]*)/i

/**
 * Parses a SQL statement into the parts we want to report as metadata in
 * database transactions.
 *
 * @param {string} sql The statement to parse.
 * @param {object} [deps] A set of optional dependencies.
 * @param {object} [deps.logger] A logger instance.
 *
 * @returns {{query: string, collection: null|string, operation: string}} Parsed
 * metadata.
 */
module.exports = function parseSql(sql, { logger = defaultLogger } = {}) {
  // Sometimes we get an object here from MySQL. We have been unable to
  // reproduce it, so we'll just log what that object is and return a statement
  // type of `other`.
  if (typeof sql === 'object' && sql.sql !== undefined) {
    sql = sql.sql
  }
  if (typeof sql !== 'string') {
    if (logger.traceEnabled()) {
      try {
        logger.trace('parseSQL got a non-string sql that looks like: %s', stringify(sql))
      } catch (err) {
        logger.debug(err, 'Unable to stringify SQL')
      }
    }
    return {
      operation: 'other',
      collection: null,
      query: ''
    }
  }

  sql = removeMultiLineComments(sql).trim()
  sql = removeSingleLineComments(sql).trim()
  let result = {
    operation: 'other',
    collection: null,
    query: sql
  }

  // We want to remove the CTE _after_ assigning the statement to the result's
  // `query` property. Otherwise, the actual query will not be recorded in
  // the trace.
  sql = removeCte(sql)

  // After all of our normalizing of the overall query, if it doesn't actually
  // look like an SQL statement, short-circuit the parsing routine.
  if (looksLikeValidSql(sql) === false) {
    return result
  }

  const lines = sql.split('\n')
  result = { ...result, ...parseLines(lines) }
  result.query = sql.trim()

  return result
}

/**
 * Iterates the lines of an SQL statement, reducing them to the relevant lines,
 * and returns the metadata found within.
 *
 * We do not inline this in `parseSql` because doing so will violate a
 * code complexity linting rule.
 *
 * @param {string[]} lines Set of SQL statement lines.
 *
 * @returns {{collection: null, operation: string}} SQL statement metadata.
 */
function parseLines(lines) {
  let result = {
    operation: 'other',
    collection: null
  }

  parser: for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].toLowerCase().trim()
    switch (true) {
      case line.startsWith('select'): {
        const statement = lines.slice(i).join(' ')
        result.operation = 'select'
        result = { ...result, ...parseStatement(statement, 'select') }
        break parser
      }

      case line.startsWith('update'): {
        const statement = lines.slice(i).join(' ')
        result.operation = 'update'
        result = { ...result, ...parseStatement(statement, 'update') }
        break parser
      }

      case line.startsWith('insert'): {
        const statement = lines.slice(i).join(' ')
        result.operation = 'insert'
        result = { ...result, ...parseStatement(statement, 'insert') }
        break parser
      }

      case line.startsWith('delete'): {
        const statement = lines.slice(i).join(' ')
        result.operation = 'delete'
        result = { ...result, ...parseStatement(statement, 'delete') }
        break parser
      }
    }
  }

  return result
}

/**
 * Iterates through the provided string and removes all multi-line comments
 * found therein.
 *
 * @param {string} input The string to parse.
 *
 * @returns {string} Cleaned up string.
 */
function removeMultiLineComments(input) {
  const startPos = input.indexOf('/*')
  if (startPos === -1) {
    return input
  }

  const endPos = input.indexOf('*/', startPos + 2)
  const part1 = input.slice(0, startPos).trim()
  const part2 = input.slice(endPos + 2).trim()
  return removeMultiLineComments(`${part1} ${part2}`)
}

/**
 * Removes all single line, and trailing, comments from the input query.
 * These are comments that start with `--` or `#`.
 *
 * @param {string} input The query that might contain comments.
 * @returns {string} The query without any comments.
 */
function removeSingleLineComments(input) {
  const resultLines = []
  const lines = input.split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i]
    if (/^(--|#)/.test(line) === true) {
      continue
    }
    let pos = line.indexOf(' --')
    if (pos > -1) {
      line = line.slice(0, pos)
      resultLines.push(line)
      continue
    }
    pos = line.indexOf(' #')
    if (pos > -1) {
      line = line.slice(0, pos)
      resultLines.push(line)
      continue
    }

    resultLines.push(line)
  }
  return resultLines.join('\n')
}

/**
 * Removes any leading common table expression (CTE) from the query and returns
 * the query that targets the CTE. The metadata we are interested in, is not
 * contained in the CTE, but in the query targeting the CTE.
 *
 * @param {string} statement The SQL statement that might have a CTE.
 * @returns {string} The SQL statement without a leading CTE.
 */
function removeCte(statement) {
  const matches = cteMatcher.exec(statement)
  if (matches === null) {
    return statement
  }
  return matches.groups.query
}

/**
 * Tests the start of the statement to determine if it looks like a valid
 * SQL statement.
 *
 * @param {string} sql SQL statement with any comments stripped.
 *
 * @returns {boolean} True if the statement looks good. Otherwise, false.
 */
function looksLikeValidSql(sql) {
  return /^\s*?(?:with|select|insert|update|delete)/i.test(sql.toLowerCase())
}

/**
 * Extracts the collection, database, and table information from an SQL
 * statement.
 *
 * @param {string} statement The SQL statement to parse.
 * @param {string} [kind] The type of SQL statement being parsed. This
 * dictates how the algorithm will determine where the desired fields are.
 * Valid values are: `insert`, `delete`, `select`, and `update`.
 *
 * @returns {{database: string, collection, table}} The found information.
 */
function parseStatement(statement, kind = 'insert') {
  let splitter
  switch (kind) {
    case 'insert': {
      splitter = /\s*?\binto\b\s*?/i
      break
    }

    case 'delete': {
      splitter = /\s*?\bfrom\b\s*?/i
      break
    }

    case 'select': {
      const subqueryMatch = selectSubquery.exec(statement)
      if (subqueryMatch !== null) {
        statement = subqueryMatch.groups.subquery
      }

      if (/\bfrom\b/i.test(statement) === false) {
        // Statement does not specify a table. We don't need further processing.
        // E.g., we have a statement like `select 1 + 1 as added`.
        return { collection: 'unknown', table: 'unknown' }
      }

      splitter = /\s*?\bfrom\b\s*?/i
      break
    }

    case 'update': {
      splitter = /\s*?\bupdate\b\s*?/i
      break
    }
  }

  const targetIdentifier = statement.split(splitter).pop().trim().split(/\s/).shift()
  return parseTableIdentifier(targetIdentifier)
}

function parseTableIdentifier(identifier) {
  const leadingChars = /^[`'"]/
  const trailingChars = /[`'"]$/
  let collection
  let database
  let table

  const separatorPos = identifier.indexOf('.')
  if (separatorPos > 0) {
    const parts = identifier.split('.', 2)
    database = parts[0]
    table = parts[1]
  } else {
    table = identifier.replace(leadingChars, '').replace(trailingChars, '')
    table = normalizeTableName(identifier)
  }

  if (table !== undefined) {
    table = table.replace(leadingChars, '').replace(trailingChars, '')
    table = normalizeTableName(table)
  }
  if (database !== undefined) {
    database = database.replace(leadingChars, '').replace(trailingChars, '')
    collection = `${database}.${table}`
  }
  if (collection === undefined) {
    collection = table
  }

  return { collection, database, table }
}

/**
 * Our cross-application tests have tests that do not match any known SQL
 * engine's valid syntax for table names. But we need to support them, so this
 * function will inspect table names and try to return the correct thing.
 *
 * @param {string} tableIdentifier Something that _should_ represent a table
 * name.
 *
 * @returns {string} The normalized table name.
 */
function normalizeTableName(tableIdentifier) {
  // Some of our tests add non-standard characters to table names and expects
  // they will be stripped.
  tableIdentifier = tableIdentifier.replace(/[;]/g, '')

  if (tableIdentifier[0] === '(') {
    // We might have a subquery. If there is a single word between the
    // parentheticals, we return it as the table name (even though this is not
    // valid SQL). Otherwise, we return a special value.

    const parts = tableIdentifier.replace(/[()]/g, '').split(/\s/)
    if (parts.length === 1) {
      return parts[0]
    }
  }

  const parenPos = tableIdentifier.indexOf('(')
  if (parenPos > 0) {
    // We seem to accept `into foo(x,y)` as a valid table name, where we
    // decide that "foo" is the actual table name.
    return tableIdentifier.slice(0, parenPos)
  }

  const commaPos = tableIdentifier.indexOf(',')
  if (commaPos > -1) {
    // For some reason, we accept `from foo,bar` and decide that "foo" is
    // the actual table name.
    return tableIdentifier.slice(0, commaPos)
  }

  return tableIdentifier
}
