# Logging in Malloy Translator

## Adding New Error Types

New error codes should be added to `parse-log.ts` in the `MessageParameterTypes` type, with either
* `'the-error-code': string;`
* `'the-error-code': { value: number, ...otherProperties };`

If using the latter style, be sure to add a message formatter into `parse-log.ts` in the `MESSAGE_FORMATTERS` object:

```ts
'the-error-code': e => `Oh no, you messed up! ${e.value} is illegal`,
```

The error formatter can return a plain `string` message, or an object that can have:
* `message`: the error message
* `tag`: an error tag to attach to the error, which should correspond to a tag in the documentation
* `replacement`: suggested text to replace the erroring code
* `data`: data to attach to the error; if not specified, the error parameters will be used for this value

For errors which always have the same message, you can define the error parameter type to be `'the-error-code': {}` and provide an error formatter as just a string literal (instead of a function):

```ts
'the-error-code': 'Oh no! You did a bad thing!',
```

And then you call the log functions like: `this.logError('the-error-code', {});`

## Logging Errors

Use `logError` or `logWarning` to log error/warnings.

If the error code was declared with `'the-error-code': string;`, log erros like:

```ts
someMalloyElement.logError(
  'the-error-code',
  `Oh no, you messed up! ${someValue} is illegal`
);
```

Or if the error code was declared with `'the-error-code': { value: number };`:

```ts
someMalloyElement.logError('the-error-code', {value: someValue});
```

A third argument may be passed, which is an object that can have:
* `replacement`: suggested text to replace the erroring code
* `at`: an override for the location of the error; otherwise, the location of the calling element is used
* `tag`: an error tag to attach to the error, which should correspond to a tag in the documentation

In `getExpression` implementations, it is often useful to log an error and also return an error-typed `ExprValue`. You can use the `loggedErrorExpr` method to achieve this:

```ts
return this.loggedErrorExpr('this-does-not-work', {});
```

Note that this returns an object like:

```ts
{
    dataType: 'error',
    expressionType: 'scalar',
    value: {node: 'error', message: 'the-error-code'},
    evalSpace: 'constant',
}
```

If the error node is known to be of another expression type, data type, or eval space, be sure to override them.

## Testing Errors

To check that a particular error code was logged, use:

```ts
expect(something).toLog(error('the-error-code'))
```
If you want to check that the properties of the error are set correctly, you can do
```ts
expect(something).toLog(error('the-error-code', {value: 42}))
```
If you explicitly want to check that the message is formatted correctly, do
```ts
expect(something).toLog(errorMessage(`Oh no, you messed up! 42 is illegal`))
```
