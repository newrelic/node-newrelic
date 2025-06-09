/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const {
  AggregationTemporality,
  AggregationType
} = require('@opentelemetry/sdk-metrics')

/**
 * ProxyingExporter implements the `PushMetricExporter` interface. It stores
 * a reference to an actual exporter implementation and forwards all method
 * invocations to that underlying exporter. The benefit is that we can swap
 * out exporters in order to get around the limitations imposed by those
 * exporters. In particular, we can initially use an in-memory exporter to
 * collect metrics prior to the agent entering its ready state, and then swap
 * in an OTLP exporter configured from the agent details that have been
 * solidified during the agent's bootup process. We need to do this because
 * the OTLP exporter does not allow for changing the URL after it has been
 * constructed, and our agent _may_ receive a different destination URL
 * from the server during the bootup process. Since the `MeterProvider` is
 * the object that keeps references to any metrics recorders, the provider
 * stores a reference to the exporter, and the provider is an immutable
 * object, we can't simply create new instances.
 *
 * 1. We wouldn't be able to replace the existing exporter.
 * 2. Replacing the provider would mean all previously created recorders would
 * need to be re-created, or else they wouldn't actually record anything.
 *
 * @see https://github.com/open-telemetry/opentelemetry-js/blob/8dc74e6/packages/sdk-metrics/src/export/MetricExporter.ts#L28
 */
class ProxyingExporter {
  #exporter

  constructor({ exporter }) {
    this.exporter = exporter
  }

  get exporter() {
    return this.#exporter
  }

  set exporter(value) {
    this.#exporter = value
  }

  export(...args) {
    return this.#exporter.export.apply(this.#exporter, args)
  }

  forceFlush() {
    return this.#exporter.forceFlush()
  }

  selectAggregation(...args) {
    // Falls back to the default as shown in:
    // https://github.com/open-telemetry/opentelemetry-js/blob/8dc74e6/packages/sdk-metrics/src/export/AggregationSelector.ts#L35
    return this.#exporter.selectAggregation?.apply(this.#exporter, args) ?? { type: AggregationType.DEFAULT }
  }

  selectAggregationTemporality(...args) {
    // Falls back to the default as shown in:
    // https://github.com/open-telemetry/opentelemetry-js/blob/8dc74e6/packages/sdk-metrics/src/export/AggregationSelector.ts#L42
    return this.#exporter.selectAggregationTemporality?.apply(this.#exporter, args) ?? AggregationTemporality.DELTA
  }

  shutdown() {
    return this.#exporter.shutdown()
  }
}

module.exports = ProxyingExporter
