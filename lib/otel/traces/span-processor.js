/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const { hrTimeToMilliseconds } = require('@opentelemetry/core')
const { SpanKind } = require('@opentelemetry/api')
const urltils = require('#agentlib/util/urltils.js')

const AttributeReconciler = require('./attr-reconciler.js')
const SegmentSynthesizer = require('./segment-synthesis.js')
const SpanLink = require('#agentlib/spans/span-link.js')
const TimedEvent = require('#agentlib/spans/timed-event.js')
const normalizeTimestamp = require('../normalize-timestamp.js')
const { otelSynthesis } = require('#agentlib/symbols.js')
const {
  assignToTarget,
  buildRuleMappings,
  extractAttributeValue,
  processRegex,
  transformTemplate
} = require('./utils.js')
const defaultLogger = require('#agentlib/logger.js').child({ component: 'span-processor' })

const {
  SPAN_STATUS_CODE
} = require('./constants')
const exceptionAttr = require('./exception-mapping.js')

module.exports = class NrSpanProcessor {
  #reconciler

  constructor(agent, { logger = defaultLogger } = {}) {
    this.agent = agent
    this.accountId = agent?.config?.cloud?.aws?.account_id
    this.synthesizer = new SegmentSynthesizer(agent)
    this.tracer = agent.tracer
    this.logger = logger

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
   * Finalize the mapping of the OTEL span to the NR `TraceSegment`
   * by copying final attributes over, updating the duration, handling
   * any errors, and ending the transaction if necessary.
   *
   * @param {object} span source otel span
   */
  onEnd(span) {
    if (span[otelSynthesis] && span[otelSynthesis].segment) {
      const { segment, transaction, rule } = span[otelSynthesis]
      const { instrumentationScope } = span

      // OTEL spans have a status attribute. We copy this information over
      // to our agent attributes as informational metadata.
      let code
      switch (span.status.code) {
        case 0: { code = 'unset'; break }
        case 1: { code = 'ok'; break }
        case 2: { code = 'error'; break }
      }
      segment.addAttribute('status.code', code)
      if (code === 'error') {
        segment.addAttribute('status.description', span.status.message)
      }

      // We always attach the instrumentation scope data as agent attributes
      // if the OTEL span has them set.
      // See https://opentelemetry.io/docs/specs/otel/common/mapping-to-non-otlp/#instrumentationscope
      if (typeof instrumentationScope.name === 'string') {
        segment.addAttribute('otel.scope.name', instrumentationScope.name)
        segment.addAttribute('otel.library.name', instrumentationScope.name)
      }
      if (typeof instrumentationScope.version === 'string') {
        segment.addAttribute('otel.scope.version', instrumentationScope.version)
        segment.addAttribute('otel.library.version', instrumentationScope.version)
      }

      this.updateDuration(segment, span)
      this.handleError({ segment, transaction, span })
      this.reconcileLinks({ otelSpan: span, segment })
      this.reconcileEvents({ segment, span })
      this.reconcileAttributes({ segment, span, transaction, rule })
      delete span[otelSynthesis]

      if (span.kind === SpanKind.SERVER || span.kind === SpanKind.CONSUMER) {
        this.finalizeTransaction({ segment, span, transaction, rule, config: this.agent.config })
      }
    }
  }

  /**
   * Adds an error to the transaction if the span has a status code of ERROR
   * and the span has an exception event. The error is created from the exception
   * event attributes and added to the transaction.
   * @param {object} params - The parameters for the error handling.
   * @param {object} params.segment - The segment to add the error to.
   * @param {object} params.transaction - The transaction to add the error to.
   * @param {object} params.span - The span to check for errors.
   */
  handleError({ segment, transaction, span }) {
    if (span?.status?.code === SPAN_STATUS_CODE.ERROR) {
      const errorEvents = span.events.filter((event) => event.name === 'exception')
      for (const err of errorEvents) {
        const msg = exceptionAttr({ key: 'msg', span: err }) ?? `Error from ${segment.name}`
        const stack = exceptionAttr({ key: 'stack', span: err })
        const error = new Error(msg)
        error.stack = stack
        this.agent.errors.add(transaction, error, null, segment)
      }
    }
  }

  /**
   * Updates the segment duration from the span duration
   * @param {object} segment - The segment to update.
   * @param {object} span - The span to get the duration from.
   */
  updateDuration(segment, span) {
    segment.touch()
    const duration = hrTimeToMilliseconds(span.duration)
    segment.overwriteDurationInMillis(duration)
  }

  /**
   * Iterates the span events that have been added to the span and attaches
   * them to the `TraceSegment` in the format expected by the New Relic
   * collector.
   *
   * @param {object} params Function parameters
   * @param {object} params.span The OTEL span that may contain events.
   * @param {object} params.segment The target segment to attach the events to.
   */
  reconcileEvents({ segment, span }) {
    if (span.events.length < 1) {
      return
    }

    const spanContext = span.spanContext()
    for (let i = 0; i < span.events.length; i++) {
      const event = new TimedEvent({
        event: span.events[i],
        spanContext
      })
      segment.addTimedEvent(event)
    }
  }

  /**
   * Iterates the span links that have been added to the span and attaches
   * them to the `TraceSegment` in the format expected by the New Relic
   * collector.
   *
   * @param {object} params Function parameters
   * @param {object} params.otelSpan The OTEL span that may contain links.
   * @param {object} params.segment The target segment to attach the links to.
   */
  reconcileLinks({ otelSpan, segment }) {
    if (otelSpan.links.length < 1) {
      return
    }

    const spanContext = otelSpan.spanContext()
    const timestamp = normalizeTimestamp(otelSpan.startTime)
    for (let i = 0; i < otelSpan.links.length; i += 1) {
      const link = new SpanLink({
        link: otelSpan.links.at(i),
        spanContext,
        timestamp
      })
      segment.addSpanLink(link)
    }
  }

  /**
   * Maps attributes from the span to the segment, transaction or trace
   * based on the transformation rule.
   * @param {object} params - The parameters for the mapping.
   * @param {object} params.segment - The segment to add attributes to.
   * @param {object} params.span - The span to add attributes from.
   * @param {object} params.transaction - The transaction to add attributes to.
   * @param {object} [params.rule] - The transformation rule to use.
   */
  reconcileAttributes({ segment, span, transaction, rule = {} }) {
    const excludeAttributes = new Set()
    for (const attribute of rule.attributes) {
      const { key, target, name, highSecurity, regex } = attribute
      let value = extractAttributeValue({ accountId: this.accountId, attribute, excludeAttributes, span })

      if (this.#reconciler.isHostnameKey(key) === true) {
        value = this.#reconciler.resolveHost(value)
      }

      if (regex) {
        processRegex({ segment, transaction, regex, value })
        continue
      }

      if (highSecurity && this.agent.config.high_security === true) {
        this.logger.debug(`Not adding attribute ${key} to ${target} because it gets dropped as part of high_security mode.`)
        continue
      }

      assignToTarget({ target, name, value, segment, transaction, span })
    }

    this.#reconciler.reconcile({ segment, otelSpan: span, excludeAttributes })
  }

  /**
   * Finalizes the transaction by setting the type, name and URL.
   * If the transaction is a web transaction, it will also set the URL and
   * finalize the name from the URL.
   * @param {object} params - The parameters for the finalization.
   * @param {object} params.rule - The transformation rule to use.
   * @param {object} params.segment - The segment to finalize.
   * @param {object} params.span - The span to pull attributes from.
   * @param {object} params.transaction - The transaction to finalize.
   */
  finalizeTransaction({ rule, segment, span, transaction }) {
    const txTransformation = rule.txTransformation
    transaction.type = txTransformation?.type
    const prefix = span.attributes[txTransformation?.name?.prefix]
    if (prefix) {
      transaction.nameState.setPrefix(prefix)
    }
    const verb = span.attributes[txTransformation?.name?.verb]
    if (verb) {
      transaction.nameState.setVerb(verb)
    }
    const route = span.attributes[txTransformation?.name?.path]
    if (route) {
      transaction.nameState.appendPath(route)
    }

    if (txTransformation?.name?.templatePath) {
      const value = transformTemplate(txTransformation.name.templatePath, span.attributes)
      transaction.nameState.appendPath(value)
    }

    if (txTransformation?.name?.templateValue) {
      const value = transformTemplate(txTransformation.name.templateValue, span.attributes)
      transaction.setPartialName(value)
      segment.setNameFromTransaction(transaction)
    }

    if (txTransformation?.name?.value) {
      transaction.setPartialName(txTransformation.name.value)
      segment.setNameFromTransaction(transaction)
    }

    if (transaction.type === 'web') {
      this.finalizeWebTransaction({ span, transaction, txTransformation })
    }

    // End the corresponding transaction for the entry point server span.
    // We do then when the span ends to ensure all data has been processed
    // for the corresponding server span.
    transaction.end()
  }

  /**
   * Finalizes the web transaction by setting the URL and name.
   * @param {object} params - The parameters for the finalization.
   * @param {object} params.span - The span to pull attributes from.
   * @param {object} params.transaction - The transaction to finalize.
   * @param {object} params.txTransformation - The transformation rule to use.
   */
  finalizeWebTransaction({ span, transaction, txTransformation }) {
    let httpUrl
    if (txTransformation.url?.template) {
      const rules = buildRuleMappings(txTransformation?.url?.mappings)
      httpUrl = transformTemplate(txTransformation.url.template, span.attributes, rules)
    } else if (txTransformation?.url?.key) {
      httpUrl = span.attributes[txTransformation.url.key]
    }

    try {
      const requestUrl = new URL(httpUrl)
      transaction.url = urltils.obfuscatePath(this.agent.config, requestUrl.pathname)
      transaction.applyUserNamingRules(requestUrl.pathname)
      // If `http.route` was not emitted on server span, name the transaction from the path
      // to avoid transactions being named `*`
      transaction.nameState.appendPathIfEmpty(requestUrl.pathname)
    } catch (err) {
      this.logger.debug('Could not parse URL from span for transaction URL: %s, err: %s', httpUrl, err.message)
      transaction.url = httpUrl
    }

    // Add the status code to transaction name
    if (transaction.statusCode) {
      transaction.finalizeNameFromWeb(transaction.statusCode)
    }
  }
}
