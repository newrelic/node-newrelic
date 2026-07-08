#! /usr/bin/env node
/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable no-console */

// Partitions the versioned test suites in `test/versioned/` across a number of
// shards so that CI can run them on separate runners in parallel. The suite
// directories are listed in alphabetical order and split into contiguous chunks
// of at most SHARD_SIZE suites; the number of shards is derived from that. Each
// shard therefore holds an alphabetically adjacent run of suites. New suites are
// picked up automatically.
//
// Outputs three values, written to `$GITHUB_OUTPUT` when present (otherwise
// stdout for local inspection):
//   - shards: a JSON array of shard index strings, e.g. ["0","1","2","3"]
//   - dirmap: a JSON object of shard index -> space separated suite dir names
//   - servicemap: a JSON object of shard index -> space separated docker-compose
//     service names that shard's suites need (empty string when none). CI uses
//     this to start only the required services per shard, or skip Docker entirely.
//
// A suite dir qualifies if it is a directory containing a `package.json`. This
// naturally excludes stray files such as the `*.md` notes in `test/versioned/`.
// A suite declares its docker service needs via a top-level `dockerServices`
// array in its package.json; absence means the suite needs no services.

const fs = require('node:fs')
const path = require('node:path')

const VERSIONED_DIR = path.join(process.cwd(), 'test', 'versioned')
const COMPOSE_FILE = path.join(process.cwd(), 'docker-compose.yml')
const SHARD_SIZE = parseInt(process.env.SHARD_SIZE, 10) || 5

/**
 * Parses a `docker-compose.yml` to build an allow list of available Docker
 * services. Services are defined by the key name for each service defined
 * in the `services:` block.
 *
 * @param {string} composeFile File system path to the file to parse.
 *
 * @returns {Set<string>} List of discovered service names.
 */
function knownServices(composeFile = COMPOSE_FILE) {
  const lines = fs.readFileSync(composeFile, 'utf8').split('\n')
  const services = new Set()
  let inServices = false
  for (const line of lines) {
    if (/^services:\s*$/.test(line)) {
      inServices = true
      continue
    }
    if (!inServices) {
      continue
    }
    // A non-indented, non-blank line ends the services block.
    if (/^\S/.test(line)) {
      break
    }
    // Service names are keys indented exactly two spaces: `  <name>:`.
    const match = line.match(/^ {2}([a-zA-Z0-9_-]+):\s*$/)
    if (match) {
      services.add(match[1])
    }
  }
  return services
}

/**
 * Reads the VERSIONED_DIR directory to discover the available test suites.
 * A test suite is a directory that contains a `package.json` manifest as
 * documented in `test/versioned/Readme.md`.
 *
 * @returns {string[]} List of test suites.
 */
function listSuites() {
  return fs
    .readdirSync(VERSIONED_DIR, { withFileTypes: true })
    .filter((entry) => {
      if (!entry.isDirectory()) {
        return false
      }
      return fs.existsSync(path.join(VERSIONED_DIR, entry.name, 'package.json'))
    })
    .map((entry) => entry.name)
    .sort()
}

/**
 * Reads the defined `dockerServices` in a test suite's manifest.
 *
 * @param {string} dir Path to the test suite.
 * @param {Set<string>} known List of known Docker services as provided
 * by `knownServices`.
 *
 * @returns {string[]} List of Docker services the suite requires.
 * @throws Error When an unknown Docker service is encountered.
 */
function readServices(dir, known) {
  const pkg = JSON.parse(
    fs.readFileSync(
      path.join(VERSIONED_DIR, dir, 'package.json'),
      'utf8'
    )
  )
  const services = pkg.dockerServices ?? []
  for (const service of services) {
    if (!known.has(service)) {
      throw new Error(
        `Suite "${dir}" declares unknown docker service "${service}". ` +
          `Known services: ${[...known].sort().join(', ')}.`
      )
    }
  }
  return services
}

/**
 * The `suites` property is really a repeated key-value pair like
 * `0: ['a', 'b', 'c']`.
 *
 * @typedef {object} Shard
 * @property {string[]} suites List of suites.
 */

/**
 * Builds a mapping of shard number to suites in the shard.
 *
 * @param {string[]} suites List of available test suites as returned by
 * `listSuites`.
 * @param {number} shardSize The maximum number of suites to include in
 * each shard.
 *
 * @returns {Shard} Built shards map.
 * @throws Error When a suite has not been assigned to any shards.
 */
function planShards(suites, shardSize) {
  const dirmap = {}

  // Split the alphabetically sorted list into contiguous chunks of at most
  // `shardSize` suites. The number of shards falls out of the suite count.
  for (let i = 0; i < suites.length; i += shardSize) {
    const shard = String(i / shardSize)
    dirmap[shard] = suites.slice(i, i + shardSize)
  }

  // Safety check: `--strict` in the versioned runner only flags files within a
  // listed suite dir; it does NOT catch an entire suite that no shard runs. So
  // verify every suite is assigned exactly once before we hand the plan to CI.
  const assigned = Object.values(dirmap).flat()
  if (assigned.length !== suites.length) {
    throw new Error(
      `Shard plan covers ${assigned.length} suites but found ${suites.length}. ` +
        'Every suite must be assigned exactly once.'
    )
  }
  const assignedSet = new Set(assigned)
  for (const suite of suites) {
    if (!assignedSet.has(suite)) {
      throw new Error(`Suite "${suite}" was not assigned to any shard.`)
    }
  }

  return dirmap
}

/**
 * The `serivces` property is really a repeated key-value pair that looks like
 * `0: ['svc1', 'svc2', 'svc3']`.
 *
 * @typedef {object} ServiceMap
 * @property {string[]} services List of services for the shard.
 */

/**
 * Iterates the shards and suites to build a mapping that indicates which
 * shards needs which Docker services running in order to function correctly.
 *
 * @param {Shard} dirmap Shard as planned by `planShards`.
 * @param {Function} getServices Function the returns the list of services
 * required by the provided suite. Accepts a string suite name.
 *
 * @returns {ServiceMap} The list of services mapped to shards.
 */
function planServices(dirmap, getServices) {
  const servicemap = {}
  for (const [shard, suites] of Object.entries(dirmap)) {
    const services = new Set()
    for (const suite of suites) {
      for (const service of getServices(suite)) {
        services.add(service)
      }
    }
    servicemap[shard] = [...services].sort().join(' ')
  }
  return servicemap
}

function main() {
  const suites = listSuites()
  if (!suites.length) {
    throw new Error(`No versioned test suites found in ${VERSIONED_DIR}`)
  }

  const known = knownServices()
  const dirmap = planShards(suites, SHARD_SIZE)
  const servicemap = planServices(dirmap, (dir) => readServices(dir, known))
  const shards = Object.keys(dirmap)

  const dirmapOut = {}
  for (const shard of shards) {
    dirmapOut[shard] = dirmap[shard].join(' ')
  }

  const shardsLine = `shards=${JSON.stringify(shards)}`
  const dirmapLine = `dirmap=${JSON.stringify(dirmapOut)}`
  const servicemapLine = `servicemap=${JSON.stringify(servicemap)}`

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${shardsLine}\n${dirmapLine}\n${servicemapLine}\n`)
  }

  // Always echo for logs / local inspection.
  console.log(shardsLine)
  console.log(dirmapLine)
  console.log(servicemapLine)
}

if (require.main === module) {
  main()
}

module.exports = {
  knownServices,
  listSuites,
  readServices,
  planShards,
  planServices,
  main
}
