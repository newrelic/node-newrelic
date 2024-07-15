/*
 * Copyright 2020 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
/* eslint-disable sonarjs/no-duplicate-string, no-console */

const fs = require('fs/promises')
const { errorAndExit } = require('./utils')

if (process.argv.length !== 4) {
  console.log('Usage: %s %s <baseline> <upstream>', process.argv[0], process.argv[1])
  console.log('  <baseline>   JSON file containing benchmark results for upstream')
  console.log('               upstream comparison.')
  console.log('  <downstream> JSON file containing benchmark results from')
  console.log('               downstream branch to compare against base.')
  process.exit(1)
}

const processFile = async (file) => {
  try {
    const data = await fs.readFile(file, { encoding: 'utf8' })
    return JSON.parse(data)
  } catch (err) {
    return errorAndExit(err, 'Failed to load files.', 2)
  }
}

const reportResults = async (resultFiles) => {
  const baseline = resultFiles[0]
  const downstream = resultFiles[1]

  const baselineFiles = Object.keys(baseline)
  const downstreamFiles = Object.keys(downstream)
  const warnings = []

  diffArrays(baselineFiles, downstreamFiles).forEach((file) => {
    warnings.push(`- **WARNING**: File "${file}" in base but not branch.`)
  })
  diffArrays(downstreamFiles, baselineFiles).forEach((file) => {
    warnings.push(`- **NOTE**: File "${file}" in branch but not base.`)
  })

  let allPassing = true
  const details = baselineFiles
    .sort()
    .map((testFile) => {
      const base = baseline[testFile]
      const down = downstream[testFile]

      if (!down) {
        return [
          '<details>',
          `<summary>${testFile} file missing from branch</summary>`,
          '',
          '</details>'
        ].join('\n')
      }

      let filePassing = true
      const baseTests = Object.keys(base)
      const downTests = Object.keys(down)

      diffArrays(baseTests, downTests).forEach((test) => {
        warnings.push(`- **WARNING**: Test "${test}" in base but not branch.`)
      })
      diffArrays(downTests, baseTests).forEach((test) => {
        warnings.push(`- **NOTE**: Test "${test}" in branch but not base.`)
      })

      const results = baseTests
        .sort()
        .map((test) => {
          const passes = compareResults(base[test], down[test])
          filePassing = filePassing && passes

          return [
            '<details>',
            `<summary>${test}: ${passMark(passes)}</summary>`,
            '',
            formatResults(base[test], down[test]),
            '</details>',
            ''
          ].join('\n')
        })
        .join('\n')
      allPassing = allPassing && filePassing

      return [
        `#### ${testFile}: ${passMark(filePassing)}`,
        '',
        results,
        '',
        '-----------------------------------------------------------------------',
        '</details>'
      ].join('\n')
    })
    .join('\n\n')

  if (warnings.length) {
    console.log('### WARNINGS')
    console.log(warnings.join('\n'))
    console.log('')
  }

  const date = new Date()
  let content = `### Benchmark Results: ${passMark(allPassing)}\n\n\n\n`
  content += `${date.toISOString()}\n\n`
  content += '### Details\n\n'
  content += '_Lower is better._\n\n'
  content += `${details}\n`

  const resultPath = 'benchmark_results'
  try {
    await fs.stat(resultPath)
  } catch (e) {
    await fs.mkdir(resultPath)
  }
  const fileName = `${resultPath}/comparison_${date.getTime()}.md`
  await fs.writeFile(fileName, content)
  console.log(`Done! Benchmark test comparison written to ${fileName}`)

  if (!allPassing) {
    process.exitCode = -1
  }
}

const iterate = async () => {
  const files = process.argv.slice(2)
  const results = await Promise.all(
    files.map(async (file) => {
      return await processFile(file)
    })
  )
  reportResults(results)
}

iterate()

function diffArrays(a, b) {
  return a.filter((elem) => !b.includes(elem))
}

function compareResults(base, down) {
  const delta = down.mean - base.mean
  const deltaPercent = delta / base.mean
  if (Math.abs(delta) < 0.1) {
    return deltaPercent < 100
  }
  return deltaPercent < 2
}

function passMark(passes) {
  return passes ? '✔' : '✘'
}

function formatResults(base, down) {
  return [
    'Field | Upstream (ms) | Downstream (ms) | Delta (ms) | Delta (%)',
    '----- | ------------: | --------------: | ---------: | --------:',
    formatField('numSamples'),
    formatField('mean'),
    formatField('stdDev'),
    formatField('max'),
    formatField('min'),
    formatField('5thPercentile'),
    formatField('95thPercentile'),
    formatField('median')
  ].join('\n')

  function formatField(field) {
    const baseValue = base[field]
    const downValue = down[field]
    const diffValue = downValue - baseValue
    const diffPercent = ((100 * diffValue) / baseValue).toFixed(2)
    const prefix = diffValue >= 0 ? '+' : ''

    return (
      `${field} | ${fixValue(baseValue)} | ${fixValue(downValue)} |` +
      ` ${fixValue(diffValue)} | ${prefix}${diffPercent}%`
    )
  }

  function fixValue(value) {
    return value % 1 ? value.toFixed(5) : value
  }
}
