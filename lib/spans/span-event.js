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
const logger = require('../logger').child({ component: 'span-event' })

/**
 * This keeps a static list of attributes that are used by
 * one or more entity relationship rules to synthesize an entity relationship.
 */
const SPAN_ENTITY_RELATIONSHIP_ATTRIBUTES = [
  'cloud.account.id',
  'cloud.platform',
  'cloud.region',
  'cloud.resource_id',
  'db.instance',
  'db.system',
  'http.url',
  'messaging.destination.name',
  'messaging.system',
  'peer.hostname',
  'server.address',
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
      if (transaction.partialType) {
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

  static isExitSpan(span) {
    const name = span.intrinsics?.name
    return REGEXS.CLIENT.EXTERNAL.test(name) || REGEXS.CLIENT.DATASTORE.test(name) || REGEXS.PRODUCER.test(name)
  }

  static isLlmSpan(span) {
    return span.intrinsics?.name?.startsWith('Llm/')
  }

  /**
   * Drops span or filters attributes based on partial trace rules for a given mode.
   * The rules are as such:
   *  - If not a partial trace, return span untouched
   *  - If an entry point span, return span untouched
   *  - If an LLM span, return span untouched
   *  - If not an exit span, return null(aka drop span)
   *  - If mode is 'reduced' and there are entity relationship attributes, return span untouched
   *  - If mode is 'essential' and there are entity relationship attributes or error attributes, return span with only those attributes, drop custom attributes
   *  - Otherwise return null(aka drop span)
   *
   *  @param {object} params to function
   *  @param {SpanEvent} params.span span to apply rules to
   *  @param {boolean} params.entryPoint whether the span is an entry point
   *  @param {boolean} params.partialType mode of partial trace ('reduced', 'essential', 'compact') if the trace is partial
   *  @returns {SpanEvent|null} the span after applying the rules, or null if dropped
   */
  static applyPartialTraceRules({ span, entryPoint, partialType }) {
    const isLlmSpan = SpanEvent.isLlmSpan(span)

    if (!partialType || entryPoint || isLlmSpan) {
      logger.trace('Span %s is either not a partial trace, an entry point: %s, or an LLM span: %s, keeping span unchanged.', span.intrinsics.name, entryPoint, isLlmSpan)
      return span
    }

    if (!SpanEvent.isExitSpan(span)) {
      logger.trace('Span %s is not an exit span and trace is partial granularity type: %s.', span.intrinsics.name, partialType)
      return null
    }

    const attributes = span.attributes
    const attrKeys = Object.keys(attributes)
    const entityRelationshipAttrs = SPAN_ENTITY_RELATIONSHIP_ATTRIBUTES.filter((item) => attrKeys.includes(item))
    if (partialType === 'reduced') {
      if (entityRelationshipAttrs.length === 0) {
        logger.trace('Span %s does not contain any entity relationship attributes %j and trace is partial granularity type: %s, dropping span.', span.intrinsics.name, span.attributes, partialType)
        return null
      }
      logger.trace('Span %s contains entity relationship attributes and trace is partial granularity type: %s, keeping span unchanged.', span.intrinsics.name, partialType)
    } else if (partialType === 'essential') {
      const attributesToKeep = Object.create(null)
      for (const item in attributes) {
        if (entityRelationshipAttrs.includes(item) || item.startsWith('error.')) {
          attributesToKeep[item] = attributes[item]
        }
      }

      if (Object.keys(attributesToKeep).length === 0) {
        logger.trace('Span %s does not contain any entity relationship attributes %j and trace is partial granularity type: %s, dropping span.', span.intrinsics.name, span.attributes, partialType)
        return null
      }

      span.attributes = attributesToKeep
      span.customAttributes = Object.create(null)
      logger.trace('Span %s contains entity relationship attributes and trace is partial granularity type: %s, only keeping entity relationship attributes and removing custom attributes.', span.intrinsics.name, partialType)
    }

    return span
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
    span.spanLinks = segment.spanLinks ?? []
    span.timedEvents = segment.timedEvents ?? []
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
   * @returns {SpanEvent} The constructed event.
   */
  static fromSegment({ segment, transaction, parentId = null, isRoot = false, inProcessSpans }) {
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

    const attributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
    const customAttributes = spanContext.customAttributes.get(DESTINATIONS.SPAN_EVENT)
    const span = SpanEvent.createSpan({ segment, attributes, customAttributes })
    span.addIntrinsics({ segment, spanContext, transaction, parentId, isRoot, inProcessSpans, entryPoint })

    addSpanKind({ segment, span })
    return SpanEvent.applyPartialTraceRules({ span, entryPoint, partialType: transaction.partialType })
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
