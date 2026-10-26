/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbSubscriber = require('../db.js')
const { wrapMethods } = require('../wrap-method.js')
const databaseRecorder = require('#agentlib/metrics/recorders/database.js')

/**
 * This class provides a baseline for the MongoDB instrumentations that
 * share a lot of common code when wrapping methods, but require some slight
 * variations in the collected data. Anything extending this class is
 * expected to leverage the {@link #wrapPrototypeMethods} method.
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
   * Wraps a set of methods on a driver class prototype so that every instance
   * of that class shares a single wrapper per method.
   *
   * The MongoDB orchestrion hooks fire on the constructor of each driver class
   * (`AbstractCursor`, `Collection`, `Db`, `BulkOperationBase`). Rather than
   * installing a fresh wrapper on every constructed instance — which allocates
   * a new closure set per operation on read-heavy workloads (see issue #4397) —
   * we wrap the prototype once. The underlying {@link wrapMethods} is
   * idempotent: subsequent constructions of the same class find the prototype
   * methods already wrapped and skip them.
   *
   * Because the wrapper is shared across instances, it cannot close over
   * per-instance data captured at construction time. Instead, the callbacks
   * receive the live instance (`this` at call time) and read the relevant
   * details (collection name, database name, connection host) off of it.
   *
   * @param {object} proto The driver class prototype to wrap.
   * @param {string[]} methodNames The names of the methods to wrap. Methods
   * absent on the prototype are skipped.
   * @param {object} callbacks Functions used to retrieve context specific data.
   * Each is invoked at operation time and receives the driver instance and the
   * method name.
   * @param {Function} callbacks.getSegmentName Returns the full string
   * representation for the segment name.
   * @param {Function} callbacks.getRecorderContext Returns the scoped context
   * object provided to the metrics recorder function.
   * @param {Function} [callbacks.getParameters] Returns the `parameters` object
   * (`host`, `port_path_or_id`, `database_name`, `product`) to assign to the
   * subscriber prior to creating the segment. Connection details are resolved
   * at operation time rather than at construction time, which matters for
   * `mongodb+srv://` clients whose host list is empty until `connect()`
   * resolves the DNS SRV record.
   * @param {Function} [callbacks.getSegmentAttributes] Returns attributes to
   * add to the segment that must be calculated within the scope of the
   * transaction. See {@link DbSubscriber#addAttributes}.
   */
  wrapPrototypeMethods(proto, methodNames, callbacks) {
    const self = this
    const {
      getSegmentName,
      getRecorderContext,
      getSegmentAttributes = () => { return {} },
      getParameters = null
    } = callbacks

    wrapMethods({
      module: proto,
      methodNames,
      logger: this.logger,
      wrapper(orig, methodName) {
        return function nrWrappedMethod(...args) {
          const instance = this
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
            self.parameters = getParameters(instance)
          }

          ctx = self.createSegment({
            name: getSegmentName(instance, methodName),
            recorder: function dbRecorder(segment, scope, transaction) {
              const recorderContext = getRecorderContext(instance, methodName)
              return databaseRecorder.call(
                recorderContext,
                segment,
                scope,
                transaction
              )
            },
            attributes: getSegmentAttributes(instance, methodName),
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
    })
  }
}
