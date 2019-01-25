'use strict'

const {truncate} = require('../util/byte-limit')
const Attributes = require('../attributes')

const {DESTINATIONS} = require('../config/attribute-filter')
const NAMES = require('../metrics/names')
const HTTP_LIBRARY = 'http'
const SPAN_KIND_ATTRIBUTE = 'client'
const CATEGORIES = {
  HTTP: 'http',
  DATASTORE: 'datastore',
  GENERIC: 'generic'
}
const EMPTY_USER_ATTRS = Object.freeze(Object.create(null))

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
  constructor(segment) {
    let filter = null
    if (segment && segment.transaction) {
      filter = segment.transaction.agent.config.attributeFilter
    }
    this.attributes = new Attributes({filter})
    this.intrinsics = {
      type: 'Span',
      traceId: null,
      guid: null,
      parentId: null,
      transactionId: null,
      sampled: null,
      priority: null,
      name: null,
      category: CATEGORIES.GENERIC,
      timestamp: null,
      duration: null
    }
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
  static fromSegment(segment, parentId = null) {
    let span = null
    if (HttpSpanEvent.testSegment(segment)) {
      span = new HttpSpanEvent(segment)
    } else if (DatastoreSpanEvent.testSegment(segment)) {
      span = new DatastoreSpanEvent(segment)
    } else {
      span = new SpanEvent()
    }

    const tx = segment.transaction

    Object.assign(span.intrinsics, {
      traceId: tx.traceId || tx.id,
      guid: segment.id,
      parentId,
      transactionId: tx.id,
      sampled: tx.sampled,
      priority: tx.priority,
      name: segment.name,
      'nr.entryPoint': tx.baseSegment === segment ? true : null,
      // Timestamp in milliseconds, duration in seconds. Yay consistency!
      timestamp: segment.timer.start,
      duration: segment.timer.getDurationInMillis() / 1000
    })

    return span
  }

  toJSON() {
    const intrinsics = Object.create(null)
    for (let key in this.intrinsics) {
      if (this.intrinsics[key] != null) {
        intrinsics[key] = this.intrinsics[key]
      }
    }

    return [
      intrinsics,
      EMPTY_USER_ATTRS,
      this.attributes.get(DESTINATIONS.SPAN_EVENT)
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
  constructor(segment) {
    super(segment)

    const parameters = segment.parameters

    Object.assign(this.intrinsics, {
      category: CATEGORIES.HTTP,
      component: parameters.library || HTTP_LIBRARY,
      'span.kind': SPAN_KIND_ATTRIBUTE,
    })

    if (parameters.url) {
      this.attributes.addAttribute(
        DESTINATIONS.SPAN_EVENT,
        'http.url',
        parameters.url
      )
    }
    if (parameters.procedure) {
      this.attributes.addAttribute(
        DESTINATIONS.SPAN_EVENT,
        'http.method',
        parameters.procedure
      )
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
  constructor(segment) {
    super(segment)

    const parameters = segment.parameters

    Object.assign(this.intrinsics, {
      category: CATEGORIES.DATASTORE,
      'span.kind': SPAN_KIND_ATTRIBUTE,
    })

    if (parameters.product) {
      this.attributes.addAttribute(
        DESTINATIONS.SPAN_EVENT,
        'component',
        parameters.product
      )
    }

    if (parameters.sql || parameters.sql_obfuscated) {
      let sql = null
      if (parameters.sql_obfuscated) {
        sql = _truncate(parameters.sql_obfuscated)
      } else if (parameters.sql) {
        sql = _truncate(parameters.sql)
      }

      this.attributes.addAttribute(
        DESTINATIONS.SPAN_EVENT,
        'db.statement',
        sql,
        true // Flag as exempt from normal attribute truncation
      )
    }

    if (parameters.database_name) {
      this.attributes.addAttribute(
        DESTINATIONS.SPAN_EVENT,
        'db.instance',
        parameters.database_name
      )
    }
    if (parameters.host) {
      this.attributes.addAttribute(
        DESTINATIONS.SPAN_EVENT,
        'peer.hostname',
        parameters.host
      )

      if (parameters.port_path_or_id) {
        this.attributes.addAttribute(
          DESTINATIONS.SPAN_EVENT,
          'peer.address',
          `${parameters.host}:${parameters.port_path_or_id}`
        )
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
