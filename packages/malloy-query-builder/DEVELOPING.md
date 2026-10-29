## Things Flow converter does not support

Constructor types:

```ts
type NodeConstructor<T extends Node> = new (...args: any[]) => T;
```

Computed signature names, including ones for basic symbols like `Symbol.iterator`:

```ts
*[Symbol.iterator](): Generator<N, void, unknown> {
    for (let i = 0; i < this.length; i++) {
        yield this.index(i);
    }
}
```

Instead, name it something concrete, like `iter()`. Which is annoying because then you can't iterate on it directly.

```ts
*iter(): Generator<N, void, unknown> {
    for (let i = 0; i < this.length; i++) {
        yield this.index(i);
    }
}
```
