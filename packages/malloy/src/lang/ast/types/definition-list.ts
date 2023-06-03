import {Annotation} from '../../../model';
import {Noteable, isNoteable} from '../elements/doc-annotation';
import {ListOf, MalloyElement} from './malloy-element';

export abstract class DefinitionList<DT extends MalloyElement>
  extends ListOf<DT>
  implements Noteable
{
  readonly isNoteable = true;
  anonotation: Annotation | undefined;

  addAnnotation(note: Annotation): void {
    this.anonotation = note;
    this.distributeAnnotation();
  }

  getAnnotation(): Annotation | undefined {
    return this.anonotation;
  }

  distributeAnnotation() {
    // mtoy todo fix this when you understand what is going on
    // workaround for `this.annotation` testing as undefined, when it is defined
    const key = 'annotation';
    const theNote = this[key];
    if (theNote !== undefined) {
      // If we have an annotation, distribute it to all the children.
      for (const el of this.elements) {
        if (isNoteable(el)) {
          el.addAnnotation = {...theNote};
        }
      }
    }
  }

  protected newContents(): void {
    super.newContents();
    this.distributeAnnotation();
  }
}
