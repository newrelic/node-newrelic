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
const testSpecifiers = new Set()

/**
 * The test loader resolve hook does 2 things:
 *   1. Calls the agent loader if the resolved path matches our registered instrumentation
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
    const resolvedMod = await agentLoader.resolve(specifier, context, nextResolve)
    // In the esm loader resolve we add `hasNrInstrumentation`, so we must track
    // this in a local set because in the load hook below it'll have it in url
    testSpecifiers.add(resolvedMod.url, true)
    return resolvedMod
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

/**
 * Checks that the url is in a local set and passes it off to the
 * real esm loader
 */
export async function load(url, context, nextLoad) {
  if (testSpecifiers.has(url)) {
    const agentLoader = await lazyLoadLoader()
    return agentLoader.load(url, context, nextLoad)
  }

  return nextLoad(url, context, nextLoad)
}
