/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises'
import { create } from '@apm-js-collab/code-transformer'
import parse from 'module-details-from-path'
import { fileURLToPath } from 'node:url'
import getPackageVersion from './lib/util/get-package-version.js'
import subscriptions from './lib/subscriber-configs.js'
import createSubscriberConfigs from './lib/subscribers/create-config.js'
const { packages, instrumentations } = createSubscriberConfigs(subscriptions)
const transformers = new Map()

const instrumentator = create(instrumentations)

export async function resolve(specifier, context, nextResolve) {
  const url = await nextResolve(specifier, context)
  const resolvedModule = parse(url.url)
  if (resolvedModule && packages.has(resolvedModule.name)) {
    const path = fileURLToPath(resolvedModule.basedir)
    const version = getPackageVersion(path)
    const transformer = instrumentator.getTransformer(resolvedModule.name, version, resolvedModule.path)
    if (transformer) {
      transformers.set(url.url, transformer)
    }
  }
  return url
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context)
  if (transformers.has(url) === false) {
    return result
  }

  if (result.format === 'commonjs') {
    const parsedUrl = new URL(result.responseURL ?? url)
    result.source ??= await readFile(parsedUrl)
  }

  const code = result.source
  if (code) {
    const transformer = transformers.get(url)
    try {
      const transformedCode = transformer.transform(code.toString('utf8'), 'unknown')
      result.source = transformedCode
      result.shortCircuit = true
    } catch {
    } finally {
      transformer.free()
    }
  }

  return result
}
