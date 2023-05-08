/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

'use strict'

const conventionalCommitsParser = require('conventional-commits-parser')
const conventionalChangelogWriter = require('conventional-changelog-writer')
const getChangelogConfig = require('conventional-changelog-conventionalcommits')
const gitRawCommits = require('git-raw-commits')
const path = require('node:path')
const stream = require('node:stream')
const { readFile, writeFile } = require('node:fs/promises')
const Github = require('./github')

// TODO: for reviewers: decide if we want to show all of these, or if there are some that should always be hidden
const RELEASE_NOTE_TYPES = [
  { type: 'build', section: 'Build System', rank: 12 },
  { type: 'chore', section: 'Miscellaneous Chores', rank: 8 },
  { type: 'ci', section: 'Continuous Integration', rank: 11 },
  { type: 'docs', section: 'Documentation', rank: 7 },
  { type: 'feat', section: 'Features', rank: 0 },
  { type: 'fix', section: 'Bug Fixes', rank: 1 },
  { type: 'perf', section: 'Performance Improvements', rank: 4 },
  { type: 'refactor', section: 'Code Refactoring', rank: 5 },
  { type: 'revert', section: 'Reverts', rank: 6 },
  { type: 'security', section: 'Security Improvements', rank: 2 },
  { type: 'style', section: 'Styles', rank: 9 },
  { type: 'test', section: 'Tests', rank: 10 }
]
const RELEASEABLE_PREFIXES = RELEASE_NOTE_TYPES.map((type) => type.type)
const ORDERED_TAGS = RELEASE_NOTE_TYPES.sort((a, b) => a.rank - b.rank).map((type) => type.section)

class ConventionalChangelog {
  constructor({ newVersion, previousVersion, org = 'newrelic', repo = 'node-newrelic' }) {
    this.org = org
    this.repo = repo
    this.github = new Github(this.org, this.repo)
    this.newVersion = newVersion
    this.previousVersion = previousVersion
  }

  /**
   * Customized sort function for ensuring that the commit group sections are organized
   * in a particular way, based on the rank property of the config in RELEASE_NOTE_TYPES
   *
   * @param {object} a first comparator
   * @param {object} b second comparator
   * @returns {number} positive / negative number, or 0
   */
  rankedGroupSort(a, b) {
    const rankA = ORDERED_TAGS.indexOf(a.title)
    const rankB = ORDERED_TAGS.indexOf(b.title)
    return rankA - rankB
  }

  /**
   * Function for parsing conventional commit messages from the git log
   * and converting into JSON structure
   *
   * Parsing is done with https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-commits-parser
   * Git entries are generated with https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/git-raw-commits
   *
   * @returns {object[]} the list of parsed conventional commits from the previous version
   */
  async getFormattedCommits() {
    const self = this
    const config = await getChangelogConfig({ types: RELEASE_NOTE_TYPES })
    const commits = []

    return new Promise((resolve, reject) => {
      const conventionalCommitsStream = gitRawCommits({
        format: '%B%n-hash-%n%H',
        from: `v${this.previousVersion}`
      }).pipe(conventionalCommitsParser(config.parserOpts))

      conventionalCommitsStream.on('data', function onData(data) {
        if (RELEASEABLE_PREFIXES.includes(data.type)) {
          if (data.body) {
            // newlines mess with our indentation formatting, so remove them
            data.body = data.body.replace(/\n/g, ' ')
          }

          commits.push(data)
        }
      })

      conventionalCommitsStream.on('error', function onError(err) {
        reject(err)
      })

      conventionalCommitsStream.on('end', async function onEnd() {
        await self.addPullRequestMetadata(commits)
        resolve(commits)
      })
    })
  }

  /**
   * Function for adding pull request information to commits
   * Pull request info comes from the Github API
   *
   * @param {object[]} commits list of conventional commits to update
   */
  async addPullRequestMetadata(commits) {
    for (const [idx, commit] of commits.entries()) {
      const pullRequestInfo = await this.github.getPullRequestByCommit(commit.hash)

      if (pullRequestInfo) {
        commits[idx].pr = { url: pullRequestInfo.html_url, id: pullRequestInfo.number }
      }
    }
  }

  /**
   * Function for generating our front-matter content in a machine readable format
   *
   * @param {object[]} commits list of conventional commits
   * @returns {object} the entry to add to the JSON changelog
   */
  generateJsonChangelog(commits) {
    const securityChanges = []
    const bugfixChanges = []
    const featureChanges = []

    commits.forEach((commit) => {
      if (commit.type === 'security') {
        securityChanges.push(commit.subject)
      }

      if (commit.type === 'fix') {
        bugfixChanges.push(commit.subject)
      }

      if (commit.type === 'feat') {
        featureChanges.push(commit.subject)
      }
    })

    return {
      version: this.newVersion,
      changes: {
        security: securityChanges,
        bugfixes: bugfixChanges,
        features: featureChanges
      }
    }
  }

  /**
   * Function for generating our release notes in a human readable format
   * Templating is done via Handlebars with https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-writer
   * Templates were "borrowed" from https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-conventionalcommits/templates
   *
   * @param {object[]} commits list of conventional commits
   * @returns {string} markdown formatted release notes to be added to the changelog
   */
  async generateMarkdownChangelog(commits) {
    const self = this
    const config = await getChangelogConfig({ types: RELEASE_NOTE_TYPES })
    const [mainTemplate, headerTemplate, commitTemplate] = await Promise.all([
      readFile(path.resolve(__dirname, './templates/template.hbs'), 'utf-8'),
      readFile(path.resolve(__dirname, './templates/header.hbs'), 'utf-8'),
      readFile(path.resolve(__dirname, './templates/commit.hbs'), 'utf-8')
    ])

    return new Promise((resolve, reject) => {
      const commitsStream = new stream.Stream.Readable({
        objectMode: true
      })

      commits.forEach((commit) => commitsStream.push(commit))
      // mark the end of the stream
      commitsStream.push(null)

      const context = {
        host: 'https://github.com',
        owner: self.org,
        repository: self.repo,
        isPatch: false,
        version: self.newVersion
      }

      const markdownFormatter = conventionalChangelogWriter(context, {
        ...config.writerOpts,
        mainTemplate: mainTemplate,
        headerPartial: headerTemplate,
        commitPartial: commitTemplate,
        commitGroupsSort: self.rankedGroupSort
      })
      const changelogStream = commitsStream.pipe(markdownFormatter)

      let content = ''
      changelogStream.on('data', function onData(buffer) {
        content += buffer.toString()
      })

      changelogStream.on('error', function onError(err) {
        reject(err)
      })

      changelogStream.on('end', function onEnd() {
        resolve(content)
      })
    })
  }

  /**
   * Function for writing update to our Markdown based changelog
   * Markdown changelog is for our customers and docs-website
   *
   * @param {string} newEntry markdown formatted release notes to be added to the changelog
   * @param {string} markdownFile path to the markdown file to update, defaults to NEWS.md
   * @returns {void}
   */
  async writeMarkdownChangelog(newEntry, markdownFile = '../NEWS.md') {
    const filename = path.resolve(__dirname, markdownFile)
    const changelog = await readFile(filename, 'utf-8')

    const heading = `### v${this.newVersion}`

    if (changelog.match(heading)) {
      console.log('Version already exists in markdown, skipping update')
      return
    }

    await writeFile(filename, `${newEntry}\n${changelog}`, 'utf-8')
  }

  /**
   * Function for writing update to our JSON based changelog
   * JSON changelog is for automating the generation of our agent version metadata front-matter when
   * submitting a PR to docs-website after a release
   *
   * @param {string} newEntry markdown formatted release notes to be added to the changelog
   * @param {string} jsonFile path to the markdown file to update, defaults to changelog.json
   * @returns {void}
   */
  async writeJsonChangelog(newEntry, jsonFile = '../changelog.json') {
    const filename = path.resolve(__dirname, jsonFile)
    const rawChangelog = await readFile(filename, 'utf-8')
    const changelog = JSON.parse(rawChangelog)

    if (changelog.entries.find((entry) => entry.version === this.newVersion)) {
      console.log('Version already exists in json, skipping update')
      return
    }

    changelog.entries.unshift(newEntry)
    await writeFile(filename, JSON.stringify(changelog, null, 2), 'utf-8')
  }
}

module.exports = ConventionalChangelog
