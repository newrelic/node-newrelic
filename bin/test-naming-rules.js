#! /usr/bin/env node
/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable no-console */

const fs = require('fs')
const path = require('path')
const readline = require('readline')
const urltils = require('../lib/util/urltils')
const MetricNormalizer = require('../lib/metrics/normalizer')

const cwd = process.cwd()
let options = null
if (arrayContainsAny(process.argv, '-h', '-?', '--help')) {
  printHelp()
} else if (process.argv.length === 3) {
  options = { rules: null, urls: path.resolve(cwd, process.argv[2]) }
} else if (process.argv.length === 4) {
  options = {
    rules: path.resolve(cwd, process.argv[2]),
    urls: path.resolve(cwd, process.argv[3])
  }
} else {
  printHelp()
}

run(options)

function printHelp() {
  console.log('Usage:')
  console.log('    newrelic-naming-rules (-h|--help|-?)')
  console.log('    newrelic-naming-rules [<rules>] <urls>')
  console.log('')
  console.log('Runs the configured naming rules against the given set of URLs')
  console.log('and prints out the resulting normalized URLs.')
  console.log('')
  console.log('Parameters:')
  console.log(' <rules>')
  console.log('    Optional. A JSON file containing additional rules to apply')
  console.log('    to the URLs. Should be in the form of an array of arrays:')
  console.log('        [["pattern", "replacement"], [/pattern2/, "replacement2"]]')
  console.log('')
  console.log(' <urls>')
  console.log('    A file containing URLs to test against the naming rules.')
  console.log('    Should contain one URL per line, and only contain the path')
  console.log('    without host or protocol:')
  console.log('        /foo/bar')
  console.log('        /foo/biz')
  console.log('        /fiz/bang')
  console.log('')
  console.log(' -h|--help|-?')
  console.log('    Optional. Prints this help message and exits.')

  process.exit(0)
}

function run(opts) {
  const config = require('../lib/config').initialize()
  const runtimeRules = opts.rules ? require(opts.rules) : null
  let appliedRules = []

  // responsible for handling default rules provided by the server
  const defaultNormalizer = loadDefaultNormalizer(config)

  // rules defined by user in local configuration file
  const userNormalizer = loadUserNormalizer(config, runtimeRules)

  defaultNormalizer.on('appliedRule', onAppliedRule)
  userNormalizer.on('appliedRule', onAppliedRule)

  const urlsFile = fs.createReadStream(opts.urls, { encoding: 'utf-8' })
  const reader = readline.createInterface({ input: urlsFile, output: null })
  reader.on('line', function onUrlLine(urlLine) {
    appliedRules = []
    const scrubbedUrl = urltils.scrub(urlLine)

    let normalized = userNormalizer.normalize(scrubbedUrl)

    if (!normalized.matched) {
      normalized = defaultNormalizer.normalize(scrubbedUrl)
    }

    console.log(urlLine, ' => ', normalized.value)
    if (appliedRules.length === 0) {
      console.log('no rules matched')
    } else {
      for (let i = 0; i < appliedRules.length; i++) {
        const match = appliedRules[i]
        console.log(
          ' %s: %s => %s (rule %s)',
          i + 1,
          match.original,
          match.normalized,
          match.rule.pattern
        )
      }
    }

    console.log('')
  })

  urlsFile.on('end', function onUrlEnd() {
    urlsFile.close()
    reader.close()
  })

  function onAppliedRule(rule, newValue, oldValue) {
    appliedRules.push({
      rule: rule,
      original: oldValue,
      normalized: newValue
    })
  }
}

function loadDefaultNormalizer(config) {
  // Load the normalizer.
  const normalizer = new MetricNormalizer(config, 'URL')

  // Add in the rules the collector would ship down.
  normalizer.load([
    {
      match_expression:
        '.*\\.(ace|arj|ini|txt|udl|plist|css|gif|ico|jpe?g|js|png|swf|woff|caf|' +
        'aiff|m4v|mpe?g|mp3|mp4|mov)$',
      replacement: '/*.\\1',
      replace_all: false,
      each_segment: false,
      ignore: false,
      terminate_chain: true,
      eval_order: 1000
    },
    {
      match_expression: '^[0-9][0-9a-f_,.-]*$',
      replacement: '*',
      replace_all: false,
      each_segment: true,
      ignore: false,
      terminate_chain: false,
      eval_order: 1001
    },
    {
      match_expression: '^(.*)/[0-9][0-9a-f_,-]*\\.([0-9a-z][0-9a-z]*)$',
      replacement: '\\1/.*\\2',
      replace_all: false,
      each_segment: false,
      ignore: false,
      terminate_chain: false,
      eval_order: 1002
    }
  ])

  return normalizer
}

function loadUserNormalizer(config, rules) {
  // Load the normalizer.
  const normalizer = new MetricNormalizer(config, 'user')
  normalizer.loadFromConfig()

  if (rules && rules.length) {
    rules.forEach(function forEachRule(rule) {
      // Add the rule like `API#addNamingRule` would.
      normalizer.addSimple(rule[0], '/' + rule[1])
    })
  }

  return normalizer
}

function arrayContainsAny(array) {
  for (let i = 1; i < arguments.length; ++i) {
    if (array.indexOf(arguments[i]) !== -1) {
      return true
    }
  }

  return false
}
