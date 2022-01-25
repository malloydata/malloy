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

Array.from(document.getElementsByClassName("result-outer")).forEach(
  (resultElement) => {
    const controlElements = Array.from(
      resultElement.getElementsByClassName("result-control")
    );
    const resultElements = Array.from(
      resultElement.getElementsByClassName("result-middle")
    );
    controlElements.forEach((controlElement) => {
      controlElement.addEventListener("click", () => {
        controlElements.forEach((controlElement) =>
          controlElement.removeAttribute("selected")
        );
        resultElements.forEach((resultElement) =>
          resultElement.removeAttribute("selected")
        );
        const resultKind = controlElement.getAttribute("data-result-kind");
        controlElement.setAttribute("selected", true);
        const selectedResult = resultElement.querySelector(
          `.result-middle[data-result-kind="${resultKind}"]`
        );
        selectedResult.setAttribute("selected", true);
      });
    });
  }
);
