MOCHA       = node_modules/.bin/mocha
MOCHA_NOBIN = node_modules/.bin/_mocha
COVER       = node_modules/.bin/cover
TAP         = node_modules/.bin/tap

.PHONY: all build test-cov test clean notes pending pending-core unit integration
all: build test

node_modules: package.json
	@rm -rf node_modules
	npm install

build: clean node_modules

test-cov: node_modules
	@$(COVER) run $(MOCHA_NOBIN)
	@$(COVER) report html
	@$(COVER) report

test: unit integration

unit: node_modules
	@rm -f newrelic_agent.log
	@$(MOCHA)

integration: node_modules
	@rm -f test/integration/newrelic_agent.log
	@time $(TAP) test/integration/*.tap.js

clean:
	rm -rf npm-debug.log newrelic_agent.log test/integration/newrelic_agent.log .coverage_data cover_html

notes:
	find . -wholename ./node_modules -prune -o \
	       -wholename ./cover_html -prune -o \
	       -name newrelic_agent.log -prune -o \
	       \( -name ".*" -a \! -name . \) -prune -o \
	      -type f -exec egrep -n -H --color=always -C 2 'FIXME|TODO|NOTE|TBD|hax' {} \; | less -r

pending: node_modules
	@$(MOCHA) --reporter list | grep -v ✓
	@$(MOCHA) --reporter list test/integration | grep -v ✓

pending-core: node_modules
	@$(MOCHA) --reporter list | grep -v ✓ | grep -v 'agent instrumentation of'
	@$(MOCHA) --reporter list test/integration | grep -v ✓ | grep -v 'agent instrumentation of'
