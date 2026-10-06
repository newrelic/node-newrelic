/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

/* eslint-disable n/no-unsupported-features/node-builtins,no-console */

import vm from 'node:vm'
import { dirname, extname, join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import validateConfig from '#agentlib/config/validate-config.js'

const FORMAT_TYPE = {
  HUMAN: 'human',
  JSON: 'json'
}

const SOURCE_TYPE = {
  CJS: 'cjs',
  ESM: 'esm',
  JSON: 'json',
  UNKNOWN: 'unknown'
}

let writeOutput

export default async function validateCliConfig({
  input = process.stdin,
  format = FORMAT_TYPE.HUMAN,
  filePath
} = {}) {
  let toValidate = ''
  await new Promise((resolve, reject) => {
    input.on('data', (d) => {
      toValidate += d.toString('utf-8')
    })
    input.on('end', resolve)
    input.on('error', reject)
  })

  writeOutput = format === FORMAT_TYPE.HUMAN
    ? writeHuman
    : writeJson

  if (!filePath) {
    return validateStdin(toValidate)
  }
  return validateFile(toValidate, filePath)
}

async function validateFile(source, filePath) {
  let config
  switch (detectFormatFromPath(filePath, source)) {
    case SOURCE_TYPE.CJS: {
      config = loadCjs(source)
      break
    }

    case SOURCE_TYPE.ESM: {
      config = await loadEsm(source)
      break
    }

    case SOURCE_TYPE.JSON: {
      config = JSON.parse(source)
      break
    }

    case SOURCE_TYPE.UNKNOWN: {
      throw Error(`Could not detect source type of file "${filePath}".`)
    }
  }

  const result = validateConfig(config, false)
  if (result.status === 0) {
    process.exitCode = 0
  }
  writeOutput(result.errors)
}

async function validateStdin(source) {
  let config
  switch (detectFormatFromSource(source)) {
    case SOURCE_TYPE.CJS: {
      config = loadCjs(source)
      break
    }

    case SOURCE_TYPE.ESM: {
      config = await loadEsm(source)
      break
    }

    case SOURCE_TYPE.JSON: {
      config = JSON.parse(source)
      break
    }

    case SOURCE_TYPE.UNKNOWN: {
      throw Error('Could not detect source type provided via stdin.')
    }
  }

  const result = validateConfig(config, false)
  if (result.status === 0) {
    process.exitCode = 0
  }

  writeOutput(result.errors)
}

function detectFormatFromPath(filePath, source) {
  switch (extname(filePath)) {
    case '.cjs': return SOURCE_TYPE.CJS
    case '.mjs': return SOURCE_TYPE.ESM
    case '.json': return SOURCE_TYPE.JSON
    case '.js': return detectFormatFromSource(source)
    default: return SOURCE_TYPE.UNKNOWN
  }
}

function detectFormatFromSource(source) {
  if (/export const config/.test(source) === true) return SOURCE_TYPE.ESM
  if (/module\.exports =/.test(source) === true) return SOURCE_TYPE.CJS
  if (source.charAt(0) === '{') return SOURCE_TYPE.JSON
  return SOURCE_TYPE.UNKNOWN
}

/**
 * Given a CJS source string, load the module as Node.js normally would
 * and return the object assigned to `module.exports`.
 *
 * @param {string} source The CJS source to parse.
 * @param {string} [anchorPath] File path that points to the source file.
 * When reading from stdin, this will be empty. Otherwise, it should be
 * the full path to the script file.
 *
 * @returns {*} The entity assigned to `module.exports`.
 */
function loadCjs(source, anchorPath) {
  if (!anchorPath) {
    anchorPath = join(process.cwd(), 'tmp-mod.js')
  }

  const require = createRequire(anchorPath)
  const module = { exports: {} }
  const dir = dirname(anchorPath)
  const wrapper = vm.compileFunction(
    source,
    ['exports', 'require', 'module', '__filename', '__dirname'],
    { filename: anchorPath }
  )
  wrapper(module.exports, require, module, anchorPath, dir)

  return module.exports
}

/**
 * Given an ESM source string, load the module as Node.js normally would
 * and return the object exported as `config`.
 *
 * @param {string} source The ESM source to parse.
 * @param {string} [anchorPath] File path that points to the source file.
 * When reading from stdin, this will be empty. Otherwise, it should be
 * the full path to the script file.
 *
 * @returns {*} The `config` export value.
 */
async function loadEsm(source, anchorPath) {
  if (!anchorPath) {
    anchorPath = join(process.cwd(), 'tmp-mod.mjs')
  }

  const anchorUrl = pathToFileURL(anchorPath).href
  const linked = new Map()

  // eslint-disable-next-line sonarjs/code-eval
  const module = new vm.SourceTextModule(source, {
    identifier: anchorUrl,
    initializeImportMeta(meta) {
      meta.url = anchorUrl
      meta.resolve = (spec) => import.meta.resolve(spec, anchorUrl)
    },
    importModuleDynamically: (spec) => import(import.meta.resolve(spec, anchorUrl))
  })
  await module.link(link)
  await module.evaluate()
  // ESM exports are defined in the namespace. We want the `config` export.
  return module.namespace.config

  async function link(specifier, referrer) {
    const resolvedUrl = import.meta.resolve(specifier, referrer.indentifier)
    if (linked.has(resolvedUrl) === true) return linked.get(resolvedUrl)

    const imported = await import(resolvedUrl)
    const names = new Set(Object.keys(imported))
    names.add('default')

    const synthetic = new vm.SyntheticModule(
      Array.from(names),
      function () { for (const n of names) this.setExport(n, imported[n]) },
      { identifiers: resolvedUrl }
    )
    linked.set(resolvedUrl, synthetic)
    return synthetic
  }
}

function writeHuman(errors) {
  if (errors == null) {
    console.log('No configuration errors detected.')
    return
  }

  console.log('Found the following configuration errors:')
  for (const error of errors) {
    console.log(`  + ${error.instancePath}: ${error.message}`)
  }
}

function writeJson(errors) {
  if (errors == null) {
    console.log(
      JSON.stringify({ status: 0, errors: [] }, null, 2)
    )
    return
  }

  const result = {
    status: 1,
    errors: []
  }
  for (const error of errors) {
    result.errors.push({ [error.instancePath]: error.message })
  }
  console.log(
    JSON.stringify(result, null, 2)
  )
}
