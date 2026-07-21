/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbSubscriber = require('../db.js')
const databaseRecorder = require('#agentlib/metrics/recorders/database.js')

/**
 * This class provides a baseline for the MongoDB instrumentations that
 * share a lot of common code when wrapping methods, but require some slight
 * variations in the collected data. Anything extending this class is
 * expected to leverage the {@link #wrapDatabaseMethod} method.
 */
module.exports = class WrapperSubscriber extends DbSubscriber {
  constructor(params) {
    super(params)

    this.events = ['end']
    // We set `opaque` to true because the library uses its own methods
    // internally, and we only care about the entry point. That is, if the
    // code is `.findOne('something')`, the  method will invoke `.next`
    // internally. We don't care to track `.next` with its own reported segment.
    // We only want to record the overall operation of `.findOne`.
    //
    // This is the case for all instrumentations that inherit from this class.
    // The details change around the methods, but the desired outcome
    // is the same.
    this.opaque = true

    // The database metrics recorder reads `this.type` to get the name of the
    // database system.
    this.type = this.system
  }

  /**
   * Creates a standard database operation wrapper for a method.
   * This method provides a common pattern for instrumenting database operations
   * with transaction validation, segment creation, and database recording.
   *
   * @param {object} instance The instance with the method to wrap.
   * @param {string} methodName The name of the method to wrap.
   * @param {object} callbacks Functions used to retrieve context specific
   * data.
   * @param {Function} callbacks.getSegmentName Each subscriber names its
   * segment slightly differently. This function should return the full
   * string representation for the segment name.
   * @param {Function} callbacks.getRecorderContext Each subscriber instruments
   * multiple methods that can be invoked during the evaluation of one
   * operation. As such, the instances cannot store details relevant to metrics
   * generation on the instance itself. Thus, we need a scoped context object
   * to provide to the metrics recorder function. This function is used to
   * get a copy of that scoped context object.
   * @param {Function} [callbacks.getSegmentAttributes] In most cases, the
   * `addAttributes` method on the base class can be used to get a copy of
   * attributes to add to the segment being recorded. But there are some cases
   * where the attributes need to be calculated within the scope of the
   * transaction and passed in to the `addAttributes` method. This function
   * is used to get a copy of the attributes object to provide to the
   * base method.
   * @param {Function} [callbacks.getParameters] Returns the `parameters`
   * object (`host`, `port_path_or_id`, `database_name`, `product`) to assign
   * to the subscriber prior to creating the segment. When provided, it is
   * invoked each time the wrapped method runs so that connection details are
   * resolved at operation time rather than when the `Db`/`Collection` handle
   * was constructed. This matters for `mongodb+srv://` clients, whose host
   * list is empty until `connect()` resolves the DNS SRV record after
   * construction. When omitted, the subscriber's existing `parameters` are
   * used unchanged.
   */
  wrapDatabaseMethod(instance, methodName, callbacks) {
    const self = this
    const orig = instance[methodName]
    const {
      getSegmentName,
      getRecorderContext,
      getSegmentAttributes = () => { return {} },
      getParameters = null
    } = callbacks

    instance[methodName] = function nrWrappedMethod(...args) {
      let ctx = self.agent.tracer.getContext()
      if (ctx.transaction == null || ctx.transaction.isActive() === false) {
        self.logger.debug(
          'Not recording function %s, not in a transaction',
          methodName
        )
        return orig.apply(instance, args)
      }

      self.logger.debug('Recording function %s', methodName)

      if (typeof getParameters === 'function') {
        self.parameters = getParameters()
      }

      ctx = self.createSegment({
        name: getSegmentName(methodName),
        recorder: function dbRecorder(segment, scope, transaction) {
          const recorderContext = getRecorderContext(methodName)
          return databaseRecorder.call(
            recorderContext,
            segment,
            scope,
            transaction
          )
        },
        attributes: getSegmentAttributes(methodName),
        ctx
      })

      return self.agent.tracer.runInContext({
        handler: orig,
        context: ctx,
        full: true,
        thisArg: instance,
        args
      })
    }
  }
}
