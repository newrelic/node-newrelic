'use strict'

const mapValueToStreamingTypeValue = require('./mapValueToStreamingTypeValue')
const {truncate} = require('../util/byte-limit')

const {DESTINATIONS} = require('../config/attribute-filter')
const NAMES = require('../metrics/names')
const HTTP_LIBRARY = 'http'
const CLIENT_KIND = 'client'
const CATEGORIES = {
  HTTP: 'http',
  DATASTORE: 'datastore',
  GENERIC: 'generic'
}

/**
 * Specialized span event class for use with infinite streaming.
 * Currently designed to be sent over grpc via the v1.proto definition.
 *
 * @private
 * @class
 */
class StreamingSpanEvent {
  constructor(traceId, agentAttributes, customAttributes) {
    this.traceId = traceId

    // TODO: for intrinsic attributes might want to cache types
    this.intrinsicAttributes = new StreamingAttributes()
    this.intrinsicAttributes.addAttribute('traceId', traceId)
    this.intrinsicAttributes.addAttribute('type', 'Span')
    this.intrinsicAttributes.addAttribute('category', CATEGORIES.GENERIC)

    // TODO: for agent attributes might want to cache types
    this.agentAttributes = new StreamingAttributes(agentAttributes)
    this.customAttributes = new StreamingAttributes(customAttributes)
  }

  static fromSegment(segment, parentId = null, isRoot = false) {
    const agentAttributes = segment.attributes.get(DESTINATIONS.SPAN_EVENT)
    const customAttributes = segment.customAttributes.get(DESTINATIONS.SPAN_EVENT)

    const transaction = segment.transaction
    const traceId = transaction.traceId

    let span = null
    if (StreamingHttpSpanEvent.isHttpSegment(segment)) {
      span = new StreamingHttpSpanEvent(traceId, agentAttributes, customAttributes)
    }  else if (StreamingDatastoreSpanEvent.isDatastoreSegment(segment)) {
      span = new StreamingDatastoreSpanEvent(traceId, agentAttributes, customAttributes)
    } else {
      span = new StreamingSpanEvent(traceId, agentAttributes, customAttributes)
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
 * Specialized attribute collection class for use with infinite streaming.
 * Currently designed to be sent over grpc via the v1.proto definition.
 *
 * @private
 * @class
 */
class StreamingAttributes {
  constructor(attributes) {
    if (attributes) {
      this.addAttributes(attributes)
    }
  }

  /**
   * Add a key/value pair to the attribute collection.
   * null/undefined values will be dropped.
   *
   * @param {string} key Name of the attribute to be stored.
   * @param {*} value Value of the attribute to be stored.
   */
  addAttribute(key, value) {
    const streamingValue = mapValueToStreamingTypeValue(value)
    if (streamingValue) {
      this[key] = streamingValue
      return true
    }

    // TODO: dropped the value... log something?
    return false
  }

  /**
   * Adds all attributes in an object to the attribute collection.
   * null/undefined values will be dropped.
   *
   * @param {object} [attributes]
   * @param {string} [attributes.key] Name of the attribute to be stored.
   * @param {string} [attributes.value] Value of the attribute to be stored.
   */
  addAttributes(attributes) {
    if (!attributes) {
      return
    }

    for (let [key, value] of Object.entries(attributes)) {
      this.addAttribute(key, value)
    }
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
  constructor(traceId, agentAttributes, customAttributes) {
    super(traceId, agentAttributes, customAttributes)

    this.intrinsicAttributes.addAttribute('category', CATEGORIES.HTTP)
    this.intrinsicAttributes.addAttribute('component', agentAttributes.library || HTTP_LIBRARY)
    this.intrinsicAttributes.addAttribute('span.kind', CLIENT_KIND)

    // this.intrinsics.category = CATEGORIES.HTTP
    // this.intrinsics.component = agentAttributes.library || HTTP_LIBRARY
    // this.intrinsics['span.kind'] = CLIENT_KIND

    if (agentAttributes.library) {
      agentAttributes.library = null
    }

    if (agentAttributes.url) {
      // TODO: addAttribute() might have done some special handling we dont yet
      this.agentAttributes.addAttribute('http.url', agentAttributes.url)
      // this.addAttribute('http.url', agentAttributes.url)
      agentAttributes.url = null
    }

    if (agentAttributes.procedure) {
      // TODO: addAttribute() might have done some special handling we dont yet
      this.agentAttributes.addAttribute('http.method', agentAttributes.procedure)
      // this.addAttribute('http.method', agentAttributes.procedure)
      agentAttributes.procedure = null
    }
  }

  static isHttpSegment(segment) {
    return segment.name.startsWith(NAMES.EXTERNAL.PREFIX)
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
  constructor(traceId, agentAttributes, customAttributes) {
    super(traceId, agentAttributes, customAttributes)

    this.intrinsicAttributes.addAttribute('category', CATEGORIES.DATASTORE)
    this.intrinsicAttributes.addAttribute('span.kind', CLIENT_KIND)

    // this.intrinsics.category = CATEGORIES.DATASTORE
    // this.intrinsics['span.kind'] = CLIENT_KIND

    if (agentAttributes.product) {
      this.intrinsicAttributes.addAttribute('component', agentAttributes.product)
      // this.intrinsics.component = agentAttributes.product
      agentAttributes.product = null
    }

    if (agentAttributes.collection) {
      // TODO: addAttribute() might have done some special handling we dont yet
      this.agentAttributes.addAttribute('db.collection', agentAttributes.collection)
      // this.addAttribute('db.collection', agentAttributes.collection)
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

      // TODO: addAttribute() might have done some special handling we dont yet
      this.agentAttributes.addAttribute('db.statement', sql)
      // Flag as exempt from normal attribute truncation
      // this.addAttribute('db.statement', sql, true)
    }

    if (agentAttributes.database_name) {
      // TODO: addAttribute() might have done some special handling we dont yet
      this.agentAttributes.addAttribute('db.instance', agentAttributes.database_name)

      // this.addAttribute('db.instance', agentAttributes.database_name)
      agentAttributes.database_name = null
    }

    if (agentAttributes.host) {
      // TODO: addAttribute() might have done some special handling we dont yet
      this.agentAttributes.addAttribute('peer.hostname', agentAttributes.host)
      // this.addAttribute('peer.hostname', agentAttributes.host)

      if (agentAttributes.port_path_or_id) {
        const address = `${agentAttributes.host}:${agentAttributes.port_path_or_id}`
        // TODO: addAttribute() might have done some special handling we dont yet
        this.agentAttributes.addAttribute('peer.address', address)
        // this.addAttribute('peer.address', address)
        agentAttributes.port_path_or_id = null
      }

      agentAttributes.host = null
    }
  }

  static isDatastoreSegment(segment) {
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

module.exports = StreamingSpanEvent
