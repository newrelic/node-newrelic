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
  DB_SYSTEM_VALUES,
  SPAN_STATUS_CODE
} = require('./constants')
const { dbMapper, dbAttr } = require('./attr-mapping/db')
const { clientMapper, httpAttr, rpcMapper, serverMapper } = require('./attr-mapping/http')
const { msgAttr, consumerMapper, producerMapper } = require('./attr-mapping/messaging')
const { faasAttr } = require('./attr-mapping/faas')
const { exceptionAttr } = require('./attr-mapping/exceptions')

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
        const msg = exceptionAttr({ key: 'msg', span: err }) ?? `Error from ${segment.name}`
        const stack = exceptionAttr({ key: 'stack', span: err })
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
    } else if (span.kind === SpanKind.CLIENT && dbAttr({ key: 'system', span })) {
      this.reconcileDbAttributes({ segment, span })
    } else if (span.kind === SpanKind.CONSUMER) {
      this.reconcileConsumerAttributes({ segment, span, transaction })
    } else if (span.kind === SpanKind.PRODUCER) {
      this.reconcileProducerAttributes({ segment, span })
    } else if (span.kind === SpanKind.CLIENT && httpAttr({ key: 'method', span })) {
      this.reconcileHttpExternalAttributes({ segment, span })
    } else {
      this.#reconciler.reconcile({ segment, otelSpan: span })
    }

    this.addAWSLinkingAttributes({ segment, span })
  }

  reconcileHttpExternalAttributes({ segment, span }) {
    const mapper = clientMapper({ segment })
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
  }

  /**
   * Detect messaging consumer attributes in the OTEL span and add them
   * to the New Relic transaction. Note: this method ends the current
   * transaction.
   *
   * @param {object} params to function
   * @param {object} params.span The OTEL span entity that possibly contains
   * desired attributes.
   * @param {Transaction} params.transaction The NR transaction to attach
   * the found attributes to.
   */
  reconcileConsumerAttributes({ span, transaction }) {
    const { baseSegment } = transaction
    const mapper = consumerMapper({ transaction })
    this.#reconciler.reconcile({ segment: baseSegment, otelSpan: span, mapper })

    transaction.end()
  }

  reconcileServerAttributes({ segment, span, transaction }) {
    const rpcSystem = httpAttr({ key: 'rpcSystem', span })
    if (rpcSystem) {
      this.reconcileRpcServerAttributes({ segment, span, transaction })
    } else {
      this.reconcileHttpServerAttributes({ segment, span, transaction })
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

  reconcileHttpServerAttributes({ segment, span, transaction }) {
    const mapper = serverMapper({ segment, transaction })
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
    // TODO: otel instrumentation does not collect headers
    // a customer can specify which ones, we also specify this
    // so i think we'd have to cross reference our list
    // it also looks like we add all headers to the trace
    // this isn't doing that
  }

  // TODO: our grpc instrumentation handles errors when the status code is not 0
  // we should prob do this here too
  reconcileRpcServerAttributes({ segment, span, transaction }) {
    const mapper = rpcMapper({ segment, transaction })
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
  }

  reconcileDbAttributes({ segment, span }) {
    const mapper = dbMapper({ segment })
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
  }

  reconcileProducerAttributes({ segment, span }) {
    const mapper = producerMapper({ segment })
    this.#reconciler.reconcile({ segment, otelSpan: span, mapper })
  }

  addAWSLinkingAttributes({ segment, span }) {
    const accountId = this.agent?.config?.cloud?.aws?.account_id
    const region = faasAttr({ key: 'region', span })
    const serviceName = httpAttr({ key: 'rpcService', span })

    // DynamoDB
    if (dbAttr({ key: 'system', span }) === DB_SYSTEM_VALUES.DYNAMODB ||
      serviceName?.toLowerCase() === 'dynamodb'
    ) {
      const value = dbAttr({ key: 'dynamoTable', span })
      const collection = value?.[0]
      if (region && accountId && collection) {
        segment.addAttribute('cloud.resource_id', `arn:aws:dynamodb:${region}:${accountId}:table/${collection}`)
      }
    }

    // Lambda
    if (faasAttr({ key: 'provider', span }) === 'aws') {
      const functionName = faasAttr({ key: 'name', span })
      if (region && accountId && functionName) {
        segment.addAttribute('cloud.platform', 'aws_lambda')
        segment.addAttribute('cloud.resource_id', `arn:aws:lambda:${region}:${accountId}:function:${functionName}`)
      }
    }

    // SQS
    if (serviceName?.toLowerCase() === 'sqs') {
      if (accountId) {
        segment.addAttribute('cloud.account.id', accountId)
      }
      if (region) {
        segment.addAttribute('cloud.region', region)
      }
      const messagingDestination = msgAttr({ key: 'destination', span })
      segment.addAttribute('messaging.destination.name', messagingDestination)
      segment.addAttribute('messaging.system', 'aws_sqs')
    }
  }
}
