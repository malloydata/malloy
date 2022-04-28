/*
 * Copyright 2021 Google LLC
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * version 2 as published by the Free Software Foundation.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 */

import { useEffect } from "react";

export function useClickOutside<E extends Element>(
  refOrRefs: React.RefObject<E> | React.RefObject<E>[],
  handler: (event: Event) => void
): void {
  useEffect(() => {
    const refs = Array.isArray(refOrRefs) ? refOrRefs : [refOrRefs];
    let down = false;

    const isInOneElement = (ref: React.RefObject<E>, event: Event) => {
      return (
        !ref.current ||
        (event.target instanceof Element && ref.current.contains(event.target))
      );
    };

    const isInElement = (event: Event) => {
      return refs.some((ref) => isInOneElement(ref, event));
    };

    const onMouseUp = (event: Event) => {
      // Do nothing if clicking ref's element or descendent elements
      if (!down || isInElement(event)) return;
      handler(event);
      down = false;
    };

    const onMouseDown = (event: Event) => {
      if (isInElement(event)) return;
      down = true;
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);

    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [refOrRefs, handler]);
}
