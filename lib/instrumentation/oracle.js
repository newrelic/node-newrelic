'use strict'

var path = require('path')
    , logger = require('../logger').child({component: 'oracle'})
    , shimmer = require('../shimmer')
    , parseSql = require('../db/parse-sql')
    , ORACLE = require('../metrics/names').ORACLE

/**
 *
 * This instruments node-oracle's execute method.  It doesn't instrument the reader portion of their api.
 * Since there is no reader.close method, it is unclear how to end the segment.  It would make sense
 * to end it when the next row is null, signifying that the cursor has iterated all rows.
 * Other situations could occur, such as the client not iterating all of the rows,
 * which would end up in the segment never ending.
 *
 */


function addSegment(tracer, sql) {
    var ps = parseSql(ORACLE.PREFIX, sql)
    var segmentName = ORACLE.STATEMENT + ps.model + '/' + ps.operation
    logger.trace({parsed: ps}, 'capturing oracle')

    return tracer.addSegment(segmentName, ps.recordMetrics.bind(ps))
}


module.exports = function initialize(agent, oracle) {
    var tracer = agent.tracer

    function wrapExecute(execute) {
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
        });
    }

    shimmer.wrapMethod(oracle, 'Oracle', 'connect', function cb_wrapMethod(connect) {
        return tracer.segmentProxy(function cb_segmentProxy() {
            var cb = arguments[1]
            connect.call(this, arguments[0], function (err, connection) {
                shimmer.wrapMethod(connection, 'Oracle', 'execute', function cb_wrapMethod(execute) {
                    return wrapExecute(execute)
                })
                cb(null, connection)
            })
        })
    })

    shimmer.wrapMethod(oracle, 'Oracle', 'connectSync', function cb_wrapMethod(connectSync) {
        return tracer.segmentProxy(function cb_segmentProxy() {
            var connection = connectSync.call(this, arguments[0]);
            shimmer.wrapMethod(connection, 'Oracle', 'execute', function cb_wrapMethod(execute) {
                return wrapExecute(execute)
            })
            return connection;
        })
    })


}

