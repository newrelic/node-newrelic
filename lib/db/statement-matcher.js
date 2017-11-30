'use strict'

function StatementMatcher(operation, operationPattern) {
  this.operation = operation
  this.matcher = new RegExp('^\\s*' + operation, 'ig')
  this.operationPattern = operationPattern
}

StatementMatcher.prototype.getParsedStatement = function getParsedStatement(sql) {
  this.operationPattern.lastIndex = 0
  this.matcher.lastIndex = 0

  if (this.matcher.test(sql)) {
    var queryMatch = this.operationPattern.exec(sql)
    var collection = queryMatch ? queryMatch[1] : 'unknown'

    return {
      operation: this.operation,
      collection: collection,
      query: sql
    }
  }

  return null
}

module.exports = StatementMatcher
