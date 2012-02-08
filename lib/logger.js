var winston = require('winston');

var logger = new (winston.Logger)({
        transports: [
//            new (winston.transports.Console)(),
            new (winston.transports.File)({ filename: 'newrelic_agent.log', json: false })
        ]
//        exceptionHandlers: [
//          new winston.transports.File({ filename: 'newrelic_agent.log' })
//        ]
      });
	  
logger.logToConsole = function() {
	try {
		this.add(winston.transports.Console);
	} catch (e) {} // may already be added in unit tests
}

exports.getLogger = function() {
    return logger;
}