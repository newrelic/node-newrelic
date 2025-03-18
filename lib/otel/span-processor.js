/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { hrTimeToMilliseconds } = require('@opentelemetry/core')
const { SpanKind } = require('@opentelemetry/api')

const AttributeReconciler = require('./attr-reconciler')
const SegmentSynthesizer = require('./segment-synthesis')
const { otelSynthesis } = require('../symbols')

const {
  ATTR_DB_NAME,
  ATTR_DB_STATEMENT,
  ATTR_DB_SYSTEM,
  ATTR_FAAS_INVOKED_PROVIDER,
  ATTR_FULL_URL,
  ATTR_GRPC_STATUS_CODE,
  ATTR_HTTP_METHOD,
  ATTR_HTTP_REQUEST_METHOD,
  ATTR_HTTP_ROUTE,
  ATTR_HTTP_RES_STATUS_CODE,
  ATTR_HTTP_STATUS_CODE,
  ATTR_HTTP_STATUS_TEXT,
  ATTR_HTTP_URL,
  ATTR_MESSAGING_DESTINATION,
  ATTR_MESSAGING_DESTINATION_NAME,
  ATTR_MESSAGING_MESSAGE_CONVERSATION_ID,
  ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY,
  ATTR_NET_HOST_NAME,
  ATTR_NET_HOST_PORT,
  ATTR_NET_PEER_NAME,
  ATTR_NET_PEER_PORT,
  ATTR_RPC_SYSTEM,
  ATTR_RPC_SERVICE,
  ATTR_SERVER_ADDRESS,
  ATTR_SERVER_PORT,
  ATTR_URL_QUERY,
  DB_SYSTEM_VALUES,
  EXCEPTION_MESSAGE,
  EXCEPTION_STACKTRACE,
  EXCEPTION_TYPE,
  SPAN_STATUS_CODE
} = require('./constants')
const { DESTINATIONS } = require('../config/attribute-filter')

module.exports = class NrSpanProcessor {
  #reconciler

  constructor(agent) {
    this.agent = agent
    this.synthesizer = new SegmentSynthesizer(agent)
    this.tracer = agent.tracer

    this.#reconciler = new AttributeReconciler({ agent })
  }

  /**
   * Synthesize segment at start of span and assign to a symbol
   * that will be removed in `onEnd` once the corresponding
   * segment is read.
   * @param {object} span otel span getting tested
   */
  onStart(span) {
    span[otelSynthesis] = this.synthesizer.synthesize(span)
  }

  /**
   * Update the segment duration from span, handle errors and
   * reconcile any attributes that were added after the start
   * @param {object} span otel span getting updated
   */
  onEnd(span) {
    if (span[otelSynthesis] && span[otelSynthesis].segment) {
      const { segment, transaction } = span[otelSynthesis]
      this.updateDuration(segment, span)
      this.handleError({ segment, transaction, span })
      this.reconcileAttributes({ segment, span, transaction })
      delete span[otelSynthesis]
    }
  }

  handleError({ segment, transaction, span }) {
    if (span?.status?.code === SPAN_STATUS_CODE.ERROR) {
      const errorEvents = span.events.filter((event) => event.name === 'exception')
      errorEvents.forEach((err) => {
        const msg = err.attributes[EXCEPTION_MESSAGE] || err.attributes[EXCEPTION_TYPE] || `Error from ${segment.name}`
        const stack = err.attributes[EXCEPTION_STACKTRACE]
        const error = new Error(msg)
        error.stack = stack
        this.agent.errors.add(transaction, error, null, segment)
      })
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
    } else if (span.kind === SpanKind.CONSUMER) {
      this.reconcileConsumerAttributes({ segment, span, transaction })
    } else if (span.kind === SpanKind.PRODUCER) {
      this.reconcileProducerAttributes({ segment, span })
    } else if (span.kind === SpanKind.CLIENT && (span.attributes[ATTR_HTTP_METHOD] || span.attributes[ATTR_HTTP_REQUEST_METHOD])) {
      this.reconcileHttpExternalAttributes({ segment, span })
    }

    this.addAWSLinkingAttributes({ segment, span })
  }

  reconcileHttpExternalAttributes({ segment, span }) {
    const noOpMapper = () => { }
    const statusCode = (value) => segment.addSpanAttribute('http.statusCode', value)
    const statusText = (value) => segment.addSpanAttribute('http.statusText', value)
    const mapper = {
      [ATTR_HTTP_REQUEST_METHOD]: noOpMapper,
      [ATTR_HTTP_METHOD]: noOpMapper,
      [ATTR_SERVER_ADDRESS]: noOpMapper,
      [ATTR_NET_PEER_NAME]: noOpMapper,
      [ATTR_SERVER_PORT]: noOpMapper,
      [ATTR_NET_PEER_PORT]: noOpMapper,
      [ATTR_HTTP_RES_STATUS_CODE]: statusCode,
      [ATTR_HTTP_STATUS_CODE]: statusCode,
      [ATTR_HTTP_STATUS_TEXT]: statusText,
      [ATTR_FULL_URL]: noOpMapper,
      [ATTR_HTTP_URL]: noOpMapper,
      [ATTR_URL_QUERY]: noOpMapper
    }
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
  }

  /**
   * Detect messaging consumer attributes in the OTEL span and add them
   * to the New Relic transaction. Note: this method ends the current
   * transaction.
   *
   * @param {object} params
   * @param {object} params.span The OTEL span entity that possibly contains
   * desired attributes.
   * @param {Transaction} params.transaction The NR transaction to attach
   * the found attributes to.
   */
  reconcileConsumerAttributes({ span, transaction }) {
    const baseSegment = transaction.baseSegment
    const trace = transaction.trace
    const isHighSecurity = this.agent.config.high_security ?? false

    const queueNameMapper = (value) => {
      if (isHighSecurity === true) return
      trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'message.queueName', value)
      baseSegment.addAttribute('message.queueName', value)
    }
    const mapper = {
      [ATTR_SERVER_ADDRESS]: (value) => baseSegment.addAttribute('host', value),
      [ATTR_SERVER_PORT]: (value) => baseSegment.addAttribute('port', value),
      [ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY]: (value) => {
        if (isHighSecurity === true) return
        trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'message.routingKey', value)
      },
      [ATTR_MESSAGING_DESTINATION_NAME]: queueNameMapper,
      [ATTR_MESSAGING_DESTINATION]: queueNameMapper
    }

    this.#reconciler.reconcile({ segment: baseSegment, otelSpan: span, mapper })

    transaction.end()
  }

  reconcileServerAttributes({ segment, span, transaction }) {
    if (span.attributes[ATTR_RPC_SYSTEM]) {
      this.reconcileRpcAttributes({ segment, span, transaction })
    } else {
      this.reconcileHttpAttributes({ segment, span, transaction })
    }

    // If `http.route` was not emitted on server span, name the transaction from the path
    // to avoid transactions being named `*`
    if (transaction.parsedUrl) {
      transaction.nameState.appendPathIfEmpty(transaction.parsedUrl?.path)
    }
    // Add the status code to transaction name
    if (transaction.statusCode) {
      transaction.finalizeNameFromUri(transaction.parsedUrl, transaction.statusCode)
    }
    // End the corresponding transaction for the entry point server span.
    // We do then when the span ends to ensure all data has been processed
    // for the corresponding server span.
    transaction.end()
  }

  reconcileHttpAttributes({ segment, span, transaction }) {
    const status = (value) => {
      transaction.statusCode = value
      transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'http.statusCode', value)
    }
    const port = (value) => segment.addAttribute('port', value)
    const host = (value) => segment.addAttribute('host', value)
    const mapper = {
      // TODO: if route params are available, assign them as well
      [ATTR_HTTP_ROUTE]: (value) => {
        transaction.nameState.appendPath(value)
        segment.addAttribute('http.route', value)
      },
      [ATTR_HTTP_STATUS_CODE]: status,
      [ATTR_HTTP_RES_STATUS_CODE]: status,
      [ATTR_HTTP_STATUS_TEXT]: (value) => {
        transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'http.statusText', value)
      },
      [ATTR_SERVER_PORT]: port,
      [ATTR_NET_HOST_PORT]: port,
      [ATTR_SERVER_ADDRESS]: host,
      [ATTR_NET_HOST_NAME]: host
    }
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })

    // TODO: otel instrumentation does not collect headers
    // a customer can specify which ones, we also specify this
    // so i think we'd have to cross reference our list
    // it also looks like we add all headers to the trace
    // this isn't doing that
  }

  // TODO: our grpc instrumentation handles errors when the status code is not 0
  // we should prob do this here too
  reconcileRpcAttributes({ segment, span, transaction }) {
    const mapper = {
      [ATTR_GRPC_STATUS_CODE]: (value) => {
        transaction.trace.attributes.addAttribute(DESTINATIONS.TRANS_COMMON, 'response.status', value)
        segment.addAttribute(ATTR_GRPC_STATUS_CODE, value)
      }
    }
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
  }

  reconcileDbAttributes({ segment, span }) {
    const mapper = {
      [ATTR_NET_PEER_PORT]: (value) => {
        segment.addAttribute('port_path_or_id', value)
      },
      [ATTR_NET_PEER_NAME]: (value) => {
        segment.addAttribute('host', value)
      },
      [ATTR_DB_NAME]: (value) => {
        segment.addAttribute('database_name', value)
      },
      [ATTR_DB_SYSTEM]: (value) => {
        segment.addAttribute('product', value)
        /*
         * This attribute was collected in `onStart`
         * and was passed to `ParsedStatement`. It adds
         * this segment attribute as `sql` or `sql_obfuscated`
         * and then when the span is built from segment
         * re-assigns to `db.statement`. This needs
         * to be skipped because it will be the raw value.
         */
      },
      [ATTR_DB_STATEMENT]: () => { }
    }
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
  }

  reconcileProducerAttributes({ segment, span }) {
    const mapper = {
      [ATTR_SERVER_ADDRESS]: (value) => segment.addAttribute('host', value),
      [ATTR_SERVER_PORT]: (value) => segment.addAttribute('port', value),
      [ATTR_MESSAGING_MESSAGE_CONVERSATION_ID]: (value) => segment.addAttribute('correlation_id', value),
      [ATTR_MESSAGING_RABBITMQ_DESTINATION_ROUTING_KEY]: (value) => segment.addAttribute('routing_key', value)
    }

    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
  }

  addAWSLinkingAttributes({ segment, span }) {
    const accountId = this.agent?.config?.cloud?.aws?.account_id
    const region = span.attributes['faas.invoked_region'] ?? span.attributes['aws.region'] // faas.invoked_region is for Lambda and takes precedence

    // DynamoDB
    if (span.attributes[ATTR_DB_SYSTEM] === DB_SYSTEM_VALUES.DYNAMODB ||
      span.attributes[ATTR_RPC_SERVICE]?.toLowerCase() === 'dynamodb'
    ) {
      const collection = span.attributes?.['aws.dynamodb.table_names'][0]
      if (region && accountId && collection) {
        segment.addAttribute('cloud.resource_id', `arn:aws:dynamodb:${region}:${accountId}:table/${collection}`)
      }
    }

    // Lambda
    if (span.attributes[ATTR_FAAS_INVOKED_PROVIDER] === 'aws') {
      const functionName = span.attributes['faas.invoked_name']
      if (region && accountId && functionName) {
        segment.addAttribute('cloud.platform', 'aws_lambda')
        segment.addAttribute('cloud.resource_id', `arn:aws:lambda:${region}:${accountId}:function:${functionName}`)
      }
    }

    // SQS
    if (span.attributes[ATTR_RPC_SERVICE]?.toLowerCase() === 'sqs') {
      if (accountId) {
        segment.addAttribute('cloud.account.id', accountId)
      }
      if (region) {
        segment.addAttribute('cloud.region', region)
      }
      const messagingDestination = span.attributes[ATTR_MESSAGING_DESTINATION]
      segment.addAttribute('messaging.destination.name', messagingDestination)
      segment.addAttribute('messaging.system', 'aws_sqs')
    }
  }
}
