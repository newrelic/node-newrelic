'use strict'

const truncate = require('../util/byte-limit').truncate

const NAMES = require('../metrics/names')
const HTTP_LIBRARY = 'http'
const SPAN_KIND_ATTRIBUTE = 'client'
const CATEGORIES = {
  HTTP: 'http',
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
    this.transactionId = null
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

  static get HttpSpanEvent() {
    return HttpSpanEvent
  }

  /**
   * Constructs a `SpanEvent` from the given segment.
   *
   * The constructed span event will contain extra data depending on the
   * category of the segment.
   *
   * @param {TraceSegment}  segment         - The segment to turn into a span event.
   * @param {?string}       [parentId=null] - The ID of the segment's parent.
   *
   * @return {SpanEvent} The constructed event.
   */
  static fromSegment(segment, parentId) {
    let span = null
    if (HttpSpanEvent.testSegment(segment)) {
      span = new HttpSpanEvent(segment.parameters)
    } else if (DatastoreSpanEvent.testSegment(segment)) {
      span = new DatastoreSpanEvent(segment.parameters)
    } else {
      span = new SpanEvent()
    }

    const tx = segment.transaction

    span.traceId = tx.traceId || tx.id
    span.guid = segment.id
    span.parentId = parentId || null

    span.transactionId = tx.id
    span.sampled = tx.sampled
    span.priority = tx.priority
    span.name = segment.name

    if (tx.baseSegment === segment) {
      span['nr.entryPoint'] = true
    }

    // Timestamp in milliseconds, duration in seconds. Yay consistency!
    span.timestamp = segment.timer.start
    span.duration = segment.timer.getDurationInMillis() / 1000

    return span
  }

  toJSON() {
    const attrs = Object.create(null)
    for (let key in this) {
      if (this[key] != null) {
        attrs[key] = this[key]
      }
    }

    return [
      attrs,
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
class HttpSpanEvent extends SpanEvent {
  constructor(parameters) {
    super()

    this.category = CATEGORIES.HTTP
    this.component = parameters.library || HTTP_LIBRARY
    this['span.kind'] = SPAN_KIND_ATTRIBUTE
    if (parameters.url) {
      this['http.url'] = parameters.url
    }
    if (parameters.procedure) {
      this['http.method'] = parameters.procedure
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
    this['span.kind'] = SPAN_KIND_ATTRIBUTE
    if (parameters.product) {
      this.component = parameters.product
    }
    if (parameters.sql_obfuscated) {
      this['db.statement'] = _truncate(parameters.sql_obfuscated)
    } else if (parameters.sql) {
      this['db.statement'] = _truncate(parameters.sql)
    }
    if (parameters.database_name) {
      this['db.instance'] = parameters.database_name
    }
    if (parameters.host) {
      this['peer.hostname'] = parameters.host

      if (parameters.port_path_or_id) {
        this['peer.address'] = `${parameters.host}:${parameters.port_path_or_id}`
      }
    }
  }

  static testSegment(segment) {
    return segment.name.startsWith(NAMES.DB.PREFIX)
  }
}

function _truncate(val) {
  let truncated = truncate(val, 1997)
  if (truncated !== val) {
    truncated += '...'
  }
  return truncated
}

module.exports = SpanEvent
