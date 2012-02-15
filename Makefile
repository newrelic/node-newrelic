SHELL := /bin/bash
NODE   = node
EXPRESSO = node_modules/expresso/bin/expresso

test:
	@$(EXPRESSO) test/*test.js

.PHONY: test
