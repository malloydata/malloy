import {Annotation} from '../../../model';
import {Noteable, isNoteable} from '../elements/doc-annotation';
import {ListOf, MalloyElement} from './malloy-element';

export abstract class DefinitionList<DT extends MalloyElement>
  extends ListOf<DT>
  implements Noteable
{
  readonly isNoteable = true;
  private noteForChildren: Annotation | undefined;

  setAnnotation(note: Annotation): void {
    this.noteForChildren = note;
    this.distributeAnnotation();
  }

  getAnnotation(): Annotation {
    return this.noteForChildren || {};
  }

  distributeAnnotation() {
    const blockNotes = this.noteForChildren?.notes;
    if (blockNotes && blockNotes.length > 0) {
      // If we have an annotation, distribute it to all the children.
      for (const el of this.elements) {
        if (isNoteable(el)) {
          el.setAnnotation({...el.getAnnotation(), blockNotes});
        }
      }
    }
  }

  protected newContents(): void {
    super.newContents();
    this.distributeAnnotation();
  }
}
