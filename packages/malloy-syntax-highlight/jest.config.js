/*
 * Copyright Contributors to the Malloy project
 * SPDX-License-Identifier: MIT
 */

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testMatch: ['**/?(*.)+(spec).ts?(x)'],
  preset: 'ts-jest',
  testEnvironment: 'node',
};
