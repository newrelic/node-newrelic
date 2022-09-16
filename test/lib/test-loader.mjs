/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import shimmer from '../../lib/shimmer.js'

let loader = null
let loaderPromise = null
async function lazyLoadLoader() {
  if (!loader) {
    if (!loaderPromise) {
      loaderPromise = import('../../esm-loader.mjs')
    }

    loader = await loaderPromise
    loaderPromise = null
  }

  return loader
}

const TEST_AGENT_API_URL = new URL('./agent-api-test-module.cjs', import.meta.url)

/**
 * The test loader resolve hook does 2 things:
 *   1. Calls the agent loader if the reoslved path matches our registered instrumentation
 *   2. Updates the resolution of the agent API(./index.js in this context) to use a proxy that
 *      gives us a mocked agent
 */
export async function resolve(specifier, context, nextResolve) {
  const resolvedModuleDetails = await nextResolve(specifier)
  const { format } = resolvedModuleDetails

  const instrumentation = shimmer.getInstrumentationNameFromModuleName(specifier)

  const registeredInstrumentation = shimmer.registeredInstrumentations[instrumentation]
  if (registeredInstrumentation) {
    const agentLoader = await lazyLoadLoader()

    return agentLoader.resolve(specifier, context, nextResolve)
  }

  /**
   * Changes the resolution url of the agent. by loading the `test/lib/agent-api-test-module.cjs` proxy
   */
  if (
    context.parentURL &&
    context.parentURL.indexOf('esm-loader.mjs') >= 0 &&
    specifier === './index.js'
  ) {
    // Nothing to see here, look over there
    return {
      url: TEST_AGENT_API_URL.href,
      format,
      shortCircuit: true
    }
  }

  return resolvedModuleDetails
}
