# New Developer Setup

## Machine Setup (Mac)

- [ ] Docker for Mac
- [ ] XCode or command-line tools for Xcode or however Mac OS does this in the future (installs git too)
- [ ] Git setup - prob SSL key/cert, username, etc.
- [ ] Add `gh-actions-<username>@github.com` to your GitHub profile emails (used for release actions)
- [ ] NVM
- [ ] Node through NVM
- [ ] Text Editor / IDE
- [ ] `brew install postgresql` (c library required for pg-native tests)
- [ ] Swap OpenSSL (if necessary)

### Swapping OpenSSL for LibreSSL

LibreSSL doesn’t seem to work w/ our make/tests that rely on OpenSSL functionality.

To fix:

1. Install openssl via homebrew (brew install)
2. Execute brew info openssl
3. Copy/Paste instructions for "If you need to have this software first in your PATH run:..." section.

## How We Work

Similar to public contributions, New Relic instrumentation team members also standardly work from their own forks of the main repository. This ensures the public contribution path is well known and exercised and also avoids a class of mistakes we've made in the past. In certain circumstances, working directly on a branch in the main repo may be ideal. This is fine but is not intended to be the standard.

All work is landed to the default branch which we deploy from. Deployments occur at the discretion of the instrumentation team depending on the types and quantity of changes landed to the main repository. When public contributions are landed, the team aims to ship these the same or following-week.

The instrumentation team primarily works via GitHub issues. In progress work can be tracked via the [Node.js Engineering Board](https://github.com/orgs/newrelic/projects/41).

See the [CONTRIBUTING](../CONTRIBUTING.md) doc for further information submitting issues and pull requests, running tests, etc.

### Forking

GitHub has a getting started guide on forking a repository here: https://docs.github.com/en/github/getting-started-with-github/fork-a-repo.

Don't forget to add your upstream remote!

`git remote add upstream git@github.com:newrelic/node-newrelic.git`

There are a variety of ways to get the latest changes into your local branches. Here's one way for quick reference:

1. `git checkout main`
2. `git pull upstream main`
