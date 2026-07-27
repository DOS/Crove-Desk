/**
 * Copyright (c) 2025 Bytedance Ltd. and/or its affiliates
 * SPDX-License-Identifier: MIT
 */

const { defineFlatConfig } = require('@flowgram.ai/eslint-config');

module.exports = defineFlatConfig({
  preset: 'web',
  packageRoot: __dirname,
  rules: {
    'no-console': 'off',
    'react/prop-types': 'off',
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
});
