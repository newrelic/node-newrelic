#! /usr/bin/env node
/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable no-console */

// Partitions the versioned test suites in `test/versioned/` across a number of
// shards so that CI can run them on separate runners in parallel. The suite
// directories are ordered with all docker-requiring suites first (alphabetical
// among themselves) followed by all docker-free suites (alphabetical among
// themselves), then split into contiguous chunks of at most SHARD_SIZE suites;
// the number of shards is derived from that. Clustering the docker-requiring
// suites into the earliest shards means the later shards are entirely
// docker-free and skip the Docker startup step. New suites are picked up
// automatically.
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

const fs = require('fs')
const path = require('path')

const VERSIONED_DIR = path.join(process.cwd(), 'test', 'versioned')
const COMPOSE_FILE = path.join(process.cwd(), 'docker-compose.yml')
const SHARD_SIZE = parseInt(process.env.SHARD_SIZE, 10) || 5

// The set of valid docker service names, read from docker-compose.yml so the
// allowlist can never drift from what actually exists. Service names are the
// keys directly under the top-level `services:` block.
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

// Reads a suite's declared docker service dependencies, validating each against
// the known service set to catch typos (an unknown name would silently never
// start, hanging the suite). Absent `dockerServices` means no services.
function readServices(dir, known) {
  const pkg = JSON.parse(fs.readFileSync(path.join(VERSIONED_DIR, dir, 'package.json'), 'utf8'))
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

// Orders suites so every docker-requiring suite comes before every docker-free
// suite, with each group sorted alphabetically. Chunking this list clusters the
// docker-requiring suites into the earliest shards, leaving the later shards
// docker-free. `getServices` maps a suite dir to its service list (injectable
// for testing).
function orderSuites(suites, getServices) {
  const withDocker = []
  const withoutDocker = []
  for (const suite of suites) {
    if (getServices(suite).length > 0) {
      withDocker.push(suite)
    } else {
      withoutDocker.push(suite)
    }
  }
  withDocker.sort()
  withoutDocker.sort()
  return [...withDocker, ...withoutDocker]
}

function planShards(suites, shardSize) {
  const dirmap = {}

  // Split the ordered list into contiguous chunks of at most `shardSize`
  // suites. The number of shards falls out of the suite count.
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

// For each shard, computes the deduped, sorted union of docker services its
// suites need. `getServices` maps a suite dir to its service list (injectable
// for testing); it defaults to reading each suite's package.json.
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
  const getServices = (dir) => readServices(dir, known)
  const ordered = orderSuites(suites, getServices)
  const dirmap = planShards(ordered, SHARD_SIZE)
  const servicemap = planServices(dirmap, getServices)
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
  orderSuites,
  planShards,
  planServices,
  main
}
