import tsEslint from 'typescript-eslint';
import config from 'eslint-config-kyle';

export default tsEslint.config(...config, {
  rules: {
    'vitest/expect-expect': 'off', // we use node:assert
    'unicorn/prefer-node-protocol': 'off', // not supported in node v10
    'unicorn/prefer-event-target': 'off', // not supported in node v10
    'unicorn/prefer-string-replace-all': 'off', // not supported in node v10
    'unicorn/prevent-abbreviations': 'off', // don't want to rename code ported from C++
    '@typescript-eslint/no-unsafe-declaration-merging': 'off', // required for EventEmitter types
  },
});
