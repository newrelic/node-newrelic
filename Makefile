MOCHA = node_modules/mocha/bin/mocha
MOCHA_NOBIN = node_modules/.bin/_mocha
COVER = node_modules/cover/bin/cover

.PHONY: all
all: build test

node_modules: package.json
	@rm -r node_modules
	npm install --dev

.PHONY: build
build: clean node_modules

.PHONY: test-cov
test-cov: node_modules
	@$(COVER) run $(MOCHA_NOBIN)
	@$(COVER) report html
	@$(COVER) report

.PHONY: test
test: node_modules
	@$(MOCHA)

.PHONY: clean
clean:
	rm -rf npm-debug.log newrelic_agent.log .coverage_data cover_html
