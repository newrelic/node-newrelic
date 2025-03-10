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

module.exports = {
  HTTP_LIBRARY,
  CATEGORIES,
  SPAN_KIND,
  REGEXS,
  addSpanKind
}
