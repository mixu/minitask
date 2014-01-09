TESTS += test/*.test.js

test:
	@mkdir -p ./test/tmp
	@mocha \
		--ui exports \
		--reporter spec \
		--slow 2000ms \
		--bail \
		$(TESTS)

.PHONY: test
