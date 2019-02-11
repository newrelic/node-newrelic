'use strict'

const {truncate} = require('../util/byte-limit')
const Attributes = require('../attributes')

const {DESTINATIONS} = require('../config/attribute-filter')
const NAMES = require('../metrics/names')
const HTTP_LIBRARY = 'http'
const SPAN_KIND_ATTRIBUTE = 'client'
const SEGMENT_SCOPE = 'segment'
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

  addAttribute(key, value, truncateExempt = false) {
    this.attributes.addAttribute(
      SEGMENT_SCOPE,
      DESTINATIONS.SPAN_EVENT,
      key,
      value,
      truncateExempt
    )
  }

  getAttributes() {
    return this.attributes.get(DESTINATIONS.SPAN_EVENT)
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

    const segmentAttributes = segment.getAttributes()

    Object.assign(this.intrinsics, {
      category: CATEGORIES.HTTP,
      component: segmentAttributes.library || HTTP_LIBRARY,
      'span.kind': SPAN_KIND_ATTRIBUTE,
    })

    if (segmentAttributes.url) {
      this.addAttribute('http.url', segmentAttributes.url)
    }

    if (segmentAttributes.procedure) {
      this.addAttribute('http.method', segmentAttributes.procedure)
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

    const segmentAttributes = segment.getAttributes()

    Object.assign(this.intrinsics, {
      category: CATEGORIES.DATASTORE,
      'span.kind': SPAN_KIND_ATTRIBUTE,
    })

    if (segmentAttributes.product) {
      this.addAttribute( 'component', segmentAttributes.product)
    }

    if (segmentAttributes.sql || segmentAttributes.sql_obfuscated) {
      let sql = null
      if (segmentAttributes.sql_obfuscated) {
        sql = _truncate(segmentAttributes.sql_obfuscated)
      } else if (segmentAttributes.sql) {
        sql = _truncate(segmentAttributes.sql)
      }

      // Flag as exempt from normal attribute truncation
      this.addAttribute('db.statement', sql, true)
    }

    if (segmentAttributes.database_name) {
      this.addAttribute('db.instance', segmentAttributes.database_name)
    }

    if (segmentAttributes.host) {
      this.addAttribute('peer.hostname', segmentAttributes.host)

      if (segmentAttributes.port_path_or_id) {
        this.addAttribute(
          'peer.address',
          `${segmentAttributes.host}:${segmentAttributes.port_path_or_id}`
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
