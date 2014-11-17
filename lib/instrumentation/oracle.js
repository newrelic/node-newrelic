'use strict'

var logger = require('../logger').child({component: 'oracle'})
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

    function wrapExecute(connection) {
        shimmer.wrapMethod(connection, 'Oracle', 'execute', function cb_wrapMethod(execute) {
            return tracer.segmentProxy(function cb_segmentProxy(sql, params, cb) {
                if (!tracer.getTransaction() || arguments.length < 1) {
                    logger.trace('not tracing because outside a transaction in oracle')
                    return execute.apply(this, arguments)
                }

                var transaction = tracer.getTransaction()
                    , segment = addSegment(tracer, sql)

                var end = function (err, response) {
                    segment.end()
                    logger.trace("oracle command trace segment ended by event for transaction %s.",
                        transaction.id)
                    return cb(err, response)
                }

                end = tracer.callbackProxy(end)

                logger.trace("Adding oracle command trace segment transaction %s.",
                    transaction.id)
                return execute.call(this, sql, params, end)
            })
        })
    }

    function wrapReader(connection) {
        shimmer.wrapMethod(connection, 'Oracle', 'reader', function cb_wrapMethod(createReader) {
            return tracer.segmentProxy(function cb_segmentProxy(sql) {

                var reader = createReader.apply(this, arguments)
                if (!tracer.getTransaction() || arguments.length < 1) {
                    return reader
                }

                var transaction = tracer.getTransaction()
                    , segment = addSegment(tracer, sql)

                shimmer.wrapMethod(reader, 'Oracle', 'nextRow', function cb_wrapMethod(nextRow) {
                    return tracer.segmentProxy(function cb_segmentProxy(cb) {
                        if (!tracer.getTransaction() || arguments.length < 1) {
                            logger.trace('not tracing because outside a transaction in oracle')
                            return nextRow.apply(this, arguments)
                        }

                        var wrapped_cb = function (err, row) {
                            if (err) {
                                return cb(err)
                            }
                            if (!row) {
                                segment.end()
                                logger.trace("oracle command trace segment ended by event for transaction %s.",
                                    transaction.id)
                                return cb(err, row)
                            } else {
                                segment.touch()
                                return cb(err, row)
                            }
                        }

                        wrapped_cb = tracer.callbackProxy(wrapped_cb)

                        logger.trace("Adding oracle command trace segment transaction %s.",
                            transaction.id)
                        return nextRow.call(this, wrapped_cb)

                    })
                })

                shimmer.wrapMethod(reader, 'Oracle', 'nextRows', function cb_wrapMethod(nextRows) {
                    return tracer.segmentProxy(function cb_segmentProxy(count, cb) {
                        if (!tracer.getTransaction() || arguments.length < 1) {
                            logger.trace('not tracing because outside a transaction in oracle')
                            return nextRows.apply(this, arguments)
                        }

                        var wrapped_cb = function (err, rows) {
                            if (err) {
                                return cb(err)
                            }
                            if (!rows || !rows.length) {
                                segment.end()
                                logger.trace("oracle command trace segment ended by event for transaction %s.",
                                    transaction.id)
                                return cb(err, rows)
                            } else {
                                segment.touch()
                                return cb(err, rows)
                            }
                        }

                        wrapped_cb = tracer.callbackProxy(wrapped_cb)

                        logger.trace("Adding oracle command trace segment transaction %s.",
                            transaction.id)
                        return nextRows.call(this, wrapped_cb)

                    })
                })

                return reader

            })
        })
    }

    function wrapPrepare(connection) {
        shimmer.wrapMethod(connection, 'Oracle', 'prepare', function cb_wrapMethod(prepare) {

            return tracer.segmentProxy(function cb_segmentProxy(sql) {
                var prepared = prepare.call(this, sql)
                if (!tracer.getTransaction() || arguments.length < 1) {
                    logger.trace('not tracing because outside a transaction in oracle')
                    return prepare.call(this, sql)
                }

                var transaction = tracer.getTransaction()
                    , segment = addSegment(tracer, sql)

                shimmer.wrapMethod(prepared, 'Oracle', 'execute', function cb_wrapMethod(execute) {

                    return tracer.segmentProxy(function cb_segmentProxy(params, cb) {
                        if (!tracer.getTransaction() || arguments.length < 1) {
                            logger.trace('not tracing because outside a transaction in oracle')
                            return execute.call(this, params, cb)
                        }

                        var wrapped_cb = function (err, response) {
                            segment.end()
                            logger.trace("oracle command trace segment ended by event for transaction %s.",
                                transaction.id)
                            return cb(err, response)
                        }

                        wrapped_cb = tracer.callbackProxy(wrapped_cb)

                        return execute.call(this, params, wrapped_cb)
                    })
                })

                logger.trace("Adding oracle command trace segment transaction %s.",
                    transaction.id)
                return prepared
            })
        })
    }

    shimmer.wrapMethod(oracle, 'Oracle', 'connect', function cb_wrapMethod(connect) {
        return tracer.segmentProxy(function cb_segmentProxy(connectData, cb) {

            var end = function (err, connection) {
                if (err) {
                    return cb(err)
                }
                wrapExecute(connection)
                wrapReader(connection)
                wrapPrepare(connection)
                cb(null, connection)
            }

            end = tracer.callbackProxy(end)
            connect.call(this, connectData, end)
        })
    })

    shimmer.wrapMethod(oracle, 'Oracle', 'connectSync', function cb_wrapMethod(connectSync) {
        return tracer.segmentProxy(function cb_segmentProxy(connectionData) {
            var connection = connectSync.call(this, connectionData)
            wrapExecute(connection)
            wrapReader(connection)
            wrapPrepare(connection)
            return connection
        })
    })


}

