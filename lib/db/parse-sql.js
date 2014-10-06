'use strict'

var path             = require('path')
  , logger           = require('../logger')
                         .child({component : 'parse_sql'})
  , StatementMatcher = require('./statement-matcher')
  , ParsedStatement  = require('./parsed-statement')
  

var OPERATIONS      = [new StatementMatcher('select', /^\s*select.*?\sfrom[\s\[]+([^\]\s,)(;]*).*/gi),
                       new StatementMatcher('update', /^\s*update\s+([^\s,;]*).*/gi),
                       new StatementMatcher('insert', /^\s*insert(?:\s+ignore)?\s+into\s+([^\s(,;]*).*/gi),
                       new StatementMatcher('delete', /^\s*delete\s+from\s+([^\s,(;]*).*/gi)]
  , COMMENT_PATTERN = /\/\\*.*?\\*\//
  

module.exports = function parseSql(type, sql) {
  sql = sql.replace(COMMENT_PATTERN, '').trim()

  var parsedStatement
  OPERATIONS.every(function cb_every(op) {
    var ps = op.getParsedStatement(type, sql)
    if (ps) {
      parsedStatement = ps
      return false
    }
    else {
      return true
    }
  })

  if (parsedStatement) {
    return parsedStatement
  }
  else {
    return new ParsedStatement(type, 'other')
  }
}
