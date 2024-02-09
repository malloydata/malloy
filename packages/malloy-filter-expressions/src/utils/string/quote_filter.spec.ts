/**
 * Copyright (c) 2023 Google LLC
 * SPDX-License-Identifier: MIT
 */
import {quoteFilter} from './quote_filter';

describe('quote filter function', () => {
  it('should not quote strings lacking single quotes (\'), double quotes (") commas (,), or leading minus (-)', () => {
    expect(quoteFilter('one')).toEqual('one');
  });

  it('should quote strings with commas', () => {
    expect(quoteFilter('one,')).toEqual('"one,"');
  });

  it('should quote strings with single quotes', () => {
    expect(quoteFilter("one'")).toEqual('"one\'"');
  });

  it('should quote strings with double quotes', () => {
    expect(quoteFilter('one"')).toEqual('"one\\""');
  });

  it('should quote strings with a percentage', () => {
    expect(quoteFilter('one%')).toEqual('"one%"');
  });

  it('should quote strings with leading minus sign', () => {
    expect(quoteFilter('-one')).toEqual('"-one"');
  });

  it('should NOT quote strings with a hyphen', () => {
    expect(quoteFilter('on-e')).toEqual('on-e');
  });

  it('should quote strings with a backslash (and escape backslash)', () => {
    expect(quoteFilter('on\\e')).toEqual('"on\\\\e"');
  });

  it('should quote the string null', () => {
    expect(quoteFilter('null')).toEqual('"null"');
  });

  it('should quote the string empty', () => {
    expect(quoteFilter('empty')).toEqual('"empty"');
  });
});
