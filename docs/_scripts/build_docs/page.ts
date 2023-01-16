/*
 * Copyright 2023 Google LLC
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files
 * (the "Software"), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge,
 * publish, distribute, sublicense, and/or sell copies of the Software,
 * and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

import path from "path";

export interface Section {
  title: string;
  items: (Section | SectionItem)[];
}

export interface SectionItem {
  title: string;
  link: string;
}

interface EnrichedSection {
  title: string;
  id: string;
  items: (EnrichedSection | EnrichedSectionItem)[];
}

interface EnrichedSectionItem {
  title: string;
  link: string;
  fullLink: string;
  compareLink: string;
}

function isSectionItem(item: SectionItem | Section): item is SectionItem {
  return (item as SectionItem).link !== undefined;
}

function enrichTableOfContents(sections: Section[]): EnrichedSection[] {
  return sections.map((section) => {
    return {
      id: section.title.toLowerCase().replace(" ", "_"),
      title: section.title,
      items: section.items.map((item) => {
        if (isSectionItem(item)) {
          const htmlLink = item.link.replace(/\.md$/, ".html");
          const fullLink = path.join("/documentation", htmlLink);
          const compareLink =
            htmlLink === "/index.html" ? "/documentation/" : fullLink;

          return { title: item.title, link: item.link, fullLink, compareLink };
        } else {
          return enrichTableOfContents([item])[0];
        }
      }),
    };
  });
}

function extractItems(sections: (Section | SectionItem)[]): SectionItem[] {
  const items: SectionItem[] = [];
  const stack = [...sections].reverse();
  while (stack.length) {
    const section = stack.pop() as Section | SectionItem;
    if (isSectionItem(section)) {
      items.push(section);
    } else {
      stack.push(...[...section.items].reverse());
    }
  }
  return items;
}

function renderSection(section: EnrichedSection | EnrichedSectionItem): string {
  if (isSectionItem(section)) {
    return `<div class='sidebar-item {% if page.url == "${section.compareLink}" %}active{% endif %}'>
      <a href="{{ site.baseurl }}${section.fullLink}">
        <img src="{{ site.baseurl }}/img/article_icon.svg" alt="document"/>
        ${section.title}
      </a>
    </div>`;
  } else {
    return `<div class="sidebar-section">
      <div id=${section.id}
        class="sidebar-section-title {% unless ${extractItems(
          section.items
        ).map(
          (item) => (item as EnrichedSectionItem).compareLink
        )} contains page.url)} %}collapsed{% endunless %}"
      >
        ${section.title}
        <img class="chevron-open" src="{{ site.baseurl }}/img/section_open.svg" alt="section open"/>
        <img class="chevron-closed" src="{{ site.baseurl }}/img/section_close.svg" alt="section closed"/>
      </div>
      <div class="sidebar-section-item-group">
        ${section.items
          .map((item) => {
            return renderSection(item);
          })
          .join("\n")}
      </div>
    </div>`;
  }
}

export function renderSidebar(sections: Section[]): string {
  return `<div class="sidebar" id="sidebar">
    ${enrichTableOfContents(sections)
      .map((section) => {
        return renderSection(section);
      })
      .join("\n")}
  </div>`;
}

export function renderFooter(
  sections: Section[],
  rootPath: string,
  docPath: string
): string {
  const items = extractItems(sections);
  const thisIndex = items.findIndex(
    (item) => item.link.replace(/\.md$/, ".html") === docPath
  );
  const next = items[thisIndex + 1];
  const nextLink = next && next.link.replace(/\.md$/, ".html");
  const nextRelative =
    next &&
    path.relative(
      path.join(rootPath, docPath, ".."),
      path.join(rootPath, nextLink)
    );

  const previous = items[thisIndex - 1];
  const previousLink = previous && previous.link.replace(/\.md$/, ".html");
  const previousRelative =
    previous &&
    path.relative(
      path.join(rootPath, docPath, ".."),
      path.join(rootPath, previousLink)
    );

  return `<div class="linear-navigation">
    <div class="item">
      ${
        previous
          ? `<a href="${previousRelative}"><img src="{{ site.baseurl }}/img/previous.svg" alt="previous"/>${previous.title}</a>`
          : ""
      }
    </div>
    <div class="item">
      ${
        next
          ? `<a href="${nextRelative}">${next.title}<img src="{{ site.baseurl }}/img/next.svg" alt="next"/></a>`
          : ""
      }
    </div>
  </div>`;
}
