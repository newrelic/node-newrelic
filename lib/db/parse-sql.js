'use strict';

var path             = require('path')
  , logger           = require(path.join(__dirname, '..', 'logger'))
                         .child({component : 'parse_sql'})
  , StatementMatcher = require(path.join(__dirname, 'statement-matcher'))
  , ParsedStatement  = require(path.join(__dirname, 'parsed-statement'))
  ;

var OPERATIONS      = [new StatementMatcher('select', /^\s*select.*?\sfrom[\s\[]+([^\]\s,)(;]*).*/gi),
                       new StatementMatcher('update', /^\s*update\s+([^\s,;]*).*/gi),
                       new StatementMatcher('insert', /^\s*insert(?:\s+ignore)?\s+into\s+([^\s(,;]*).*/gi),
                       new StatementMatcher('delete', /^\s*delete\s+from\s+([^\s,(;]*).*/gi)]
  , BAD_STATEMENT   = new ParsedStatement('unknown', 'unknown', 'unknown')
  , COMMENT_PATTERN = /\/\\*.*?\\*\//
  ;

module.exports = function parseSql(type, sql) {
  sql = sql.replace(COMMENT_PATTERN, '').trim();

  var parsedStatement;
  OPERATIONS.every(function (op) {
    var ps = op.getParsedStatement(type, sql);
    if (ps) {
      parsedStatement = ps;
      return false;
    }
    else {
      return true;
    }
  });

  if (parsedStatement) {
    return parsedStatement;
  }
  else {
    logger.debug("Unable to extract operation and model from [%s], ignoring query.", sql);
    return BAD_STATEMENT;
  }
};
