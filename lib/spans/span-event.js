/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const Config = require('../config')
const { truncate } = require('../util/byte-limit')

const { DESTINATIONS } = require('../config/attribute-filter')
const { addSpanKind, isEntryPointSpan, reparentSpan, shouldCreateSpan, HTTP_LIBRARY, REGEXS, SPAN_KIND, CATEGORIES } = require('./helpers')
const EMPTY_USER_ATTRS = Object.freeze(Object.create(null))
const SERVER_ADDRESS = 'server.address'
/**
 * This keeps a static list of attributes that are used by
 * one or more entity relationship rules to synthesize an entity relationship.
 * Note: These attributes also have corresponding TraceSegment attributes
 * as this list is checked before a span is made.  The ones that are TraceSegment
 * attributes are noted in the comments. Any new span attributes being added must
 * be checked to ensure those are what is getting assigned to the TraceSegment as well.
 */
const SPAN_ENTITY_RELATIONSHIP_ATTRIBUTES = [
  'cloud.account.id',
  'cloud.platform',
  'cloud.region',
  'cloud.resource_id',
  'database_name', // gets mapped to `db.instance`
  'db.instance',
  'product', // gets mapped to `db.system`
  'db.system',
  'http.url',
  'url', // gets mapped to `http.url`
  'messaging.destination.name',
  'messaging.system',
  'peer.hostname',
  'host', // gets mapped to `server.address`
  'hostname', // gets mapped to `server.address`
  'server.address',
  'port', // gets mapped to `server.port`
  'port_path_or_id', // gets mapped to `server.port`
  'server.port',
  'span.kind',
]

/**
 * All the intrinsic attributes for span events, regardless of kind.
 */
class SpanIntrinsics {
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
    this.component = null
    this.timestamp = null
    this.duration = null
    this['nr.entryPoint'] = null
    this['nr.pg'] = null
    this['span.kind'] = null
    this.trustedParentId = null
    this.tracingVendors = null
  }
}

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
  constructor(attributes, customAttributes) {
    this.customAttributes = customAttributes
    this.attributes = attributes
    this.intrinsics = new SpanIntrinsics()

    if (attributes.host) {
      this.addAttribute(SERVER_ADDRESS, attributes.host)
      attributes.host = null
    }

    if (attributes.port) {
      this.addAttribute('server.port', attributes.port, true)
      attributes.port = null
    }
  }

  getIntrinsicAttributes() {
    return this.intrinsics
  }

  addIntrinsics({ segment, spanContext, transaction, parentId, isRoot, inProcessSpans, entryPoint }) {
    for (const [key, value] of Object.entries(spanContext.intrinsicAttributes)) {
      this.addIntrinsicAttribute(key, value)
    }

    this.addIntrinsicAttribute('traceId', transaction.traceId)
    this.addIntrinsicAttribute('transactionId', transaction.id)
    this.addIntrinsicAttribute('sampled', transaction.sampled)
    this.addIntrinsicAttribute('priority', transaction.priority)
    this.addIntrinsicAttribute('name', segment.name)
    this.addIntrinsicAttribute('guid', segment.id)
    this.addIntrinsicAttribute('parentId', reparentSpan({ inProcessSpans, isRoot, segment, transaction, parentId }))

    if (isRoot) {
      this.addIntrinsicAttribute('trustedParentId', transaction.traceContext.trustedParentId)
      if (transaction.traceContext.tracingVendors) {
        this.addIntrinsicAttribute('tracingVendors', transaction.traceContext.tracingVendors)
      }
    }

    // Only set this if it will be `true`. Must be `null` otherwise.
    if (entryPoint) {
      this.addIntrinsicAttribute('nr.entryPoint', true)
      if (transaction.isPartialTrace) {
        this.addIntrinsicAttribute('nr.pg', true)
      }
    }

    // Timestamp in milliseconds, duration in seconds. Yay consistency!
    this.addIntrinsicAttribute('timestamp', segment.timer.start)
    this.addIntrinsicAttribute('duration', segment.timer.getDurationInMillis() / 1000)
  }

  addIntrinsicAttribute(key, value) {
    this.intrinsics[key] = value
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

  static isExitSpan(segment) {
    return REGEXS.CLIENT.EXTERNAL.test(segment.name) || REGEXS.CLIENT.DATASTORE.test(segment.name) || REGEXS.PRODUCER.test(segment.name)
  }

  static isLlmSpan(segment) {
    return segment.name.startsWith('Llm/')
  }

  /**
   * Filters attributes for partial trace span events based on a given mode.
   * The rules are as such:
   *  - If not a partial trace, return all attributes.
   *  - If an entry point span, return all attributes.
   *  - If an LLM span, return all attributes.
   *  - If not an exit span, return no attributes.
   *  - If mode is 'reduced' and there are entity relationship attributes, return all attributes.
   *  - Otherwise, return no attributes.
   *
   *  @param {object} params to function
   *  @param {TraceSegment} params.segment segment to filter attributes from
   *  @param {SpanContext} params.spanContext span context to filter attributes from
   *  @param {boolean} params.entryPoint whether the span is an entry point
   *  @param {string} params.partialGranularityMode mode of partial trace ('reduced', 'essential', 'compact')
   *  @param {boolean} params.isPartialTrace whether the trace is a partial trace
   *  @returns {object} { attributes, customAttributes, dropSpan: boolean }
   */
  static filterPartialTraceAttributes({ segment, spanContext, entryPoint, partialGranularityMode, isPartialTrace }) {
    const attributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
    const customAttributes = spanContext.customAttributes.get(DESTINATIONS.SPAN_EVENT)
    if (!isPartialTrace || entryPoint || SpanEvent.isLlmSpan(segment)) {
      return { attributes, customAttributes, dropSpan: false }
    }

    if (!SpanEvent.isExitSpan(segment)) {
      return { dropSpan: true }
    }

    const attrKeys = Object.keys(attributes)
    const entityRelationshipAttrs = SPAN_ENTITY_RELATIONSHIP_ATTRIBUTES.filter((item) => attrKeys.includes(item))
    if (partialGranularityMode === 'reduced') {
      if (entityRelationshipAttrs.length > 0) {
        return { attributes, customAttributes, dropSpan: false }
      }
    }

    return { dropSpan: true }
  }

  static createSpan({ segment, attributes, customAttributes }) {
    let span = null
    if (HttpSpanEvent.testSegment(segment)) {
      span = new HttpSpanEvent(attributes, customAttributes)
    } else if (DatastoreSpanEvent.testSegment(segment)) {
      span = new DatastoreSpanEvent(attributes, customAttributes)
    } else {
      span = new SpanEvent(attributes, customAttributes)
    }
    return span
  }

  /**
   * Constructs a `SpanEvent` from the given segment.
   *
   * The constructed span event will contain extra data depending on the
   * category of the segment.
   *
   * @param {object} params params object
   * @param {TraceSegment} params.segment segment to turn into a span event.
   * @param {Transaction} params.transaction active transaction
   * @param {?string} [params.parentId] ID of the segment's parent.
   * @param {boolean} [params.isRoot] if segment is root segment; defaults to `false`
   * @param {boolean} params.inProcessSpans if the segment is in-process, create span
   * @param {string} params.partialGranularityMode mode of partial trace ('reduced', 'essential', 'compact')
   * @returns {SpanEvent} The constructed event.
   */
  static fromSegment({ segment, transaction, parentId = null, isRoot = false, inProcessSpans, partialGranularityMode }) {
    const entryPoint = isEntryPointSpan({ segment, transaction })
    if (!inProcessSpans && !shouldCreateSpan({ entryPoint, segment, transaction })) {
      return null
    }

    const spanContext = segment.getSpanContext()

    // Since segments already hold span agent attributes and we want to leverage
    // filtering, we add to the segment attributes prior to processing.
    if (spanContext.hasError && !transaction.hasIgnoredErrorStatusCode()) {
      const details = spanContext.errorDetails
      segment.addSpanAttribute('error.message', details.message)
      segment.addSpanAttribute('error.class', details.type)
      if (details.expected) {
        segment.addSpanAttribute('error.expected', details.expected)
      }
    }

    const { attributes, customAttributes, dropSpan } = SpanEvent.filterPartialTraceAttributes({ spanContext, entryPoint, segment, partialGranularityMode, isPartialTrace: transaction.isPartialTrace })
    // If attributes were stripped out due to partial trace filtering, do not create span.
    if (dropSpan) {
      return null
    }

    const span = SpanEvent.createSpan({ segment, attributes, customAttributes })
    span.addIntrinsics({ segment, spanContext, transaction, parentId, isRoot, inProcessSpans, entryPoint })

    addSpanKind({ segment, span })
    return span
  }

  toJSON() {
    return [
      _filterNulls(this.intrinsics),
      this.customAttributes ? _filterNulls(this.customAttributes) : EMPTY_USER_ATTRS,
      _filterNulls(this.attributes)
    ]
  }

  addCustomAttribute(key, value, truncateExempt = false) {
    const { attributeFilter } = Config.getInstance()
    const dest = attributeFilter.filterSegment(DESTINATIONS.SPAN_EVENT, key)
    if (dest & DESTINATIONS.SPAN_EVENT) {
      this.customAttributes[key] = truncateExempt ? value : _truncate(value)
    }
  }

  addAttribute(key, value, truncateExempt = false) {
    const { attributeFilter } = Config.getInstance()
    const dest = attributeFilter.filterSegment(DESTINATIONS.SPAN_EVENT, key)
    if (dest & DESTINATIONS.SPAN_EVENT) {
      this.attributes[key] = truncateExempt ? value : _truncate(value)
    }
  }
}

/**
 * Span event class for external requests.
 *
 * @private
 * @class
 */
class HttpSpanEvent extends SpanEvent {
  constructor(attributes, customAttributes) {
    super(attributes, customAttributes)

    this.addIntrinsicAttribute('category', CATEGORIES.HTTP)
    this.addIntrinsicAttribute('component', attributes.library || HTTP_LIBRARY)
    this.addIntrinsicAttribute('span.kind', SPAN_KIND.CLIENT)

    if (attributes.library) {
      attributes.library = null
    }

    if (attributes.url) {
      this.addAttribute('http.url', attributes.url)
      attributes.url = null
    }

    if (attributes.hostname) {
      this.addAttribute(SERVER_ADDRESS, attributes.hostname)
      attributes.hostname = null
    }

    if (attributes.procedure) {
      this.addAttribute('http.method', attributes.procedure)
      this.addAttribute('http.request.method', attributes.procedure)
      attributes.procedure = null
    }
  }

  static testSegment(segment) {
    return REGEXS.CLIENT.EXTERNAL.test(segment.name)
  }
}

/**
 * Span event class for datastore operations and queries.
 *
 * @private
 * @class
 */
class DatastoreSpanEvent extends SpanEvent {
  constructor(attributes, customAttributes) {
    super(attributes, customAttributes)

    this.addIntrinsicAttribute('category', CATEGORIES.DATASTORE)
    this.addIntrinsicAttribute('span.kind', SPAN_KIND.CLIENT)

    if (attributes.product) {
      this.addIntrinsicAttribute('component', attributes.product)
      this.addAttribute('db.system', attributes.product)
      attributes.product = null
    }

    if (attributes.collection) {
      this.addAttribute('db.collection', attributes.collection)
      attributes.collection = null
    }

    if (attributes.sql || attributes.sql_obfuscated) {
      let sql = null
      if (attributes.sql_obfuscated) {
        sql = _truncate(attributes.sql_obfuscated)
        attributes.sql_obfuscated = null
      } else if (attributes.sql) {
        sql = _truncate(attributes.sql)
        attributes.sql = null
      }

      // Flag as exempt from normal attribute truncation
      this.addAttribute('db.statement', sql, true)
    }

    if (attributes.database_name) {
      this.addAttribute('db.instance', attributes.database_name)
      attributes.database_name = null
    }

    const serverAddress = attributes[SERVER_ADDRESS]

    if (serverAddress) {
      this.addAttribute('peer.hostname', serverAddress)

      if (attributes.port_path_or_id) {
        const address = `${serverAddress}:${attributes.port_path_or_id}`
        this.addAttribute('peer.address', address)
        this.addAttribute('server.port', attributes.port_path_or_id, true)
        attributes.port_path_or_id = null
      }
    }
  }

  static testSegment(segment) {
    return REGEXS.CLIENT.DATASTORE.test(segment.name)
  }
}

function _truncate(val) {
  let truncated = truncate(val, 1997)
  if (truncated !== val) {
    truncated += '...'
  }
  return truncated
}

function _filterNulls(obj) {
  const out = Object.create(null)
  for (const key in obj) {
    if (obj[key] != null) {
      out[key] = obj[key]
    }
  }
  return out
}

module.exports = SpanEvent
