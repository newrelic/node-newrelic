/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const StreamingSpanAttributes = require('./streaming-span-attributes')
const { truncate } = require('../util/byte-limit')
const Config = require('../config')

const { DESTINATIONS } = require('../config/attribute-filter')

const HTTP_LIBRARY = 'http'
const CLIENT_KIND = 'client'
const CATEGORIES = {
  HTTP: 'http',
  DATASTORE: 'datastore',
  GENERIC: 'generic'
}

const EXTERNAL_REGEX = /^(?:Truncated\/)?External\//
const DATASTORE_REGEX = /^(?:Truncated\/)?Datastore\//

/**
 * Specialized span event class for use with infinite streaming.
 * Currently designed to be sent over grpc via the v1.proto definition.
 *
 * @private
 * @class
 */
class StreamingSpanEvent {
  /**
   * @param {*} traceId TraceId for the Span.
   * @param {object} agentAttributes Initial set of agent attributes.
   * Must be pre-filtered and truncated.
   * @param {object} customAttributes Initial set of custom attributes.
   * Must be pre-filtered and truncated.
   */
  constructor(traceId, agentAttributes, customAttributes) {
    this._traceId = traceId

    this._intrinsicAttributes = new StreamingSpanAttributes()
    this._intrinsicAttributes.addAttribute('traceId', traceId)
    this._intrinsicAttributes.addAttribute('type', 'Span')
    this._intrinsicAttributes.addAttribute('category', CATEGORIES.GENERIC)

    this._customAttributes = new StreamingSpanAttributes(customAttributes)
    this._agentAttributes = new StreamingSpanAttributes(agentAttributes)
  }

  /**
   * Add a key/value pair to the Span's instrinisics collection.
   *
   * @param {string} key Name of the attribute to be stored.
   * @param {string|boolean|number} value Value of the attribute to be stored.
   */
  addIntrinsicAttribute(key, value) {
    this._intrinsicAttributes.addAttribute(key, value)
  }

  /**
   * Add a key/value pair to the Span's custom/user attributes collection.
   *
   * @param {string} key Name of the attribute to be stored.
   * @param {string|boolean|number} value Value of the attribute to be stored.
   * @param {boolean} [truncateExempt=false] Set to true if attribute should not be truncated.
   */
  addCustomAttribute(key, value, truncateExempt = false) {
    const shouldKeep = this._checkFilter(key)
    if (shouldKeep) {
      const processedValue = truncateExempt ? value : _truncate(value)
      this._customAttributes.addAttribute(key, processedValue)
    }
  }

  /**
   * Add a key/value pair to the Span's agent attributes collection.
   *
   * @param {string} key Name of the attribute to be stored.
   * @param {string|boolean|number} value Value of the attribute to be stored.
   * @param {boolean} [truncateExempt=false] Set to true if attribute should not be truncated.
   */
  addAgentAttribute(key, value, truncateExempt = false) {
    const shouldKeep = this._checkFilter(key)
    if (shouldKeep) {
      const processedValue = truncateExempt ? value : _truncate(value)
      this._agentAttributes.addAttribute(key, processedValue)
    }
  }

  _checkFilter(key) {
    const { attributeFilter } = Config.getInstance()
    const dest = attributeFilter.filterSegment(DESTINATIONS.SPAN_EVENT, key)
    return dest & DESTINATIONS.SPAN_EVENT
  }

  toStreamingFormat() {
    // Attributes are pre-formatted.
    return {
      trace_id: this._traceId,
      intrinsics: this._intrinsicAttributes,
      user_attributes: this._customAttributes,
      agent_attributes: this._agentAttributes
    }
  }

  static fromSegment(segment, parentId = null, isRoot = false) {
    const spanContext = segment.getSpanContext()

    // Since segments already hold span agent attributes and we want to leverage
    // filtering, we add to the segment attributes prior to processing.
    if (spanContext.hasError && !segment.transaction.hasIgnoredErrorStatusCode()) {
      const details = spanContext.errorDetails
      segment.addSpanAttribute('error.message', details.message)
      segment.addSpanAttribute('error.class', details.type)
      if (details.expected) {
        segment.addSpanAttribute('error.expected', details.expected)
      }
    }

    const agentAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)

    const customAttributes = spanContext.customAttributes.get(DESTINATIONS.SPAN_EVENT)

    const transaction = segment.transaction
    const traceId = transaction.traceId

    let span = null
    if (StreamingHttpSpanEvent.isHttpSegment(segment)) {
      span = new StreamingHttpSpanEvent(traceId, agentAttributes, customAttributes)
    } else if (StreamingDatastoreSpanEvent.isDatastoreSegment(segment)) {
      span = new StreamingDatastoreSpanEvent(traceId, agentAttributes, customAttributes)
    } else {
      span = new StreamingSpanEvent(traceId, agentAttributes, customAttributes)
    }

    for (const [key, value] of Object.entries(spanContext.intrinsicAttributes)) {
      span.addIntrinsicAttribute(key, value)
    }

    span.addIntrinsicAttribute('guid', segment.id)
    span.addIntrinsicAttribute('parentId', parentId)
    span.addIntrinsicAttribute('transactionId', transaction.id)
    span.addIntrinsicAttribute('sampled', transaction.sampled)
    span.addIntrinsicAttribute('priority', transaction.priority)
    span.addIntrinsicAttribute('name', segment.name)

    if (isRoot) {
      span.addIntrinsicAttribute('trustedParentId', transaction.traceContext.trustedParentId)
      if (transaction.traceContext.tracingVendors) {
        span.addIntrinsicAttribute('tracingVendors', transaction.traceContext.tracingVendors)
      }
    }

    // Only set this if it will be `true`. Must be `null` otherwise.
    if (transaction.baseSegment === segment) {
      span.addIntrinsicAttribute('nr.entryPoint', true)
    }

    // Timestamp in milliseconds, duration in seconds. Yay consistency!
    span.addIntrinsicAttribute('timestamp', segment.timer.start)
    span.addIntrinsicAttribute('duration', segment.timer.getDurationInMillis() / 1000)

    return span
  }
}

/**
 * Specialized span event class for external requests for use with infinite streaming.
 * Currently designed to be sent over grpc via the v1.proto definition.
 *
 * @private
 * @class
 */
class StreamingHttpSpanEvent extends StreamingSpanEvent {
  /**
   * @param {*} traceId TraceId for the Span.
   * @param {object} agentAttributes Initial set of agent attributes.
   * Must be pre-filtered and truncated.
   * @param {object} customAttributes Initial set of custom attributes.
   * Must be pre-filtered and truncated.
   */
  constructor(traceId, agentAttributes, customAttributes) {
    super(traceId, agentAttributes, customAttributes)

    this.addIntrinsicAttribute('category', CATEGORIES.HTTP)
    this.addIntrinsicAttribute('component', agentAttributes.library || HTTP_LIBRARY)
    this.addIntrinsicAttribute('span.kind', CLIENT_KIND)

    if (agentAttributes.library) {
      agentAttributes.library = null
    }

    if (agentAttributes.url) {
      this.addAgentAttribute('http.url', agentAttributes.url)
      agentAttributes.url = null
    }

    if (agentAttributes.procedure) {
      this.addAgentAttribute('http.method', agentAttributes.procedure)
      agentAttributes.procedure = null
    }
  }

  static isHttpSegment(segment) {
    return EXTERNAL_REGEX.test(segment.name)
  }
}

/**
 * Specialized span event class for datastore operations and queries for use with
 * infinite streaming.
 * Currently designed to be sent over grpc via the v1.proto definition.
 *
 * @private
 * @class.
 */
class StreamingDatastoreSpanEvent extends StreamingSpanEvent {
  /**
   * @param {*} traceId TraceId for the Span.
   * @param {object} agentAttributes Initial set of agent attributes.
   * Must be pre-filtered and truncated.
   * @param {object} customAttributes Initial set of custom attributes.
   * Must be pre-filtered and truncated.
   */
  constructor(traceId, agentAttributes, customAttributes) {
    super(traceId, agentAttributes, customAttributes)

    this.addIntrinsicAttribute('category', CATEGORIES.DATASTORE)
    this.addIntrinsicAttribute('span.kind', CLIENT_KIND)

    if (agentAttributes.product) {
      this.addIntrinsicAttribute('component', agentAttributes.product)
      agentAttributes.product = null
    }

    if (agentAttributes.collection) {
      this.addAgentAttribute('db.collection', agentAttributes.collection)
      agentAttributes.collection = null
    }

    if (agentAttributes.sql || agentAttributes.sql_obfuscated) {
      let sql = null
      if (agentAttributes.sql_obfuscated) {
        sql = _truncate(agentAttributes.sql_obfuscated)
        agentAttributes.sql_obfuscated = null
      } else if (agentAttributes.sql) {
        sql = _truncate(agentAttributes.sql)
        agentAttributes.sql = null
      }

      // Flag as exempt from normal attribute truncation
      this.addAgentAttribute('db.statement', sql, true)
    }

    if (agentAttributes.database_name) {
      this.addAgentAttribute('db.instance', agentAttributes.database_name)
      agentAttributes.database_name = null
    }

    if (agentAttributes.host) {
      this.addAgentAttribute('peer.hostname', agentAttributes.host)

      if (agentAttributes.port_path_or_id) {
        const address = `${agentAttributes.host}:${agentAttributes.port_path_or_id}`
        this.addAgentAttribute('peer.address', address)
        agentAttributes.port_path_or_id = null
      }

      agentAttributes.host = null
    }
  }

  static isDatastoreSegment(segment) {
    return DATASTORE_REGEX.test(segment.name)
  }
}

function _truncate(val) {
  let truncated = truncate(val, 1997)
  if (truncated !== val) {
    truncated += '...'
  }
  return truncated
}

module.exports = StreamingSpanEvent
