/*
 * Copyright 2022 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import newrelic from './index.js'
import shimmer from './lib/shimmer.js'
import loggingModule from './lib/logger.js'
import NAMES from './lib/metrics/names.js'
import semver from 'semver'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const isSupportedVersion = () => semver.gte(process.version, 'v16.12.0')
// This check will prevent resolve hooks executing from within this file
// If I do `import('foo')` in here it'll hit the resolve hook multiple times
const isFromEsmLoader = (context) =>
  context && context.parentURL && context.parentURL.includes('newrelic/esm-loader.mjs')

const logger = loggingModule.child({ component: 'esm-loader' })
const esmShimPath = new URL('./lib/esm-shim.mjs', import.meta.url)
const customEntryPoint = newrelic?.agent?.config?.api.esm.custom_instrumentation_entrypoint

// Hook point within agent for customers to register their custom instrumentation.
if (customEntryPoint) {
  const resolvedEntryPoint = path.resolve(customEntryPoint)
  logger.debug('Registering custom ESM instrumentation at %s', resolvedEntryPoint)
  await import(resolvedEntryPoint)
}

addESMSupportabilityMetrics(newrelic.agent)

// exporting for testing purposes
export const registeredSpecifiers = new Map()

/**
 * Hook chain responsible for resolving a file URL for a given module specifier
 *
 * Our loader has to be the last user-supplied loader if chaining is happening,
 * as we rely on `nextResolve` being the default Node.js resolve hook to get our URL
 *
 * Docs: https://nodejs.org/api/esm.html#resolvespecifier-context-nextresolve
 *
 * @param {string} specifier string identifier in an import statement or import() expression
 * @param {object} context metadata about the specifier, including url of the parent module and any import assertions
 *        Optional argument that only needs to be passed when changed
 * @param {Function} nextResolve The subsequent resolve hook in the chain, or the Node.js default resolve hook after the last user-supplied resolve hook
 * @returns {Promise} Promise object representing the resolution of a given specifier
 */
export async function resolve(specifier, context, nextResolve) {
  if (!newrelic.agent || !isSupportedVersion() || isFromEsmLoader(context)) {
    return nextResolve(specifier, context, nextResolve)
  }

  /**
   * We manually call the default Node.js resolve hook so
   * that we can get the fully qualified URL path and the
   * package type (commonjs/module/builtin) without
   * duplicating the logic of the Node.js hook
   */
  const resolvedModule = await nextResolve(specifier, context, nextResolve)
  const instrumentationName = shimmer.getInstrumentationNameFromModuleName(specifier)
  const instrumentationDefinition = shimmer.registeredInstrumentations[instrumentationName]

  if (instrumentationDefinition) {
    const { url, format } = resolvedModule
    logger.debug(`Instrumentation exists for ${specifier} ${format} package.`)

    if (registeredSpecifiers.get(url)) {
      logger.debug(
        `Instrumentation already registered for ${specifier} under ${fileURLToPath(
          url
        )}, skipping resolve hook...`
      )
    } else if (format === 'commonjs') {
      // ES Modules translate import statements into fully qualified filepaths, so we create a copy of our instrumentation under this filepath
      const instrumentationDefinitionCopy = [...instrumentationDefinition]

      instrumentationDefinitionCopy.forEach((copy) => {
        // Stripping the prefix is necessary because the code downstream gets this url without it
        copy.moduleName = fileURLToPath(url)

        // Added to keep our Supportability metrics from exploding/including customer info via full filepath
        copy.specifier = specifier
        shimmer.registerInstrumentation(copy)
        logger.debug(
          `Registered CommonJS instrumentation for ${specifier} under ${copy.moduleName}`
        )
      })

      // Keep track of what we've registered so we don't double register (see: https://github.com/newrelic/node-newrelic/issues/1646)
      registeredSpecifiers.set(url, { specifier })
    } else if (format === 'module') {
      addNrInstrumentation(resolvedModule)
      registeredSpecifiers.set(url, { specifier, hasNrInstrumentation: true })
    } else {
      logger.debug(`${specifier} is not a CommonJS nor ESM package, skipping for now.`)
    }
  }

  return resolvedModule
}

/**
 * This is purely done so that we can import the incoming specifier
 * in the load hook.  It used to be used to determine if instrumentation existed
 * for specifier but we found a RCE with that solution.
 *
 * @param {object} resolvedModule the result of call resolve on a specifier
 */
function addNrInstrumentation(resolvedModule) {
  const modifiedUrl = new URL(resolvedModule.url)
  modifiedUrl.searchParams.set('hasNrInstrumentation', 'true')
  resolvedModule.url = modifiedUrl.href
}

/**
 * Extracts the href without query params
 *
 * @param {string} url url of specifier
 * @returns {string} new url without hasNrInstrumentation query param
 */
function removeNrInstrumentation(url) {
  let parsedUrl

  try {
    parsedUrl = new URL(url)
    url = parsedUrl.href.split('?')[0]
  } catch (err) {
    logger.error('Unable to parse url: %s, msg: %s', url, err.message)
  }

  return url
}

/**
 * Hook chain responsible for determining how a URL should be interpreted, retrieved, and parsed.
 *
 * Our loader has to be the last user-supplied loader if chaining is happening,
 * as we rely on `nextLoad` being the default Node.js resolve hook to load the ESM.
 *
 * Docs: https://nodejs.org/dist/latest-v18.x/docs/api/esm.html#loadurl-context-nextload
 *
 * @param {string} url the URL returned by the resolve chain
 * @param {object} context metadata about the url, including conditions, format and import assertions
 * @param {Function} nextLoad the subsequent load hook in the chain, or the Node.js default load hook after the last user-supplied load hook
 * @returns {Promise} Promise object representing the load of a given url
 */
export async function load(url, context, nextLoad) {
  if (!newrelic.agent || !isSupportedVersion()) {
    return nextLoad(url, context, nextLoad)
  }

  url = removeNrInstrumentation(url)

  const pkg = registeredSpecifiers.get(url)

  if (!pkg?.hasNrInstrumentation) {
    return nextLoad(url, context, nextLoad)
  }

  const { specifier } = pkg

  const rewrittenSource = await wrapEsmSource(url, specifier)
  logger.debug(`Registered module instrumentation for ${specifier}.`)

  return {
    format: 'module',
    source: rewrittenSource,
    shortCircuit: true
  }
}

/**
 * Helper function for determining which of our Supportability metrics to use for the current loader invocation
 *
 * @param {object} agent
 *        instantiation of the New Relic agent
 * @returns {void}
 */
function addESMSupportabilityMetrics(agent) {
  if (!agent) {
    return
  }

  if (isSupportedVersion()) {
    agent.metrics.getOrCreateMetric(NAMES.FEATURES.ESM.LOADER).incrementCallCount()
  } else {
    logger.warn(
      'New Relic for Node.js ESM loader requires a version of Node >= v16.12.0; your version is %s.  Instrumentation will not be registered.',
      process.version
    )
    agent.metrics.getOrCreateMetric(NAMES.FEATURES.ESM.UNSUPPORTED_LOADER).incrementCallCount()
  }

  if (customEntryPoint) {
    agent.metrics.getOrCreateMetric(NAMES.FEATURES.ESM.CUSTOM_INSTRUMENTATION).incrementCallCount()
  }
}

/**
 * Rewrites the source code of a ES module we want to instrument.
 * This is done by injecting the ESM shim which proxies every property on the exported
 * module and registers the module with shimmer so instrumentation can be registered properly.
 *
 * Note: this autogenerated code _requires_ that the import have the file:// prefix!
 * Without it, Node.js throws an ERR_INVALID_URL error: you've been warned.
 *
 * @param {string} url the URL returned by the resolve chain
 * @param {string} specifier string identifier in an import statement or import() expression
 * @returns {string} source code rewritten to wrap with our esm-shim
 */
async function wrapEsmSource(url, specifier) {
  const pkg = await import(url)
  const props = Object.keys(pkg)
  const trimmedUrl = fileURLToPath(url)

  return `
    import wrapModule from '${esmShimPath.href}'
    import * as _originalModule from '${url}'
    const _wrappedModule = wrapModule(_originalModule, '${specifier}', '${trimmedUrl}')
    ${props
      .map((propName) => {
        return `
    let _${propName} = _wrappedModule.${propName}
    export { _${propName} as ${propName} }`
      })
      .join('\n')}
  `
}
