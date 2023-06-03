import {Annotation} from '../../../model';
import {Noteable, isNoteable} from '../elements/doc-annotation';
import {ListOf, MalloyElement} from './malloy-element';

export abstract class DefinitionList<DT extends MalloyElement>
  extends ListOf<DT>
  implements Noteable
{
  readonly isNoteable = true;
  private takeNotes = true;
  anonotation?: Annotation;
  elementType = 'genericDefinitionList';

  get list(): DT[] {
    if (this.takeNotes && this.anonotation) {
      for (const el of this.elements) {
        if (isNoteable(el)) {
          el.annotation = this.anonotation;
        }
      }
      this.takeNotes = false;
    }
    return this.elements;
  }
}
