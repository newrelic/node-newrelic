/*
 * Copyright 2025 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile } from 'node:fs/promises'
import { create } from '@apm-js-collab/code-transformer'
import parse from 'module-details-from-path'
import { fileURLToPath } from 'node:url'
import getPackageVersion from './lib/util/get-package-version.js'
import subscribers from './lib/instrumentation-subscribers.js'
const transformers = new Map()

const instrumentator = create(subscribers)

export async function resolve(specifier, context, nextResolve) {
  const url = await nextResolve(specifier, context)
  const resolvedModule = parse(url.url)
  if (resolvedModule) {
    const path = fileURLToPath(resolvedModule.basedir)
    const version = getPackageVersion(path, resolvedModule.name)
    const transformer = instrumentator.getTransformer(resolvedModule.name, version, resolvedModule.path)
    if (transformer) {
      transformers.set(url.url, transformer)
    }
  }
  return url
}

export async function load(url, context, nextLoad) {
  const result = await nextLoad(url, context)
  if (transformers.has(url)) {
    if (result.format === 'commonjs') {
      const parsedUrl = new URL(result.responseURL ?? url)
      result.source ??= await readFile(parsedUrl)
    }
    const code = result.source
    if (code) {
      const transformer = transformers.get(url)
      const isEsm = result.format === 'module'
      const transformedCode = transformer.transform(code.toString('utf8'), isEsm)
      transformer.free()
      return {
        format: result.format,
        shortCircuit: true,
        source: transformedCode
      }
    }
  }
  return result
}
