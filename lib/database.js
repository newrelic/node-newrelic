var logger = require('./logger');

var COMMENT_PATTERN = /\/\\*.*?\\*\//;

function recordDatabaseMetrics(tracer, unscopedStats, scopedStats, model, operation) {
  var metricName = 'Database/' + model + '/' + operation;
  scopedStats.byName(metricName).recordValueInMillis(tracer.getDurationInMillis());
  unscopedStats.byName(metricName).recordValueInMillis(tracer.getDurationInMillis());
  unscopedStats.byName("Database/" + operation).recordValueInMillis(tracer.getDurationInMillis());
  unscopedStats.byName("Database/all").recordValueInMillis(tracer.getDurationInMillis());
  unscopedStats.byName("Database/all" + (tracer.getTransaction().isWebTransaction() ? "Web" : "Other")).recordValueInMillis(tracer.getDurationInMillis());
}

function ParsedStatement(operation, model) {
  this.operation = operation;
  this.model = model;

  this.recordMetrics = function (tracer, unscopedStats, scopedStats) {
    recordDatabaseMetrics(tracer, unscopedStats, scopedStats, model, operation);
  };
}

function StatementMatcher(operation, regexp) {
  this.operation = operation;
  var operationRegexp = new RegExp("^\\s*" + operation,"ig");

  this.getParsedStatement = function (sql) {
    operationRegexp.lastIndex = 0;
    regexp.lastIndex = 0;

    var match = operationRegexp.test(sql);
    if (match) {
      match = regexp.exec(sql);
      var model = match ? match[1] : 'unknown';
      return new ParsedStatement(this.operation, model);
    }
  };
}

var OPERATIONS = [new StatementMatcher('select', /^\s*select.*?\sfrom[\s\[]+([^\]\s,)(;]*).*/gi),
                  new StatementMatcher('update', /^\s*update\s+([^\s,;]*).*/gi),
                  new StatementMatcher('insert', /^\s*insert(?:\s+ignore)?\s+into\s+([^\s(,;]*).*/gi),
                  new StatementMatcher('delete', /^\s*delete\s+from\s+([^\s,(;]*).*/gi)];

var BAD_STATEMENT = new ParsedStatement('unknown', 'unknown');

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

exports.ParsedStatement = ParsedStatement;
exports.parseSql = parseSql;
