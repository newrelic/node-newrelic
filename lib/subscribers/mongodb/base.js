/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const DbSubscriber = require('../db')
const { MONGODB } = require('../../metrics/names')

// Marks a function as already wrapped so a prototype method shared across
// subclasses (e.g. AbstractCursor.prototype.next) is only wrapped once.
const WRAPPED = Symbol('nrMongoWrapped')

/**
 * Base subscriber for the MongoDB driver. Rather than instrumenting every
 * Collection/Cursor/Db method individually (which forces the code transformer
 * to traverse each driver file once per method), we hook a single class
 * constructor and wrap the relevant prototype methods once, at runtime.
 *
 * Subclasses set `this.methods` (the method names to wrap) and implement
 * `buildSegment` (segment name + recorder + attributes for a given call).
 *
 * @property {string[]} methods Method names to wrap on the hooked class.
 */
class MongoSubscriber extends DbSubscriber {
  constructor({ agent, logger, channelName, packageName = 'mongodb' }) {
    super({ agent, logger, channelName, packageName, system: MONGODB.PREFIX })
    // The constructor hook fires on the `end` event of the class constructor.
    this.events = ['end']
    // Construction routinely happens outside a transaction; we still need to
    // set up method wrapping, so do not gate the constructor hook on an
    // active transaction. The per-method `instrument` does its own tx check.
    this.requireActiveTx = false
    // Prevent internal driver operations (e.g. cursor.next inside findOne)
    // from creating nested child segments under the recorded operation.
    this.opaque = true
    // Tracks prototypes whose methods have already been wrapped so the work is
    // done once per (sub)class rather than on every object construction.
    this._wrappedProtos = new WeakSet()
    // Tracks `{ proto, name, orig }` for each wrapped method so they can be
    // restored when the subscriber is disabled (see `disable`).
    this._wrapped = []
    this.methods = []
  }

  /**
   * Fires when an instance of the hooked class is constructed. Wraps the
   * target prototype methods once and creates no segment.
   *
   * @param {object} data Event data from the tracing channel.
   * @param {object} data.self The constructed instance.
   * @returns {void}
   */
  end(data) {
    const proto = Object.getPrototypeOf(data?.self ?? {})
    if (!proto || this._wrappedProtos.has(proto)) {
      return
    }
    this._wrappedProtos.add(proto)
    this.wrapMethods(data.self)
  }

  /**
   * Wraps each method in `this.methods` on the prototype that owns it. Walking
   * the prototype chain (rather than the instance) means a method is wrapped
   * once on its defining prototype and shared by every subclass instance.
   *
   * @param {object} instance A constructed driver instance.
   * @returns {void}
   */
  wrapMethods(instance) {
    const self = this
    for (const name of this.methods) {
      let proto = Object.getPrototypeOf(instance)
      while (proto && !Object.prototype.hasOwnProperty.call(proto, name)) {
        proto = Object.getPrototypeOf(proto)
      }

      const descriptor = proto && Object.getOwnPropertyDescriptor(proto, name)
      if (!descriptor || typeof descriptor.value !== 'function' || descriptor.get) {
        continue
      }

      const orig = descriptor.value
      if (orig[WRAPPED]) {
        continue
      }

      function nrWrapped(...args) {
        return self.instrument({ mongoObject: this, operation: name, orig, thisArg: this, args })
      }
      Object.defineProperty(nrWrapped, 'length', { value: orig.length, configurable: true })
      Object.defineProperty(nrWrapped, 'name', { value: orig.name, configurable: true })
      nrWrapped[WRAPPED] = true

      if (descriptor.writable) {
        proto[name] = nrWrapped
      } else if (descriptor.configurable) {
        Object.defineProperty(proto, name, { ...descriptor, value: nrWrapped })
      } else {
        continue
      }
      this._wrapped.push({ proto, name, orig, descriptor })
    }
  }

  /**
   * Restores the original prototype methods when the subscriber is disabled
   * (e.g. on agent shutdown). Without this, the manually-installed wrappers
   * would persist on the shared driver prototypes bound to a stale agent —
   * which breaks instrumentation when a new agent is created in the same
   * process (notably ESM tests, where the module cache cannot be cleared).
   *
   * @returns {void}
   */
  disable() {
    for (const { proto, name, orig, descriptor } of this._wrapped) {
      if (descriptor.writable) {
        proto[name] = orig
      } else {
        Object.defineProperty(proto, name, descriptor)
      }
    }
    this._wrapped = []
    this._wrappedProtos = new WeakSet()
    super.disable()
  }

  /**
   * Call-time tracing for a wrapped method. Resolves host/database/collection
   * from the live object so there is no cross-talk between instances, creates
   * the segment, and runs the original function within its context.
   *
   * @param {object} params Parameters.
   * @param {object} params.mongoObject The driver object the method was invoked on.
   * @param {string} params.operation The wrapped method name.
   * @param {Function} params.orig The original (unwrapped) method.
   * @param {object} params.thisArg The `this` binding for the original method.
   * @param {Array} params.args The call arguments.
   * @returns {*} Whatever the original method returns.
   */
  instrument({ mongoObject, operation, orig, thisArg, args }) {
    const tracer = this.agent.tracer
    const ctx = tracer.getContext()
    const parent = ctx?.segment

    if (!ctx?.transaction?.isActive() || this.shouldCreateSegment(parent) === false) {
      return orig.apply(thisArg, args)
    }

    const { name, recorder, parameters } = this.buildSegment(operation, mongoObject)
    const segment = tracer.createSegment({ name, parent, recorder, transaction: ctx.transaction })

    if (!segment || segment === parent) {
      return orig.apply(thisArg, args)
    }

    segment.opaque = this.opaque
    segment.shimId = this.packageName
    // `parameters` is consumed synchronously by `addAttributes` before the
    // original function runs, so reusing the instance property is safe.
    this.parameters = parameters
    this.addAttributes(segment)
    const newCtx = ctx.enterSegment({ segment })
    return tracer.runInContext({ handler: orig, context: newCtx, full: true, thisArg, args })
  }

  /**
   * Builds the segment name, metrics recorder, and datastore attributes for a
   * single instrumented call. Must be implemented by subclasses to return an
   * object of the shape `{ name, recorder, parameters }`.
   *
   * @param {string} operation The wrapped method name.
   * @param {object} mongoObject The driver object the method was invoked on.
   */
  buildSegment(operation, mongoObject) {
    throw new Error('buildSegment must be implemented by a subclass')
  }
}

module.exports = MongoSubscriber
