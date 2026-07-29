/*
 * Copyright 2026 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const SEMVER_COPY =
  'This version of the Node.js agent is a SemVer MAJOR update and contains the following breaking changes. MAJOR versions may drop support for language runtimes that have reached End-of-Life according to the maintainer. Additionally, MAJOR versions may drop support for and remove certain instrumentation. For more details on these changes please see the [migration guide](https://docs.newrelic.com/docs/apm/agents/nodejs-agent/installation-configuration/update-nodejs-agent/).'

/**
 * Creates the header for the changelog entry
 * ### vx.x.x "<title>" (YYYY-MM-DD)
 *
 * e.g. ### v14.3.4 (2026-07-27)
 *
 * @param {TemplateContext} we only use version and optionally title/date if available
 * @returns {string} formatted header string
 */
function changelogHeaderPartial({ version, date, title }) {
  let result = `### v${version}`
  if (title) result += ` "${title}"`
  if (date) result += ` (${date})`
  return result
}

/**
 * Creates a line item in changelog within a given conventional commit group
 *
 * **<scope>** <commit title>|<header> ([#<pr number>](<pr url>)) ([<commit sha>](<url to commit sha>))
 *   <pr body>
 *
 *   e.g. * **deps:** Updated `@newrelic/security-agent` to `v3.0.0` ([#3637](https://github.com/newrelic/node-newrelic/pull/3637)) ([a84fa74](https://github.com/newrelic/node-newrelic/commit/a84fa742bbacb607a813de2a99d81113027178bc))
 *           Additional info
 *
 *  @param {FinalTemplateContext} context the template context
 *  @param {TransformedCommit} commit details
 *  @returns {string} formatted commit string
 */
function changelogCommitPartial(context, commit) {
  const { host, owner, repository, linkReferences } = context
  const { scope, subject, header, shortHash, hash, references, pr, body } = commit

  let entry = ''
  if (scope) entry += `**${scope}:** `
  entry += subject || header || ''

  if (pr) entry += ` ([#${pr.id}](${pr.url}))`

  if (hash && linkReferences !== false) {
    entry += ` ([${shortHash}](${host}/${owner}/${repository}/commit/${hash}))`
  }

  const closingRefs = (references || [])
    .filter((r) => r.action)
    .map((r) => {
      if (linkReferences !== false) {
        const repoBase = r.repository
          ? `${host}/${r.owner}/${r.repository}`
          : `${host}/${owner}/${repository}`
        return `[${r.issue}](${repoBase}/issues/${r.issue})`
      }
      return `${r.prefix || '#'}${r.issue}`
    })

  if (closingRefs.length) {
    entry += `, closes ${closingRefs.join(', ')}`
  }

  if (body) entry += `\n    * ${body}`

  return entry
}

/**
 * Adds all breaking change commits to top of a given changelog
 * and includes the semver major copy provided from our legal team
 * if the repo is `node-newrelic`
 *
 * @param {Array} noteGroups really only breaking change commits
 * @param {boolean} includeSemverCopy to include semver major copy from our legal team
 * @returns {string} formatted list of breaking changes extract from a given release
 */
function renderNoteGroups(noteGroups, includeSemverCopy) {
  let result = ''
  for (const group of noteGroups) {
    result += `#### ⚠ ${group.title}\n\n`
    result += includeSemverCopy ? `${SEMVER_COPY}\n\n` : '\n'
    for (const note of group.notes) {
      const scopePrefix = note.commit.scope ? `**${note.commit.scope}:** ` : ''
      result += `* ${scopePrefix}${note.text}\n`
    }
  }
  return result
}

/**
 * Renders all commits grouped by a given conventional commit type
 *
 * @param {Array} commitGroups commits grouped by given commit type
 * @param {Function} commitPartial the formatter for displaying a commit in changelog
 * @param {TemplateContext} context for the writeChangelogString caller
 * @returns {string} formatted list of all commits grouped by commit type
 */
function renderCommitGroups(commitGroups, commitPartial, context) {
  let result = ''
  for (const group of commitGroups) {
    result += '\n'
    if (group.title) {
      result += `#### ${group.title}\n\n`
    }
    for (const commit of group.commits) {
      result += `* ${commitPartial(context, commit)}\n`
    }
  }
  return result
}

/**
 * Creates the entire changelog for a given release
 *
 * @param {TemplateContext} context for the writeChangelogString caller
 * @returns {string} full changelog for a given release
 */
function changelogTemplate(context) {
  // `headerPartial` and `commitPartial` are extracted from context even though the functions are above
  // This isn't necessary but wanted to keep the pattern from before
  const { headerPartial, commitPartial, noteGroups, commitGroups, includeSemverCopy } = context

  let result = headerPartial(context) + '\n'
  if (noteGroups?.length) {
    result += renderNoteGroups(noteGroups, includeSemverCopy)
  }
  result += renderCommitGroups(commitGroups || [], commitPartial, context)
  return result
}

module.exports = {
  changelogCommitPartial,
  changelogHeaderPartial,
  changelogTemplate
}
