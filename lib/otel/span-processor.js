/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const SegmentSynthesizer = require('./segment-synthesis')
const { otelSynthesis } = require('../symbols')
const { hrTimeToMilliseconds } = require('@opentelemetry/core')
const { SpanKind } = require('@opentelemetry/api')
const urltils = require('../util/urltils')
const {
  ATTR_DB_NAME,
  ATTR_DB_STATEMENT,
  ATTR_DB_SYSTEM,
  ATTR_FULL_URL,
  ATTR_GRPC_STATUS_CODE,
  ATTR_HTTP_METHOD,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_RESP_STATUS_CODE,
  ATTR_HTTP_ROUTE,
  ATTR_HTTP_STATUS_CODE,
  ATTR_HTTP_STATUS_TEXT,
  ATTR_HTTP_URL,
  ATTR_MESSAGING_MESSAGE_CONVERSATION_ID,
  ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY,
  ATTR_NET_HOST_NAME,
  ATTR_NET_HOST_PORT,
  ATTR_NET_PEER_NAME,
  ATTR_NET_PEER_PORT,
  ATTR_RPC_SYSTEM,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_QUERY,
} = require('./constants')
const { DESTINATIONS } = require('../config/attribute-filter')

module.exports = class NrSpanProcessor {
  constructor(agent) {
    this.agent = agent
    this.synthesizer = new SegmentSynthesizer(agent)
    this.tracer = agent.tracer
  }

  /**
   * Synthesize segment at start of span and assign to a symbol
   * that will be removed in `onEnd` once the correspondig
   * segment is read.
   * @param {object} span otel span getting tested
   */
  onStart(span) {
    span[otelSynthesis] = this.synthesizer.synthesize(span)
  }

  /**
   * Update the segment duration from span and reconcile
   * any attributes that were added after the start
   * @param {object} span otel span getting updated
   */
  onEnd(span) {
    if (span[otelSynthesis] && span[otelSynthesis].segment) {
      const { segment, transaction } = span[otelSynthesis]
      this.updateDuration(segment, span)
      this.reconcileAttributes({ segment, span, transaction })
      delete span[otelSynthesis]
    }
  }

  updateDuration(segment, span) {
    segment.touch()
    const duration = hrTimeToMilliseconds(span.duration)
    segment.overwriteDurationInMillis(duration)
  }

  reconcileAttributes({ segment, span, transaction }) {
    if (span.kind === SpanKind.SERVER) {
      this.reconcileServerAttributes({ segment, span, transaction })
    } else if (span.kind === SpanKind.CLIENT && span.attributes[ATTR_DB_SYSTEM]) {
      this.reconcileDbAttributes({ segment, span })
    } else if (span.kind === SpanKind.PRODUCER) {
      this.reconcileProducerAttributes({ segment, span })
    } else if (span.kind === SpanKind.CLIENT && (span.attributes[ATTR_HTTP_METHOD] || span.attributes[ATTR_HTTP_REQUEST_METHOD])) {
      this.reconcileHttpExternalAttributes({ segment, span })
    }
  }

  reconcileHttpExternalAttributes({ segment, span }) {
    for (const [prop, value] of Object.entries(span.attributes)) {
      let key = prop
      let sanitized = value

      if (key === ATTR_HTTP_REQUEST_METHOD || key === ATTR_HTTP_METHOD) {
        key = 'procedure'
        segment.addAttribute(key, sanitized)
      } else if (key === ATTR_SERVER_ADDRESS || key === ATTR_NET_PEER_NAME) {
        key = 'hostname'
        sanitized = this.sanitizeHostname(sanitized)
        segment.addSpanAttribute(key, sanitized)
      } else if (key === ATTR_SERVER_PORT || key === ATTR_NET_PEER_PORT) {
        key = 'port'
        segment.addSpanAttribute(key, sanitized)
      } else if (key === ATTR_HTTP_RESP_STATUS_CODE || key === ATTR_HTTP_STATUS_CODE) {
        key = 'http.statusCode'
        segment.addSpanAttribute(key, sanitized)
      } else if (key === ATTR_HTTP_STATUS_TEXT) {
        key = 'http.statusText'
        segment.addSpanAttribute(key, sanitized)
      } else if (key === ATTR_FULL_URL || key === ATTR_HTTP_URL) {
        sanitized = urltils.scrubAndParseParameters(sanitized)
        const path = urltils.obfuscatePath(this.agent.config, sanitized.path)
        const host = this.sanitizeHostname(sanitized.host)
        sanitized = `${sanitized.protocol}//${host}${path}`
        key = 'url'
        segment.addAttribute(key, sanitized)
      } else if (key === ATTR_URL_QUERY || key === ATTR_FULL_URL || key === ATTR_HTTP_URL) {
        this.addQueryParameters(segment, sanitized)
      } else {
        segment.addAttribute(key, sanitized)
      }
    }
  }

  sanitizeHostname(hostname) {
    return urltils.isLocalhost(hostname) ? this.agent.config.getHostnameSafe(hostname) : hostname
  }

  addQueryParameters(segment, query) {
    const parameters = urltils.parseParameters(query)
    for (const [queryKey, queryValue] of Object.entries(parameters)) {
      segment.addSpanAttribute(`request.parameters.${queryKey}`, queryValue)
    }
  }

  reconcileServerAttributes({ segment, span, transaction }) {
    if (span.attributes[ATTR_RPC_SYSTEM]) {
      this.reconcileRpcAttributes({ segment, span, transaction })
    } else {
      this.reconcileHttpAttributes({ segment, span, transaction })
    }

    // End the corresponding transaction for the entry point server span.
    // We do then when the span ends to ensure all data has been processed
    // for the correspondig server span.
    transaction.end()
  }

  reconcileHttpAttributes({ segment, span, transaction }) {
    for (const [prop, value] of Object.entries(span.attributes)) {
      let key = prop
      let sanitized = value
      if (key === ATTR_HTTP_ROUTE) {
        // TODO: can we get the route params?
        transaction.nameState.appendPath(sanitized)
      } else if (key === ATTR_HTTP_RESP_STATUS_CODE || key === ATTR_HTTP_STATUS_CODE) {
        transaction.finalizeNameFromUri(transaction.parsedUrl, sanitized)
        transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'http.statusCode', sanitized)
        key = 'http.statusCode'
      // Not using const as it is not in semantic-conventions
      } else if (key === ATTR_HTTP_STATUS_TEXT) {
        transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'http.statusText', sanitized)
        key = 'http.statusText'
      } else if (key === ATTR_SERVER_PORT || key === ATTR_NET_HOST_PORT) {
        key = 'port'
      } else if (key === ATTR_SERVER_ADDRESS || key === ATTR_NET_HOST_NAME) {
        key = 'host'
        if (urltils.isLocalhost(sanitized)) {
          sanitized = this.agent.config.getHostnameSafe(sanitized)
        }
      }

      // TODO: otel instrumentation does not collect headers
      // a customer can specify which ones, we also specify this
      // so i think we'd have to cross reference our list
      // it also looks like we add all headers to the trace
      // this isn't doing that
      segment.addAttribute(key, sanitized)
    }
  }

  // TODO: our grpc instrumentation handles errors when the status code is not 0
  // we should prob do this here too
  reconcileRpcAttributes({ segment, span, transaction }) {
    for (const [prop, value] of Object.entries(span.attributes)) {
      if (prop === ATTR_GRPC_STATUS_CODE) {
        transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'response.status', value)
      }
      segment.addAttribute(prop, value)
    }
  }

  reconcileDbAttributes({ segment, span }) {
    for (const [prop, value] of Object.entries(span.attributes)) {
      let key = prop
      let sanitized = value
      if (key === ATTR_NET_PEER_PORT) {
        key = 'port_path_or_id'
      } else if (prop === ATTR_NET_PEER_NAME) {
        key = 'host'
        if (urltils.isLocalhost(sanitized)) {
          sanitized = this.agent.config.getHostnameSafe(sanitized)
        }
      } else if (prop === ATTR_DB_NAME) {
        key = 'database_name'
      } else if (prop === ATTR_DB_SYSTEM) {
        key = 'product'
      /**
       * This attribute was collected in `onStart`
       * and was passed to `ParsedStatement`. It adds
       * this segment attribute as `sql` or `sql_obfuscated`
       * and then when the span is built from segment
       * re-assigns to `db.statement`. This needs
       * to be skipped because it will be the raw value.
       */
      } else if (prop === ATTR_DB_STATEMENT) {
        continue
      }
      segment.addAttribute(key, sanitized)
    }
  }

  reconcileProducerAttributes({ segment, span }) {
    for (const [prop, value] of Object.entries(span.attributes)) {
      let key = prop
      let sanitized = value

      if (prop === ATTR_SERVER_ADDRESS) {
        key = 'host'
        if (urltils.isLocalhost(sanitized)) {
          sanitized = this.agent.config.getHostnameSafe(sanitized)
        }
      } else if (prop === ATTR_SERVER_PORT) {
        key = 'port'
      } else if (prop === ATTR_MESSAGING_MESSAGE_CONVERSATION_ID) {
        key = 'correlation_id'
      } else if (prop === ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY) {
        key = 'routing_key'
      }

      segment.addAttribute(key, sanitized)
    }
  }
}
