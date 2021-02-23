'use strict'

const fs = require('fs')
const Github = require('./github')

const FILE_NAME = 'NEWS.md'
const PROPOSED_NOTES_HEADER = 'Proposed Release Notes'
const NEXT_VERSION_HEADER = '### vNext (TBD):'

async function generateReleaseNotes() {
  try {
    const github = new Github()
    const latestRelease = await github.getLatestRelease()
    console.log(`The latest release is: ${latestRelease.name} published: ${latestRelease.published_at}`)
    console.log(`Tag: ${latestRelease.tag_name}, Target: ${latestRelease.target_commitish}`)

    const tag = await github.getTagByName(latestRelease.tag_name)
    console.log('The tag commit sha is: ', tag.commit.sha)

    const commit = await github.getCommit(tag.commit.sha)
    const commitDate = commit.commit.committer.date

    console.log(`Finding merged pull requests since: ${commitDate}`)

    const mergedPullRequests = await github.getMergedPullRequestsSince(commitDate)
    console.log(`Found ${mergedPullRequests.length}`)

    const releaseNoteData = mergedPullRequests.map((pr) => {
      const parts = pr.body.split(/(?:^|\n)##\s*/g)

      // If only has one part, not in appropriate format.
      if (parts.length === 1) {
        return {
          notes: generateUnformattedNotes(pr.body),
          url: pr.html_url
        }
      }

      const {1: proposedReleaseNotes} = parts

      const titleRemoved = proposedReleaseNotes.replace(PROPOSED_NOTES_HEADER, '')
      return {
        notes: titleRemoved,
        url: pr.html_url
      }
    })

    const finalData = releaseNoteData.reduce((result, currentValue) => {
      result.notes += '\n\n' + currentValue.notes.trim()
      result.links += `\n\n* PR: ${currentValue.url}\n`
      return result
    }, {
      notes: '',
      links: ''
    })

    console.log('Final data: ', JSON.stringify(finalData))

    await updateReleaseNotes(FILE_NAME, finalData.notes)

    console.log('*** [SUCCESS] ***')
  } catch(err) {
    console.log('! [FAILURE] !')
    console.error(err)
  }
}

function generateUnformattedNotes(originalNotes) {
  let unformattedNotes = originalNotes

  // Drop extra snyk details and just keep high-level summary.
  if (originalNotes.indexOf('snyk:metadata') >= 0) {
    const snykParts = originalNotes.split('<details>')
    const {0: snykDescription} = snykParts

    unformattedNotes = snykDescription.trim()
  }

  const needsReviewNotes = [
    '--- NOTES NEEDS REVIEW ---',
    unformattedNotes,
    '--------------------------'
  ].join('\n')

  return needsReviewNotes
}

function updateReleaseNotes(file, newNotes) {
  const promise = new Promise((resolve, reject) => {
    fs.readFile(file, 'utf8', function (err, data) {
      if (err) {
        return reject(err)
      }

      if (data.startsWith(NEXT_VERSION_HEADER)) {
        const errMessage = [
          `${file} already contains '${NEXT_VERSION_HEADER}'`,
          'Delete existing vNext release notes (if desired) and run again'
        ].join('\n')

        return reject(new Error(errMessage))
      }

      const newContent = [
        NEXT_VERSION_HEADER,
        newNotes,
        '\n\n',
        data
      ].join('')

      fs.writeFile(file, newContent, 'utf8', function (err) {
        if (err) {
          return reject(err)
        }

        console.log(`Added new release notes to ${file} under the ${NEXT_VERSION_HEADER}`)

        resolve()
      })
    })
  })

  return promise
}

generateReleaseNotes()
