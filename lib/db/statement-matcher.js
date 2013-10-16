'use strict';

var path            = require('path')
  , ParsedStatement = require(path.join(__dirname, 'parsed-statement'))
  ;

function StatementMatcher(operation, operationPattern) {
  this.operation        = operation;
  this.operationPattern = operationPattern;
}

StatementMatcher.prototype.getParsedStatement = function (type, sql) {
  this.operationPattern.lastIndex = 0;

  var match = new RegExp("^\\s*" + this.operation, "ig").test(sql);
  if (match) {
    var queryMatch = this.operationPattern.exec(sql);
    var model = queryMatch ? queryMatch[1] : 'unknown';

    return new ParsedStatement(type, this.operation, model);
  }
};

module.exports = StatementMatcher;
