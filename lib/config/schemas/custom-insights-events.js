/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'custom-insights-events.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true,
      description: 'If this is disabled, the agent does not collect, nor try to send, custom event data.'
    },
    max_samples_stored: {
      type: 'integer',
      default: 3000,
      description: "The agent will collect all events up to this number per minute. If there are more than that, a statistical sampling will be collected. Currently this uses a priority sampling algorithm. By increasing this setting you are both increasing the memory requirements of the agent as well as increasing the payload to the New Relic servers. The memory concerns are something you should consider for your own server's sake. The payload of events is compressed, but if it grows too large the New Relic servers may reject it."
    }
  },
  additionalProperties: true,
  description: 'Custom Insights Events Custom insights events are JSON object that are sent to New Relic Insights. You can tell the agent to send your custom events via the `newrelic.recordCustomEvent()` API. These events are sampled once the max queue size is reached. You can tune this setting below. Read more here: http://newrelic.com/insights'
}
