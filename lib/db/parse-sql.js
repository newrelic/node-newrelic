"use strict";

var path            = require('path')
  , logger          = require(path.join(__dirname, '..', 'logger'))
  , ParsedStatement = require(path.join(__dirname, 'parsed-statement'))
  ;

function StatementMatcher(operation, regexp) {
  var operationRegexp = new RegExp("^\\s*" + operation,"ig");

  this.getParsedStatement = function (sql) {
    operationRegexp.lastIndex = 0;
    regexp.lastIndex = 0;

    var match = operationRegexp.test(sql);
    if (match) {
      match = regexp.exec(sql);
      var model = match ? match[1] : 'unknown';
      return new ParsedStatement(operation, model);
    }
  };
}

var OPERATIONS      = [new StatementMatcher('select', /^\s*select.*?\sfrom[\s\[]+([^\]\s,)(;]*).*/gi),
                       new StatementMatcher('update', /^\s*update\s+([^\s,;]*).*/gi),
                       new StatementMatcher('insert', /^\s*insert(?:\s+ignore)?\s+into\s+([^\s(,;]*).*/gi),
                       new StatementMatcher('delete', /^\s*delete\s+from\s+([^\s,(;]*).*/gi)]
  , BAD_STATEMENT   = new ParsedStatement('unknown', 'unknown')
  , COMMENT_PATTERN = /\/\\*.*?\\*\//
  ;

function parseSql(sql) {
  sql = sql.replace(COMMENT_PATTERN, '').trim();

  var parsedStatement = null;
  OPERATIONS.every(function (op) {
    var ps = op.getParsedStatement(sql);
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
    logger.debug("Parse failure: " + sql);
    return BAD_STATEMENT;
  }
}

module.exports = parseSql;
