'use strict'

function StatementMatcher(operation, operationPattern) {
  this.operation = operation
  this.operationPattern = operationPattern
}

StatementMatcher.prototype.getParsedStatement = function getParsedStatement(sql) {
  this.operationPattern.lastIndex = 0

  var match = new RegExp("^\\s*" + this.operation, "ig").test(sql)
  if (match) {
    var queryMatch = this.operationPattern.exec(sql)
    var model = queryMatch ? queryMatch[1] : 'unknown'

    return {
      operation: this.operation,
      model: model,
      query: sql
    }
  }
}

module.exports = StatementMatcher
