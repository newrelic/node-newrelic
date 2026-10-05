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
// Manually adding domain as it is registered separately in shimmer
corePkgs.push('domain')
pkgNames.push(...corePkgs)

// Packages are normally enabled without any extra
// configuration. This list is a set of packages that
// we want to be disabled without any extra configuration.
// Typically, this is because the instrumentation no longer
// provides useful data. Users can still enable them if they
// are interested in the instrumentation they provide.
const disabledPkgs = ['timers']

const blockDescription = [
  'Stanza that contains all keys to disable core & 3rd party package ' +
  'instrumentation(i.e. dns, http, mongodb, pg, redis, etc) **Note**: ' +
  'Disabling a given library may affect the instrumentation of libraries ' +
  'used after the disabled library. Use at your own risk.'
].join('')

function instrumentationConfig(enabled = true) {
  return {
    type: 'object',
    additionalProperties: true,
    properties: {
      enabled: {
        type: 'boolean',
        default: enabled,
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
  const disable = disabledPkgs.includes(pkg) === false
  schema.properties[pkg] = instrumentationConfig(disable)
}

module.exports = schema
