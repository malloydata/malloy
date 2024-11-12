const isObject = (obj: unknown) => obj && typeof obj === 'object';

export function mergeVegaConfigs(target: Object, source: Object) {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  Object.keys(source).forEach(key => {
    const targetValue = target[key];
    const sourceValue = source[key];

    if (Array.isArray(targetValue) && Array.isArray(sourceValue)) {
      // For now, don't concat arrays. We may need to revisit this and do it based on property.
      target[key] = [...sourceValue];
    } else if (isObject(targetValue) && isObject(sourceValue)) {
      target[key] = mergeVegaConfigs(
        Object.assign({}, targetValue),
        sourceValue
      );
    } else {
      target[key] = sourceValue;
    }
  });

  return target;
}
