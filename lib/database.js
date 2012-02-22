
var logger = require('./logger').getLogger();
COMMENT_PATTERN = /\/\\*.*?\\*\//;

function StatementMatcher(operation, regexp) {
    this.operation = operation;
    var operationRegexp = new RegExp("^\\s*" + operation,"ig");
    this.getParsedStatement = function(sql) {
        operationRegexp.lastIndex = 0;
        regexp.lastIndex = 0;
        var match = operationRegexp.test(sql);
        if (match) {
            var match = regexp.exec(sql);
            var model = match ? match[1] : 'unknown';
            return new ParsedStatement(this.operation, model);
        }
    };
}

OPERATIONS = [new StatementMatcher('select', /^\s*select.*?\sfrom[\s\[]+([^\]\s,)(;]*).*/gi),
            new StatementMatcher('update', /^\s*update\s+([^\s,;]*).*/gi),
            new StatementMatcher('insert', /^\s*insert(?:\s+ignore)?\s+into\s+([^\s(,;]*).*/gi),
            new StatementMatcher('delete', /^\s*delete\s+from\s+([^\s,(;]*).*/gi)];

function recordDatabaseMetrics(tracer, unscopedStats, scopedStats, model, operation) {
    var metricName = 'Database/' + model + '/' + operation;
    scopedStats.getStats(metricName).recordValueInMillis(tracer.getDurationInMillis());
    unscopedStats.getStats(metricName).recordValueInMillis(tracer.getDurationInMillis());
    unscopedStats.getStats("Database/" + operation).recordValueInMillis(tracer.getDurationInMillis());
    unscopedStats.getStats("Database/all").recordValueInMillis(tracer.getDurationInMillis());
    unscopedStats.getStats("Database/all" + (tracer.getTransaction().isWebTransaction() ? "Web" : "Other")).
            recordValueInMillis(tracer.getDurationInMillis());
}

function ParsedStatement(operation, model) {
    this.operation = operation;
    this.model = model;
    
    this.recordMetrics = function(tracer, unscopedStats, scopedStats) {
        recordDatabaseMetrics(tracer, unscopedStats, scopedStats, model, operation);
    };
}


var badStatement = new ParsedStatement('unknown', 'unknown');

function parseSql(sql) {    
    sql = sql.replace(COMMENT_PATTERN, '').trim();

    var parsedStatement = null;
    OPERATIONS.every(function(op) {
        var ps = op.getParsedStatement(sql);
        if (ps) {
            parsedStatement = ps;
            return false;
        }
        return true;
    });
    if (parsedStatement) {
        return parsedStatement;
    } else {
        logger.debug("Parse failure: " + sql);
        return badStatement;
    }
}

exports.ParsedStatement = ParsedStatement;
exports.parseSql = parseSql;