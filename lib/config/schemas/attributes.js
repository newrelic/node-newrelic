/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

module.exports = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'attributes.js',
  type: 'object',
  properties: {
    enabled: {
      type: 'boolean',
      default: true,
      description: 'If `true`, enables capture of attributes for all destinations. If there are specific parameters you want ignored, use `attributes.exclude`.'
    },
    value_size_limit: {
      type: 'integer',
      default: 256,
      maximum: 4096,
      description: "Defines the number of characters allowed for each individual attribute's value. The default is 256 characters, with a maximum of 4,096."
    },
    exclude: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: [],
      description: 'Prefix of attributes to exclude from all destinations. Allows * as wildcard at end. NOTE: If excluding headers, they must be in camelCase form to be filtered.'
    },
    include: {
      type: 'array',
      items: {
        type: 'string'
      },
      default: [],
      description: 'Prefix of attributes to include in all destinations. Allows * as wildcard at end. NOTE: If including headers, they must be in camelCase form to be filtered.'
    },
    include_enabled: {
      type: 'boolean',
      default: true,
      description: 'If `true`, patterns may be added to the `attributes.include` list.'
    },
    filter_cache_limit: {
      type: 'integer',
      default: 1000,
      description: 'Controls how many attribute include/exclude rule results are cached by the filter. Increasing this limit will cause greater memory usage and is only necessary if you have an extremely high variety of attributes.'
    }
  },
  additionalProperties: true,
  description: 'Attributes are key-value pairs containing information that determines the properties of an event or transaction.'
}
