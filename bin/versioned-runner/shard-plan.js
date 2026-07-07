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
// Outputs two values, written to `$GITHUB_OUTPUT` when present (otherwise
// stdout for local inspection):
//   - shards: a JSON array of shard index strings, e.g. ["0","1","2","3"]
//   - dirmap: a JSON object of shard index -> space separated suite dir names
//
// A suite dir qualifies if it is a directory containing a `package.json`. This
// naturally excludes stray files such as the `*.md` notes in `test/versioned/`.

const fs = require('fs')
const path = require('path')

const VERSIONED_DIR = path.join(process.cwd(), 'test', 'versioned')
const SHARD_SIZE = parseInt(process.env.SHARD_SIZE, 10) || 5

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

function main() {
  const suites = listSuites()
  if (!suites.length) {
    throw new Error(`No versioned test suites found in ${VERSIONED_DIR}`)
  }

  const dirmap = planShards(suites, SHARD_SIZE)
  const shards = Object.keys(dirmap)

  const dirmapOut = {}
  for (const shard of shards) {
    dirmapOut[shard] = dirmap[shard].join(' ')
  }

  const shardsLine = `shards=${JSON.stringify(shards)}`
  const dirmapLine = `dirmap=${JSON.stringify(dirmapOut)}`

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `${shardsLine}\n${dirmapLine}\n`)
  }

  // Always echo for logs / local inspection.
  console.log(shardsLine)
  console.log(dirmapLine)
}

main()
