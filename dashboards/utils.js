/*
 * Copyright 2024 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'
const utils = module.exports

/**
 * @typedef {object} Page
 * @property {string} name
 * @property {description} description
 * @property {Widget[]} widgets
 */

/**
 * @typedef {object} Dashboard
 * @property {string} name
 * @property {Page[]} pages
 */

/**
 * @typedef {object} Widget
 * @property {string} title
 * @property {number} column
 * @property {number} row
 * @property {number} width
 * @property {number} height
 * @property {string} query
 */

/**
 * Makes object structure of a New Relic dashboard
 *
 * @param {object} params to function
 * @param {string} params.name name of dashboard
 * @param {Page[]} params.pages page contents
 * @returns {Dashboard} dashboard object
 */
utils.makeDashboard = function makeDashboard({ name, pages }) {
  return {
    name,
    description: null,
    permissions: 'PUBLIC_READ_WRITE',
    pages
  }
}

/**
 * Makes a page in a New Relic dashboard
 * @param {object} params to function
 * @param {string} params.name name of page
 * @param {string} params.description description of page
 * @param {Widget[]} params.widgets widgets in page
 * @returns {Page} page object
 */
utils.makePage = function makePage({ name, description, widgets }) {
  return {
    name,
    description,
    widgets
  }
}

/**
 * Makes a widget in a New Relic page
 * @param {object} params to function
 * @param {string} params.title of widget
 * @param {number} params.column column number
 * @param {number} params.row row number
 * @param {number} [params.width] width of widget
 * @param {number} [params.height] height of widget
 * @param {string} params.query nrql query
 * @returns {Widget} widget object
 */
utils.makeWidget = function makeWidget({ title, column, row, width = 4, height = 3, query }) {
  return {
    title,
    layout: {
      column,
      row,
      width,
      height
    },
    linkedEntityGuids: null,
    visualization: {
      id: 'viz.bar'
    },
    rawConfiguration: {
      facet: {
        showOtherSeries: false
      },
      nrqlQueries: [
        {
          accountIds: [1],
          query
        }
      ],
      platformOptions: {
        ignoreTimeRange: false
      }
    }
  }
}

/**
 * Constructs NRQL for library usage
 *
 * @param {object} params to function
 * @param {string} params.lib name of library
 * @param {string} params.nodeVersion minimum node version
 * @returns {string} NRQL query
 */
utils.libraryUsageQuery = function libraryUsageQuery({ lib, nodeVersion }) {
  return `FROM NodeMetadataSummary SELECT uniqueCount(entity.guid) where \`${lib}.version\` IS NOT NULL and node.version.major >= '${nodeVersion}' facet \`${lib}.version\`, agentVersion, node.version.major limit max`
}
