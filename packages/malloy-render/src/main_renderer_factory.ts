import {Field, Explore, Tag} from '@malloydata/malloy';
import {DataRenderOptions, RenderDef, StyleDefaults} from './data_styles';
import {Renderer} from './renderer';
import {RendererFactory} from './renderer_factory';
import {RendererOptions} from './renderer_types';
import {ShapeMapRendererFactory} from './html/shape_map';
import {PointMapRendererFactory} from './html/point_map';
import {ImageRendererFactory} from './html/image';
import {SegmentMapRendererFactory} from './html/segment_map';
import {JSONRendererFactory} from './html/json';
import {SparkLineRendererFactory} from './html/sparkline';
import {BarSparkLineRendererFactory} from './html/bar_sparkline';
import {AreaSparkLineRendererFactory} from './html/area_sparkline';
import {ColumnSparkLineRendererFactory} from './html/column_sparkline';
import {ScatterChartRendererFactory} from './html/scatter_chart';
import {BarChartRendererFactory} from './html/bar_chart';
import {VegaRendererFactory} from './html/vega_spec';
import {LineChartRendererFactory} from './html/line_chart';
import {DateRendererFactory} from './html/date';
import {CurrencyRendererFactory} from './html/currency';
import {PercentRendererFactory} from './html/percent';
import {NumberRendererFactory} from './html/number';
import {BytesRendererFactory} from './html/bytes';
import {BooleanRendererFactory} from './html/boolean';
import {LinkRendererFactory} from './html/link';
import {UnsupportedRendererFactory} from './html/unsupported';
import {TextRendererFactory} from './html/text';
import {DataVolumeRendererFactory} from './html/data_volume';
import {DurationRendererFactory} from './html/duration';

export class MainRendererFactory {
  static renderFactories = [
    ShapeMapRendererFactory.instance,
    PointMapRendererFactory.instance,
    ImageRendererFactory.instance,
    SegmentMapRendererFactory.instance,
    JSONRendererFactory.instance,
    LineChartRendererFactory.instance,
    ColumnSparkLineRendererFactory.instance,
    BarSparkLineRendererFactory.instance,
    AreaSparkLineRendererFactory.instance,
    // This factory needs to be after the other Spark Line factories, so it doesn't override them.
    SparkLineRendererFactory.instance,
    ScatterChartRendererFactory.instance,
    BarChartRendererFactory.instance,
    VegaRendererFactory.instance,
    DateRendererFactory.instance,
    CurrencyRendererFactory.instance,
    PercentRendererFactory.instance,
    DataVolumeRendererFactory.instance,
    BytesRendererFactory.instance,
    LinkRendererFactory.instance,
    DurationRendererFactory.instance,
    BooleanRendererFactory.instance,
    NumberRendererFactory.instance,
    UnsupportedRendererFactory.instance,
    TextRendererFactory.instance,
  ];

  create(
    renderDef: RenderDef | undefined,
    tagged: Tag,
    document: Document,
    styleDefaults: StyleDefaults,
    rendererOptions: RendererOptions,
    field: Field | Explore,
    timezone?: string | undefined
  ): Renderer | undefined {
    let factory: RendererFactory<DataRenderOptions> | undefined;

    for (const f of MainRendererFactory.renderFactories) {
      if (
        ((this.matchesRenderDef(renderDef, f) || this.matchesTag(tagged, f)) &&
          f.isValidMatch(field)) ||
        f.activates(field)
      ) {
        factory = f;
        // Important to break so the first factory that matches is applied.
        break;
      }
    }
    return factory?.create(
      document,
      styleDefaults,
      rendererOptions,
      field,
      renderDef || factory.parseTagParameters(tagged) || {},
      timezone
    );
  }

  matchesRenderDef(
    renderDef: RenderDef | undefined,
    factory: RendererFactory<DataRenderOptions>
  ) {
    return (
      renderDef &&
      factory.rendererName &&
      renderDef.renderer === factory.rendererName
    );
  }

  matchesTag(tagged: Tag, factory: RendererFactory<DataRenderOptions>) {
    return factory.rendererName && tagged.has(factory.rendererName);
  }
}
