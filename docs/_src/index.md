# The Tao of Malloy

> *Tao is the natural order of the universe whose character one's human intuition must discern in order to realize the potential for individual wisdom. This intuitive knowing of "life" cannot be grasped as a concept; it is known through actual living experience of one's everyday being.* — [Wikipedia "Tao"](https://en.wikipedia.org/wiki/Tao)

### Malloy …

### … feels familiar to someone coming from SQL
Our primary users will all be familiar with SQL. We should make their life no harder than it needs to be. That said, Malloy is actually describing a different type of operation than SQL does, and so in some places we are deliberately different from SQL because we want people to be unfamiliar, to learn how Malloy works.

For example `name is expression`, vs `expression as name`. In SQL the naming on an expression sits as a casual afterthought "oh by the way, give this really important expression a name". In Malloy, the name of a thing is important, you are building complex things from smaller pieces. When you look at a model, you will often want to scan the file looking for names, they belong on the left hand side.


However, we in general try to have the "feel" of SQL. We use `()` for structuring instead of `{}` like LookML or JavaScript do, or indentation like Python does. We use `is` and `define` instead of `:` like LookML or `=` like JavaScript. We use SQL words for things (like `join`) where it makes sense.


The intention was always that there is some context, command line or editor, which handles a single document with mixed Malloy and SQL, either because they are one merged language, or there is some JSX-like escaping between the contexts.

### … feels concise, but not cryptic
This is the most common point of disagreement as we talk about how to express things. There is no one right answer to this. We have a preference for brevity, every single feature we wrestle with trying to get the most clarity from the least language surface.

### … is composable
If you find a piece of code that works, you should be able to select it, paste it somewhere with a name, and use it by name.

### … is an algebra for computations with relational data
Malloy comprehends data as a network of relationships and so computations like aggregation have a useful and mathematical meaning. Malloy gestures should read like a mathematical formula which means one clear thing.

### … is NOT an attempt to make the language look like English sentences
Maybe AppleScript or COBOL would be at the extreme end of this. More of a kind of math, less like a natural language.

### … is curated
There are not four different ways to express things depending on which programming language or style you came from. There is one, and it is carefully chosen to match the task of data transformation, discovery and presentation.

### … is helpful
Malloy tries to "do the right thing" that most people want, by default, while still allowing non default expressions to be written. The treatment of `null` and booleans, and the sorting rules for "reduce" stages would be two examples of this.

### … is still an experiment
We had some theoretical insights that there was a better way to interact with data than SQL, and Malloy is the current snapshot of that thinking, but we are not done. We have a number of features which are not yet in the language, which we expect to have an impact on the language, and maybe even on these rules. The language is still young and needs room to grow.

### … is an expression of empathy towards explorers and explainers of data
The Malloy user is not someone who writes one sentence in Malloy, and then never sees the language again. Malloy is an invitation into a "way" for people who are passionate about decision making based on data, and good decision making is iterative, and ongoing.
