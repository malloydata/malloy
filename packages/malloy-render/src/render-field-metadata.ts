import {tagFromAnnotations} from '@/util';
import {type Field, RootField, getFieldType, FieldType} from '@/data_tree';
import type {
  RenderPluginFactory,
  RenderPluginInstance,
  RendererValidationSpec,
} from '@/api/plugin-types';
import type {
  RenderFieldRegistryEntry,
  RenderFieldRegistry,
} from '@/registry/types';
import {RenderLogCollector} from '@/component/render-log-collector';
import {resolveBuiltInTags} from '@/component/tag-configs';
import {getBuiltInRendererValidationSpec} from '@/component/renderer-validation-specs';

import type * as Malloy from '@malloydata/malloy-interfaces';

export type OnPluginCreateError = (
  error: Error,
  factory: RenderPluginFactory,
  field: Field,
  plugins: RenderPluginInstance[]
) => void;

export class RenderFieldMetadata {
  private registry: RenderFieldRegistry;
  private rootField: RootField;
  private warnedLegacyDeclaredPathPlugins = new Set<string>();
  readonly logCollector: RenderLogCollector;

  constructor(
    result: Malloy.Result,
    private pluginRegistry: RenderPluginFactory[] = [],
    private pluginOptions: Record<string, unknown> = {},
    private onPluginCreateError?: OnPluginCreateError,
    logCollector?: RenderLogCollector
  ) {
    this.logCollector = logCollector ?? new RenderLogCollector();
    this.registry = new Map();

    // Create the root field with all its metadata
    this.rootField = new RootField(
      {
        name: 'root',
        type: {
          kind: 'array_type',
          element_type: {
            kind: 'record_type',
            fields: result.schema.fields.filter(f => f.kind === 'dimension'),
          },
        },
        annotations: result.annotations,
      },
      {
        modelTag: tagFromAnnotations(result.model_annotations, '## '),
        queryTimezone: result.query_timezone,
      }
    );

    // Register all fields in the registry
    this.registerFields(this.rootField);
  }

  // Instantiate plugins for a field that match
  private instantiatePluginsForField(field: Field): {
    plugins: RenderPluginInstance[];
    matchingFactories: RenderPluginFactory[];
  } {
    const plugins: RenderPluginInstance[] = [];
    const matchingFactories: RenderPluginFactory[] = [];

    for (const factory of this.pluginRegistry) {
      try {
        if (factory.matches(field, field.tag, getFieldType(field))) {
          matchingFactories.push(factory);
          const pluginOptions = this.pluginOptions[factory.name];
          const modelTag = this.rootField.modelTag;
          const pluginInstance = factory.create(field, pluginOptions, modelTag);
          plugins.push(pluginInstance);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        this.logCollector.error(
          `Plugin ${factory.name} failed for field '${field.key}': ${msg}`
        );
        if (this.onPluginCreateError) {
          this.onPluginCreateError(error as Error, factory, field, plugins);
        }
      }
    }

    field.setPlugins(plugins);

    return {plugins, matchingFactories};
  }

  // Recursively register fields in the registry
  private registerFields(field: Field): void {
    const fieldKey = field.key;
    if (!this.registry.has(fieldKey)) {
      // Instantiate plugins for this field
      const {plugins, matchingFactories} =
        this.instantiatePluginsForField(field);

      const renderFieldEntry: RenderFieldRegistryEntry = {
        field,
        renderProperties: {
          field,
          // TODO placeholder until we migrate everything to plugins
          renderAs: field.renderAs(),
          sizingStrategy: 'fit',
          properties: {},
          errors: [],
        },
        plugins,
      };
      // TODO: legacy to keep renderer working until all viz are migrated to plugins
      const vizProperties = this.populateRenderFieldProperties(field, plugins);
      renderFieldEntry.renderProperties.properties = vizProperties.properties;
      renderFieldEntry.renderProperties.errors = vizProperties.errors;

      this.registry.set(fieldKey, renderFieldEntry);

      // Resolve tag configs for built-in renderers (image, link, etc.)
      // at setup time so components never read tags at render time.
      resolveBuiltInTags(field);

      // Run semantic validation on this field's tags
      this.validateFieldTags(field);

      // Mark renderer-owned tag paths as read so semantic ownership,
      // not literal render-time access, drives unread-tag warnings.
      this.markOwnedTagPaths(field, plugins, matchingFactories);
    }
    // Recurse for nested fields
    if (field.isNest()) {
      for (const childField of field.fields) {
        this.registerFields(childField);
      }
    }
  }

  // TODO: replace with plugin logic, type it
  private populateRenderFieldProperties(
    field: Field,
    plugins: RenderPluginInstance[]
  ): {
    properties: Record<string, unknown>;
    errors: Error[];
  } {
    const properties: Record<string, unknown> = {};
    const errors: Error[] = [];

    for (const plugin of plugins) {
      properties[plugin.name] = plugin.getMetadata();
    }

    return {properties, errors};
  }

  // Get all fields in the schema
  getAllFields(): Field[] {
    return Array.from(this.registry.values()).map(entry => entry.field);
  }

  // Get the root field
  getRootField(): RootField {
    return this.rootField;
  }

  // Get plugins for a specific field
  getPluginsForField(fieldKey: string): RenderPluginInstance[] {
    const entry = this.registry.get(fieldKey);
    return entry ? entry.plugins : [];
  }

  getFieldEntry(fieldKey: string): RenderFieldRegistryEntry | undefined {
    return this.registry.get(fieldKey);
  }

  /**
   * Validate tag/field type compatibility and tag values.
   * Called during registerFields for each field.
   */
  private validateFieldTags(field: Field): void {
    const tag = field.tag;
    const fieldType = getFieldType(field);
    const log = this.logCollector;

    // --- Renderer tags on wrong field types ---

    const nestOnly = [
      'viz',
      'bar_chart',
      'line_chart',
      'list',
      'list_detail',
      'pivot',
      'dashboard',
      'transpose',
      'table',
    ];
    const nestTypes = [FieldType.RepeatedRecord, FieldType.Record];
    for (const tagName of nestOnly) {
      if (tag.has(tagName) && !nestTypes.includes(fieldType)) {
        log.error(
          `Tag '${tagName}' on field '${field.name}' requires a nested query, but field is ${fieldType}. Try moving the tag to the line above the query, run, nest, or view declaration.`,
          tag.tag(tagName)
        );
      }
    }

    if (tag.has('link') && fieldType !== FieldType.String) {
      log.error(
        `Tag 'link' on field '${field.name}' requires a string field, but field is ${fieldType}`,
        tag.tag('link')
      );
    }

    if (tag.has('image') && fieldType !== FieldType.String) {
      log.error(
        `Tag 'image' on field '${field.name}' requires a string field, but field is ${fieldType}`,
        tag.tag('image')
      );
    }

    const numericOnly = ['number', 'currency', 'percent', 'duration'];
    for (const tagName of numericOnly) {
      if (
        tag.has(tagName) &&
        fieldType !== FieldType.Number &&
        fieldType !== FieldType.Array &&
        // number tag is also valid on date/timestamp for format strings
        !(
          tagName === 'number' &&
          (fieldType === FieldType.Date || fieldType === FieldType.Timestamp)
        )
      ) {
        log.error(
          `Tag '${tagName}' on field '${field.name}' requires a numeric field, but field is ${fieldType}`,
          tag.tag(tagName)
        );
      }
    }

    // --- number tag with bare numeric value ---
    const numberValTag = tag.tag('number');
    if (numberValTag?.scalarType() === 'number') {
      log.error(
        `Tag 'number' on field '${field.name}' has a bare numeric value. Use a quoted format string instead, e.g. # number="#,##0.00"`,
        numberValTag
      );
    }

    // --- Invalid enum values ---

    const vizType = tag.text('viz');
    if (vizType !== undefined) {
      const validVizTypes = ['bar', 'line', 'table', 'dashboard'];
      if (!validVizTypes.includes(vizType)) {
        log.error(
          `Invalid viz type '${vizType}' on field '${field.name}'. Valid types: ${validVizTypes.join(', ')}`,
          tag.tag('viz')
        );
      }
    }

    const sizeVal = tag.text('size');
    if (sizeVal !== undefined) {
      const validSizes = ['fill', 'spark', 'xs', 'sm', 'md', 'lg', 'xl', '2xl'];
      // Only validate if it's a string preset, not a custom { width, height }
      if (!validSizes.includes(sizeVal) && !tag.tag('size')?.has('width')) {
        log.warn(
          `Unknown size '${sizeVal}' on field '${field.name}'. Valid presets: ${validSizes.join(', ')}`,
          tag.tag('size')
        );
      }
    }

    if (tag.has('currency')) {
      const currencyVal = tag.text('currency');
      if (currencyVal !== undefined) {
        const validCodes = ['usd', 'eur', 'gbp', 'euro', 'pound'];
        // Extract the currency code prefix for shorthand like "usd2m"
        const codeMatch = currencyVal.match(/^(euro|pound|usd|eur|gbp)/i);
        if (!codeMatch) {
          log.error(
            `Unknown currency '${currencyVal}' on field '${field.name}'. Valid codes: ${validCodes.join(', ')}`,
            tag.tag('currency')
          );
        }
      }
    }

    if (tag.has('duration')) {
      const durationVal = tag.text('duration');
      if (durationVal !== undefined) {
        const validUnits = [
          'nanoseconds',
          'microseconds',
          'milliseconds',
          'seconds',
          'minutes',
          'hours',
          'days',
        ];
        if (!validUnits.includes(durationVal)) {
          log.error(
            `Unknown duration unit '${durationVal}' on field '${field.name}'. Valid units: ${validUnits.join(', ')}`,
            tag.tag('duration')
          );
        }
      }
    }

    // --- Chart field references ---
    if (field.isNest()) {
      const vizTag = tag.tag('viz');
      if (vizTag) {
        const childNames = new Set(field.fields.map(f => f.name));
        for (const channelName of ['x', 'y', 'series'] as const) {
          const refArray = vizTag.textArray(channelName);
          const refs = refArray ?? [];
          const singleRef = vizTag.text(channelName);
          if (singleRef && !refArray) refs.push(singleRef);
          for (const ref of refs) {
            if (!childNames.has(ref)) {
              log.error(
                `Chart field reference '${ref}' for '${channelName}' on '${field.name}' does not match any field. Available fields: ${[...childNames].join(', ')}`,
                vizTag.tag(channelName)
              );
            }
          }
        }
      }
    }

    // --- Column width named sizes ---
    const columnTag = tag.tag('column');
    if (columnTag) {
      const widthText = columnTag.text('width');
      if (widthText !== undefined) {
        const validWidthNames = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
        const numericWidth = columnTag.numeric('width');
        if (
          numericWidth === undefined &&
          !validWidthNames.includes(widthText)
        ) {
          log.warn(
            `Unknown column width '${widthText}' on field '${field.name}'. Valid presets: ${validWidthNames.join(', ')}`,
            columnTag.tag('width')
          );
        }
      }

      const wordBreakVal = columnTag.text('word_break');
      if (wordBreakVal !== undefined && wordBreakVal !== 'break_all') {
        log.error(
          `Unknown column word_break '${wordBreakVal}' on field '${field.name}'. Valid values: break_all`,
          columnTag.tag('word_break')
        );
      }
    }

    // --- Chart mode ---
    if (field.isNest()) {
      const vizTag = tag.tag('viz');
      if (vizTag) {
        const modeVal = vizTag.text('mode');
        if (modeVal !== undefined) {
          const validModes = ['normal', 'yoy'];
          if (!validModes.includes(modeVal)) {
            log.error(
              `Invalid chart mode '${modeVal}' on field '${field.name}'. Valid modes: ${validModes.join(', ')}`,
              vizTag.tag('mode')
            );
          }
        }
      }
    }

    // --- Big value enum properties ---
    const bigValueTag = tag.tag('big_value');
    if (bigValueTag) {
      const bvSize = bigValueTag.text('size');
      if (bvSize !== undefined) {
        const validBvSizes = ['sm', 'md', 'lg'];
        if (!validBvSizes.includes(bvSize)) {
          log.error(
            `Invalid big_value size '${bvSize}' on field '${field.name}'. Valid sizes: ${validBvSizes.join(', ')}`,
            bigValueTag.tag('size')
          );
        }
      }

      const compFormat = bigValueTag.text('comparison_format');
      if (compFormat !== undefined) {
        const validFormats = ['pct', 'ppt'];
        if (!validFormats.includes(compFormat)) {
          log.error(
            `Invalid big_value comparison_format '${compFormat}' on field '${field.name}'. Valid formats: ${validFormats.join(', ')}`,
            bigValueTag.tag('comparison_format')
          );
        }
      }
    }

    const hasBigValueChildConfig =
      bigValueTag !== undefined &&
      [
        'comparison_field',
        'comparison_label',
        'comparison_format',
        'down_is_good',
        'sparkline',
      ].some(prop => bigValueTag.has(prop));
    if (hasBigValueChildConfig) {
      // Parent plugins are already set because registerFields() processes
      // each parent before recursing into its children.
      const isBigValueChildContext =
        field.isBasic() &&
        field.parent?.getPlugins().some(plugin => plugin.name === 'big_value');
      if (!isBigValueChildContext) {
        log.error(
          `Tag 'big_value' on field '${field.name}' is only valid on basic fields inside big_value.`,
          bigValueTag
        );
      }
    }

    // --- Big value with group_by fields ---
    if (
      tag.has('big_value') &&
      field.isNest() &&
      field.getPlugins().some(plugin => plugin.name === 'big_value')
    ) {
      const dimensionFields = field.fields.filter(
        f => f.isBasic() && f.wasDimension()
      );
      if (dimensionFields.length > 0) {
        const dimNames = dimensionFields.map(f => f.name).join(', ');
        log.error(
          `Tag 'big_value' on field '${field.name}' does not support group_by fields. Found dimensions: ${dimNames}`,
          tag.tag('big_value')
        );
      }
    }

    // --- Number verbose properties ---
    const numberTag = tag.tag('number');
    if (numberTag) {
      const scaleVal = numberTag.text('scale');
      if (scaleVal !== undefined) {
        const validScales = ['k', 'm', 'b', 't', 'q', 'auto'];
        if (!validScales.includes(scaleVal)) {
          log.error(
            `Invalid number scale '${scaleVal}' on field '${field.name}'. Valid scales: ${validScales.join(', ')}`,
            numberTag.tag('scale')
          );
        }
      }

      const suffixVal = numberTag.text('suffix');
      if (suffixVal !== undefined) {
        const validSuffixes = [
          'letter',
          'lower',
          'word',
          'short',
          'finance',
          'scientific',
          'none',
        ];
        if (!validSuffixes.includes(suffixVal)) {
          log.error(
            `Invalid number suffix '${suffixVal}' on field '${field.name}'. Valid suffixes: ${validSuffixes.join(', ')}`,
            numberTag.tag('suffix')
          );
        }
      }
    }
  }

  /**
   * Mark renderer-owned tag paths as read.
   *
   * This is ownership bookkeeping, not config resolution. A renderer may
   * still read tags at setup time or render time, but unread-tag warnings
   * are suppressed based on semantic ownership declared via
   * RendererValidationSpec.
   */
  private markOwnedTagPaths(
    field: Field,
    plugins: RenderPluginInstance[],
    matchingFactories: RenderPluginFactory[]
  ): void {
    const tag = field.tag;

    for (const plugin of plugins) {
      const declaredPaths = plugin.getDeclaredTagPaths?.() ?? [];
      if (
        declaredPaths.length > 0 &&
        !this.warnedLegacyDeclaredPathPlugins.has(plugin.name)
      ) {
        this.warnedLegacyDeclaredPathPlugins.add(plugin.name);
        this.logCollector.warn(
          `Plugin '${plugin.name}' uses deprecated getDeclaredTagPaths(); migrate to getValidationSpec().`
        );
      }
      for (const path of declaredPaths) {
        tag.find(path);
      }
    }

    const specs: RendererValidationSpec[] = matchingFactories
      .map(factory => factory.getValidationSpec?.())
      .filter((spec): spec is RendererValidationSpec => spec !== undefined);

    const builtInSpec = getBuiltInRendererValidationSpec(field.renderAs());
    if (builtInSpec) {
      specs.push(builtInSpec);
    }

    for (const spec of specs) {
      // Apply child-owned paths during the parent's registration pass,
      // before recursing into the children. This lets a parent renderer
      // claim context-sensitive child tags (for example dashboard `break`
      // or chart child `tooltip`) while the parent renderer is in scope.
      for (const path of spec.ownedPaths ?? []) {
        tag.find(path);
      }

      if (field.isNest()) {
        for (const child of field.fields) {
          for (const path of spec.childOwnedPaths ?? []) {
            child.tag.find(path);
          }
        }
      }
    }
  }
}

// TODO: The "Transpose column limit exceeded" message in transpose-table.tsx
// should be logged via logCollector, not just displayed in the UI.
// It's a render-time-only error that won't be visible headlessly.
