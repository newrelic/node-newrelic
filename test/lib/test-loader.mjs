/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

// TODO: move this whole file into the test area


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

const instrumentedSpecifiers = new Map()

export async function resolve(specifier, context, nextResolve) {
  const resolvedModuleDetails = await nextResolve(specifier)
  const { url, format } = resolvedModuleDetails

  const instrumentation = shimmer.getInstrumentationNameFromModuleName(specifier)

  const registeredInstrumentation = shimmer.registeredInstrumentations[instrumentation]
  if (registeredInstrumentation) {
    instrumentedSpecifiers.set(url, specifier)
    const loader = await lazyLoadLoader()

    return loader.resolve(specifier, context, nextResolve)
  }

  /**
   * Changes the resolution url of the agent. by loading the `test/lib/agent-api-test-module.cjs` proxy
   */
  if (context.parentURL && context.parentURL.indexOf('esm-loader.mjs') >= 0 && specifier === './index.js') {
    // Nothing to see here, look over there
    return {
      url: TEST_AGENT_API_URL.href,
      format: format,
      shortCircuit: true
    }
  }

  return resolvedModuleDetails
}
