/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

/**
 * Minimal stand-in for `@opentelemetry/resources`' `ResourceImpl`. Only
 * implements the members `@opentelemetry/sdk-metrics` actually touches:
 * `attributes`, `asyncAttributesPending`, and `waitForAsyncAttributes`.
 */
class NrResource {
  #attributes

  constructor(attributes = {}) {
    this.#attributes = {}
    for (const [key, value] of Object.entries(attributes)) {
      if (value != null) {
        this.#attributes[key] = value
      }
    }
  }

  get attributes() {
    return this.#attributes
  }

  get asyncAttributesPending() {
    return false
  }

  async waitForAsyncAttributes() {}
}

/**
 * Builds a resource object compatible with `@opentelemetry/sdk-metrics`'
 * expectations.
 *
 * @param {object} attributes Resource attributes.
 * @returns {NrResource} The resource instance.
 */
function resourceFromAttributes(attributes) {
  return new NrResource(attributes)
}

module.exports = { NrResource, resourceFromAttributes }
