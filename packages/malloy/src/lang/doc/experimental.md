# How to add experimental features to lang/

This is a first step. I think there might need to be a way to add experimental features to model/ or to connections, and if you are someone who is trying to do that, you should talk to me (mtoy).

## Pick an identifier

You'll eventually be publishing this in in a [WN](https://github.com/malloydata/whatsnext), and in that case it needs to be a unique identifier. For now, THIS FILE is the list of all claimed identifiers, check the and of this file to make sure the one you want to use is not in the list, and make sure to add yours to the list when you merge your PR.

## Writing conditional code

There are two ways to check for experimental code, and this is all new, so it is of course wrong.

If you are accepting different syntax depending on and experimental flag, you can call this method from any parse visitor method, it will test the compiler flag, and generate a correctly tagged error and return false if the experiment is not enabled.

```TypeScript
    if (this.inExperiment('compilerTestExperimentParse', pcx)) {
        ...
    }
```

If the experiment involves different code generation, you can generate an AST at parse time, but do something different at translation time. In that case, every `MalloyElement ` also has `inExperiment(id)` with the same side effect that it will log an error message if the experiment is not active.

## Known Experiments

Add yours to the list, make sure no one else is using yours.

* `compilerTestExperimentParse`
* `compilerTestExperimentTranslate`
