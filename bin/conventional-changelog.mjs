/*
 * Copyright 2021 New Relic Corporation. All rights reserved.
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFile, writeFile } from 'node:fs/promises'
import Github from './github.js'
import { CommitParser } from 'conventional-commits-parser'
import { writeChangelogString } from 'conventional-changelog-writer'
import createPreset from 'conventional-changelog-conventionalcommits'
import { GitClient } from '@conventional-changelog/git-client'
import { changelogCommitPartial, changelogHeaderPartial, changelogTemplate } from './changelog-utils.js'

// TODO: for reviewers: decide if we want to show all of these, or if there are some that should always be hidden
const RELEASE_NOTE_TYPES = [
  { type: 'build', section: 'Build system', rank: 12 },
  { type: 'chore', section: 'Miscellaneous chores', rank: 8 },
  { type: 'ci', section: 'Continuous integration', rank: 11 },
  { type: 'docs', section: 'Documentation', rank: 7 },
  { type: 'feat', section: 'Features', rank: 0 },
  { type: 'fix', section: 'Bug fixes', rank: 1 },
  { type: 'perf', section: 'Performance improvements', rank: 4 },
  { type: 'refactor', section: 'Code refactoring', rank: 5 },
  { type: 'revert', section: 'Reverts', rank: 6 },
  { type: 'security', section: 'Security improvements', rank: 2 },
  { type: 'style', section: 'Styles', rank: 9 },
  { type: 'test', section: 'Tests', rank: 10 }
]
const RELEASEABLE_PREFIXES = RELEASE_NOTE_TYPES.map((type) => type.type)
const ORDERED_TAGS = RELEASE_NOTE_TYPES.sort((a, b) => a.rank - b.rank).map((type) => type.section)

export class ConventionalChangelog {
  constructor({ newVersion, previousVersion, org = 'newrelic', repo = 'node-newrelic', gitClient, github }) {
    this.org = org
    this.repo = repo
    this.github = github ?? new Github(this.org, this.repo)
    this.newVersion = newVersion
    this.previousVersion = previousVersion
    this.gitClient = gitClient ?? new GitClient(process.cwd())
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
   * Git entries are generated with https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/git-client
   *
   * @returns {object[]} the list of parsed conventional commits from the previous version
   */
  async getFormattedCommits() {
    const config = createPreset({ types: RELEASE_NOTE_TYPES })
    const parser = new CommitParser(config.parser)
    const commits = []

    for await (const rawCommit of this.gitClient.getRawCommits({
      format: '%B%n-hash-%n%H',
      from: `v${this.previousVersion}`
    })) {
      const lines = rawCommit.split('\n')
      lines[0] = this.removePrLinks(lines[0])
      const data = parser.parse(lines.join('\n'))
      if (RELEASEABLE_PREFIXES.includes(data.type)) {
        if (data.body) {
          // newlines mess with our indentation formatting, so remove them
          data.body = data.body.replace(/\n/g, ' ')
        }
        commits.push(data)
      }
    }

    await this.addPullRequestMetadata(commits)
    return commits
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
   * Helper method to strip out the PR links that Github
   * likes to add to the end of commit messages when
   * using squash and merge
   *
   * Also since we're already manipulating the string,
   * use .trim() to strip any trailing or leading whitespace
   *
   * @param {string} subject commit message header
   * @returns {string} the commit message header with any PR links removed and whitespace trimmed
   */
  removePrLinks(subject) {
    return subject.replace(/\(#\d+\)$/, '').trim()
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
   * Templating is done via https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-writer
   * Templates were "borrowed" from https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-conventionalcommits/templates
   *
   * @param {object[]} commits list of conventional commits
   * @returns {string} markdown formatted release notes to be added to the changelog
   */
  async generateMarkdownChangelog(commits) {
    const config = createPreset({ types: RELEASE_NOTE_TYPES })

    const context = {
      host: 'https://github.com',
      owner: this.org,
      repository: this.repo,
      isPatch: false,
      version: this.newVersion,
      includeSemverCopy: this.repo === 'node-newrelic'
    }

    return writeChangelogString(commits, context, {
      ...config.writer,
      headerPartial: changelogHeaderPartial,
      template: changelogTemplate,
      commitPartial: changelogCommitPartial,
      commitGroupsSort: (a, b) => this.rankedGroupSort(a, b)
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
  async writeMarkdownChangelog(newEntry, markdownFile = 'NEWS.md') {
    const changelog = await readFile(markdownFile, 'utf-8')

    const heading = `### v${this.newVersion}`

    if (changelog.match(heading)) {
      console.log('Version already exists in markdown, skipping update')
      return
    }

    await writeFile(markdownFile, `${newEntry}\n${changelog}`, 'utf-8')
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
  async writeJsonChangelog(newEntry, jsonFile = 'changelog.json') {
    const rawChangelog = await readFile(jsonFile, 'utf-8')
    const changelog = JSON.parse(rawChangelog)

    if (changelog.entries.find((entry) => entry.version === this.newVersion)) {
      console.log('Version already exists in json, skipping update')
      return
    }

    changelog.entries.unshift(newEntry)
    await writeFile(jsonFile, JSON.stringify(changelog, null, 2), 'utf-8')
  }
}
