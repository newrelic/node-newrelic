# New Relic Node.js agent


## Projects to investigate

https://github.com/dmelikyan/nodetime


## Getting started

1. [Install node](http://nodejs.org/#download).
2. [Install npm](http://npmjs.org/) (for versions of node < 0.5).
3. Clone this repository.
4. Run:

```
git clone git@github.com:newrelic/nodejs_agent.git
cd nodejs_agent
npm link
```

`npm link` will fetch the agent's dependencies into `node_modules` and link the agent into `/usr/local/lib/node_modules/`.


## Running tests

The agent's unit tests are written in [mocha](http://visionmedia.github.com/mocha/), and can be run either via the Makefile or by npm itself:

```
npm test
```

or

```
make test
```

If you'd like to check the test suite's code coverage, just run:

```
make test-cov
```

and then open `cover_html/index.html` in a browser.


## Continuous integration

Jenkins builds are running [here](https://hudson.newrelic.com/job/Node.js%20Agent/).

Nic:
> Just a heads-up: I installed the nodejs and npm packages from http://nodejs.tchol.org/ onto the chi-hudson-2 worker so that Saxon could add the new Node.js agent into CI.
>
> I also added a `nodejs` label to that worker in Hudson, so that jobs requiring Node can find a worker without needing to specify by hostname.
>
> Here are the steps I followed:
>
>     wget http://nodejs.tchol.org/repocfg/el/nodejs-stable-release.noarch.rpm
>
>     yum localinstall --nogpgcheck nodejs-stable-release.noarch.rpm
>     yum install nodejs
>     yum install npm
>     yum install nodejs-compat-symlinks.noarch


### Beta Customer Instructions

You'll need a New Relic account.

+ If you don't have one, just sign up through http://newrelic.com/. Once your account is set up you'll have a license key that you'll use a few steps later.
+ Unzip the archive.
+ Run `npm install` from within the agent directory to install the agent's dependencies.
+ Drop the agent into the `node_modules` directory of an app you want to monitor.
+ Copy `newrelic.js` from the agent directory into the root directory of your application.
+ Edit `newrelic.js` and replace `license_key`'s value with the license key for your account.
+ Add `require('newrelic_agent')();` as the first line of the app's startup script.

When you start your app, the agent should start up with it and start reporting data that will appear within our UI after a few minutes. The agent will write its log to a file named `newrelic_agent.log` in the application directory. If the agent doesn't send data that file might provide insight into the problem.
