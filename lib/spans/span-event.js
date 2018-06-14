'use strict'

const NAMES = require('../metrics/names')
const EXTERNAL_LIBRARY = 'http'
const CATEGORIES = {
  EXTERNAL: 'external',
  DATASTORE: 'datastore',
  GENERIC: 'generic'
}
const EMPTY_USER_ATTRS = Object.freeze(Object.create(null))
const EMPTY_AGENT_ATTRS = Object.freeze(Object.create(null))

/**
 * General span event class.
 *
 * Do not construct directly, instead use one of the static `from*` methods such
 * as `SpanEvent.fromSegment`.
 *
 * @private
 * @class
 */
class SpanEvent {
  constructor() {
    this.type = 'Span'
    this.traceId = null
    this.guid = null
    this.parentId = null
    this.grandparentId = null
    this.appLocalRootId = null
    this.sampled = null
    this.priority = null
    this.name = null
    this.category = CATEGORIES.GENERIC

    // Timestamp in milliseconds, duration in seconds. Yay consistency!
    this.timestamp = null
    this.duration = null
  }

  static get CATEGORIES() {
    return CATEGORIES
  }

  static get DatastoreSpanEvent() {
    return DatastoreSpanEvent
  }

  static get ExternalSpanEvent() {
    return ExternalSpanEvent
  }

  /**
   * Constructs a `SpanEvent` from the given segment.
   *
   * The constructed span event will contain extra data depending on the
   * category of the segment.
   *
   * @param {TraceSegment} segment - The segment to turn into a span event.
   *
   * @return {SpanEvent} The constructed event.
   */
  static fromSegment(segment, parentId, grandparentId) {
    let span = null
    if (ExternalSpanEvent.testSegment(segment)) {
      span = new ExternalSpanEvent(segment.parameters)
    } else if (DatastoreSpanEvent.testSegment(segment)) {
      span = new DatastoreSpanEvent(segment.parameters)
    } else {
      span = new SpanEvent()
    }

    const tx = segment.transaction

    span.traceId = tx.traceId || tx.id
    span.guid = segment.id
    span.parentId = parentId || null
    span.grandparentId = grandparentId || null
    span.appLocalRootId = tx.id
    span.sampled = tx.sampled
    span.priority = tx.priority
    span.name = segment.name

    // Timestamp in milliseconds, duration in seconds. Yay consistency!
    span.timestamp = segment.timer.start
    span.duration = segment.timer.getDurationInMillis() / 1000

    return span
  }

  toJSON() {
    return [
      Object.assign(Object.create(null), this),
      EMPTY_USER_ATTRS,
      EMPTY_AGENT_ATTRS
    ]
  }
}

/**
 * Span event class for external requests.
 *
 * @private
 * @class
 */
class ExternalSpanEvent extends SpanEvent {
  constructor(parameters) {
    super()

    this.category = CATEGORIES.EXTERNAL
    this.externalLibrary = parameters.library || EXTERNAL_LIBRARY
    if (parameters.url) {
      this.externalUri = parameters.url // Some day URI and URL will be consistent...
    }
    if (parameters.procedure) {
      this.externalProcedure = parameters.procedure
    }
  }

  static testSegment(segment) {
    return segment.name.startsWith(NAMES.EXTERNAL.PREFIX)
  }
}

/**
 * Span event class for datastore operations and queries.
 *
 * @private
 * @class.
 */
class DatastoreSpanEvent extends SpanEvent {
  constructor(parameters) {
    super()

    this.category = CATEGORIES.DATASTORE
    if (parameters.product) {
      this.datastoreProduct = parameters.product
    }
    if (parameters.collection) {
      this.datastoreCollection = parameters.collection
    }
    if (parameters.operation) {
      this.datastoreOperation = parameters.operation
    }
    if (parameters.host) {
      this.datastoreHost = parameters.host
    }
    if (parameters.port_path_or_id) {
      this.datastorePortPathOrId = parameters.port_path_or_id
    }
    if (parameters.database_name) {
      this.datastoreName = parameters.database_name
    }
  }

  static testSegment(segment) {
    return segment.name.startsWith(NAMES.DB.PREFIX)
  }
}

module.exports = SpanEvent
