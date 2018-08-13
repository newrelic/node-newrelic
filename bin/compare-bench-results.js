'use strict'
/* eslint-disable no-console */

const async = require('async')
const fs = require('fs')

if (process.argv.length !== 4) {
  console.log('Usage: %s %s <baseline> <upstream>', process.argv[0], process.argv[1])
  console.log('  <baseline>   JSON file containing benchmark results for upstream')
  console.log('               upstream comparison.')
  console.log('  <downstream> JSON file containing benchmark results from')
  console.log('               downstream branch to compare against base.')
  process.exit(1)
}

async.map(process.argv.slice(2), (file, cb) => {
  fs.readFile(file, {encoding: 'utf8'}, (err, data) => {
    if (err) {
      return cb(err)
    }

    let parsed = null
    try {
      parsed = JSON.parse(data)
    } catch (parseError) {
      return cb(parseError)
    }

    cb(null, parsed)
  })
}, (err, resultFiles) => {
  if (err) {
    console.log('Failed to load files.')
    console.log(err)
    process.exit(2)
  }

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
  const details = baselineFiles.sort().map((testFile) => {
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

    const results = baseTests.sort().map((test) => {
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
    }).join('\n')
    allPassing = allPassing && filePassing

    return [
      '<details>',
      `<summary>${testFile}: ${passMark(filePassing)}</summary>`,
      '',
      results,
      '',
      '-----------------------------------------------------------------------',
      '</details>'
    ].join('\n')
  }).join('\n\n')

  if (warnings.length) {
    console.log('### WARNINGS')
    console.log(warnings.join('\n'))
    console.log('')
  }

  console.log(`### Benchmark Results: ${passMark(allPassing)}`)
  console.log('')
  console.log('### Details')
  console.log('_Lower is better._')
  console.log(details)

  if (!allPassing) {
    process.exitCode = -1
  }
})

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
    const diffPercent = (100 * diffValue / baseValue).toFixed(2)
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
