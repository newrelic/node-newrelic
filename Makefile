MOCHA        = node_modules/.bin/mocha
MOCHA_NOBIN  = node_modules/.bin/_mocha
COVER        = node_modules/.bin/cover
TAP          = node_modules/.bin/tap
NODE_VERSION = $(shell node --version)
INTEGRATION  =  $(wildcard test/integration/*.tap.js)
INTEGRATION  += $(wildcard test/versioned/*/*.tap.js)
# subcomponents manage their own modules
NPMDIRS =  $(wildcard test/lib/bootstrap/*)
NPMDIRS += $(wildcard test/versioned/*)
SUBNPM = $(NPMDIRS:%=npm-%)

.PHONY: all build test-cov test clean notes pending pending-core unit integration
.PHONY: sub_node_modules $(SUBNPM)

all: build test

clean:
	rm -rf npm-debug.log newrelic_agent.log .coverage_data cover_html

node_modules: package.json
	@rm -rf node_modules
	npm install

build: clean node_modules
	@echo "Currently using node $(NODE_VERSION)."

test: unit integration

unit: node_modules
	@rm -f newrelic_agent.log
	@$(MOCHA)

sub_node_modules: $(SUBNPM)

$(SUBNPM):
	@$(MAKE) -s -C $(@:npm-%=%) node_modules

integration: node_modules sub_node_modules
	@time $(TAP) $(INTEGRATION)

coverage: clean node_modules
	@$(COVER) run $(MOCHA_NOBIN)
	@for tapfile in $(INTEGRATION) ; do \
		$(COVER) run $$tapfile ; \
	done
	@$(COVER) combine
	@$(COVER) report html
	@$(COVER) report

notes:
	find . -name node_modules -prune -o \
	       -name cover_html -prune -o \
	       -name newrelic_agent.log -prune -o \
	       \( -name ".*" -a \! -name . \) -prune -o \
	      -type f -exec egrep -n -H --color=always -C 2 'FIXME|TODO|NOTE|TBD|hax|HAX' {} \; | less -r

pending: node_modules
	@$(MOCHA) --reporter list | egrep '^\s+\-'

pending-core: node_modules
	@$(MOCHA) --reporter list | egrep '^\s+\-' | grep -v 'agent instrumentation of'
