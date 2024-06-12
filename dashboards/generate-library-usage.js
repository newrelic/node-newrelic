/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const fs = require('fs/promises')
const { INSTRUMENTED_LIBRARIES, MIN_NODE_VERSION } = require('./constants')
const { makeDashboard, makePage, makeWidget, libraryUsageQuery } = require('./utils')
const REPORT_NAME = process.env.REPORT_NAME || 'library-usage.json'

function makeLibraryWidgets(libs) {
  const width = 4
  const height = 3
  let row = 1
  let column = 1

  return libs.map((lib, index) => {
    const pos = index % height

    // on a new row, set column to 1
    if (pos === 0) {
      column = 1
      // add width to column
    } else {
      column += width
    }

    // start a new row
    if (pos === 0 && index !== 0) {
      row += height
    }
    const query = libraryUsageQuery({ lib, nodeVersion: MIN_NODE_VERSION })
    return makeWidget({ title: lib, column, row, width, height, query })
  })
}

async function main() {
  const widgets = makeLibraryWidgets(INSTRUMENTED_LIBRARIES)
  const page = makePage({
    name: 'Instrumented Libraries',
    description: 'Reports usage by library, agent, and node.js versions',
    widgets
  })
  const dashboard = makeDashboard({ name: 'Node.js Library Usage', pages: [page] })
  await fs.writeFile(REPORT_NAME, JSON.stringify(dashboard))
}

main()
