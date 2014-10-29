'use strict'

var path = require('path')
    , logger = require('../logger').child({component: 'oracle'})
    , shimmer = require('../shimmer')
    , parseSql = require('../db/parse-sql')
    , ORACLE = require('../metrics/names').ORACLE


function addSegment(tracer, sql) {
    var ps = parseSql(ORACLE.PREFIX, sql)
    var segmentName = ORACLE.STATEMENT + ps.model + '/' + ps.operation
    logger.trace({parsed: ps}, 'capturing oracle')

    return tracer.addSegment(segmentName, ps.recordMetrics.bind(ps))
}

module.exports = function initialize(agent, oracle) {
    var tracer = agent.tracer

    shimmer.wrapMethod(oracle, 'Oracle', 'connect', function cb_wrapMethod(connect) {
        return tracer.segmentProxy(function cb_segmentProxy() {
            var cb = arguments[1]
            connect.call(this, arguments[0], function (err, connection) {
                shimmer.wrapMethod(connection, 'Oracle', 'execute', function cb_wrapMethod(execute) {
                    return tracer.segmentProxy(function cb_segmentProxy() {

                        if (!tracer.getTransaction() || arguments.length < 1) {
                            logger.trace('not tracing because outside a transaction in oracle')
                            return execute.apply(this, arguments)
                        }

                        var transaction = tracer.getTransaction()
                            , segment = addSegment(tracer, arguments[0])
                            , args = tracer.slice(arguments)
                            , position = args.length - 1
                            , last = args[position]

                        var end = function (err, response) {
                            segment.end()
                            logger.trace("oracle command trace segment ended by event for transaction %s.",
                                transaction.id)
                            return last(err, response)
                        }

                        end = tracer.callbackProxy(end)

                        logger.trace("Adding oracle command trace segment transaction %s.",
                            transaction.id)

                        return execute.call(this, arguments[0], arguments[1], end)
                    })
                })
                cb(null, connection)
            })
        })
    })
}

