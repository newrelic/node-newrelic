/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

const HTTP_LIBRARY = 'http'
const CATEGORIES = {
  HTTP: 'http',
  DATASTORE: 'datastore',
  GENERIC: 'generic'
}

const SPAN_KIND = {
  CONSUMER: 'consumer',
  CLIENT: 'client',
  INTERNAL: 'internal',
  PRODUCER: 'producer',
  SERVER: 'server'
}

const REGEXS = {
  CONSUMER: /^(?:Truncated\/)?OtherTransaction\/Message\//,
  CLIENT: {
    EXTERNAL: /^(?:Truncated\/)?External\//,
    DATASTORE: /^(?:Truncated\/)?Datastore\//,
  },
  PRODUCER: /^(?:Truncated\/)?MessageBroker\//,
  SERVER: /^(?:Truncated\/)?(WebTransaction)\//
}

/**
 * Assigns the appropriate span kind based on the segment name.
 * Does not handle client kind as this is done in the `HttpSpanEvent` and `DatastoreSpanEvent`
 * Our agent has conventions for naming all types of segments.
 * The only place this convention does not exist is within the `api.startWebTransaction`
 * and `api.startBackgroundTransaction`. For those, we have assigned a `spanKind` property
 * on the segment.  We default to `internal` if it cannot match a regex.
 *
 * @param {object} params to function
 * @param {TraceSegment} params.segment segment that is creating span
 * @param {object} params.span span to add `intrinsics['span.kind']`
 */
function addSpanKind({ segment, span }) {
  const intrinsics = span.getIntrinsicAttributes()
  if (!intrinsics['span.kind']) {
    let spanKind
    if (segment.spanKind) {
      spanKind = segment.spanKind
    } else if (REGEXS.CONSUMER.test(segment.name)) {
      spanKind = SPAN_KIND.CONSUMER
    } else if (REGEXS.PRODUCER.test(segment.name)) {
      spanKind = SPAN_KIND.PRODUCER
    } else if (REGEXS.SERVER.test(segment.name)) {
      spanKind = SPAN_KIND.SERVER
    } else {
      spanKind = SPAN_KIND.INTERNAL
    }

    span.addIntrinsicAttribute('span.kind', spanKind)
  }
}

/**
 * Checks if the segment is an entry point span.
 * An entry point span is defined as the base segment of a transaction.
 * @param {object} params to function
 * @param {TraceSegment} params.transaction transaction that is creating span
 * @param {TraceSegment} params.segment segment that is creating span
 * @returns {boolean} true if the segment is an entry point span
 */
function isEntryPointSpan({ transaction, segment }) {
  return transaction?.baseSegment === segment
}

/**
 * Checks if the segment is an exit span.
 * An exit span is defined as a segment that is an external call,
 * datastore operation, or message broker operation.
 * @param {TraceSegment} segment segment that is creating span
 * @returns {boolean} true if the segment is an exit span
 */
function isExitSpan(segment) {
  return REGEXS.CLIENT.EXTERNAL.test(segment.name) || REGEXS.CLIENT.DATASTORE.test(segment.name) || REGEXS.PRODUCER.test(segment.name)
}

/**
 * Determines if a span should be created based on the segment and transaction.
 * If the segment is an entry point span or an exit span, a span should be created.
 * If inProcessSpans is false, a span should always be created.
 * @param {object} params to function
 * @param {boolean} params.entryPoint true if the segment is an entry point span
 * @param {TraceSegment} params.segment segment that is creating span
 * @returns {boolean} true if a span should be created
 */
function shouldCreateSpan({ entryPoint, segment }) {
  return entryPoint ||
         isExitSpan(segment)
}

function reparentSpan({ inProcessSpans, parentId, transaction }) {
  return inProcessSpans ? parentId : transaction?.baseSegment?.id
}

module.exports = {
  HTTP_LIBRARY,
  CATEGORIES,
  SPAN_KIND,
  REGEXS,
  addSpanKind,
  isEntryPointSpan,
  reparentSpan,
  shouldCreateSpan
}
