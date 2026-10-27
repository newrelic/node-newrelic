/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const instrumentedLibraries = require('#agentlib/instrumentations.js')()
const coreLibraries = require('#agentlib/core-instrumentation.js')
const subscriptions = require('#agentlib/subscriber-configs.js')

const pkgNames = Object.keys(instrumentedLibraries)
const corePkgs = Object.keys(coreLibraries)
const subscribers = Object.keys(subscriptions)
pkgNames.push(...subscribers)
pkgNames.push(...corePkgs)

// Registered instrumentations that cannot be configured by users,
// so no config is generated for them.
const excludedPkgs = ['globals']

const blockDescription = [
  'Stanza that contains all keys to disable core & 3rd party package ' +
  'instrumentation(i.e. dns, http, mongodb, pg, redis, etc) **Note**: ' +
  'Disabling a given library may affect the instrumentation of libraries ' +
  'used after the disabled library. Use at your own risk.'
].join('')

function instrumentationConfig() {
  return {
    type: 'object',
    additionalProperties: true,
    properties: {
      enabled: {
        type: 'boolean',
        default: true,
        description: 'Whether instrumentation for this module is active.'
      }
    }
  }
}

const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'instrumentation.js',
  type: 'object',
  description: blockDescription,
  additionalProperties: {
    type: 'object',
    additionalProperties: true,
    properties: {
      enabled: {
        type: 'boolean',
        default: true,
        description: 'Whether instrumentation for this module is active.'
      }
    }
  },
  properties: {}
}

for (const pkg of pkgNames.sort()) {
  if (excludedPkgs.includes(pkg) === true) {
    continue
  }
  schema.properties[pkg] = instrumentationConfig()
}

module.exports = schema
