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

import path from "path";

export interface Section {
  title: string;
  items: SectionItem[];
}

export interface SectionItem {
  title: string;
  link: string;
}

interface EnrichedSection {
  title: string;
  id: string;
  items: EnrichedSectionItem[];
}

interface EnrichedSectionItem {
  title: string;
  link: string;
  fullLink: string;
  compareLink: string;
}

function enrichTableOfContents(sections: Section[]): EnrichedSection[] {
  return sections.map((section) => {
    return {
      id: section.title.toLowerCase().replace(" ", "_"),
      title: section.title,
      items: section.items.map((item) => {
        const htmlLink = item.link.replace(/\.md$/, ".html");
        const fullLink = path.join("/documentation", htmlLink);
        const compareLink =
          htmlLink === "/index.html" ? "/documentation/" : fullLink;

        return { title: item.title, link: item.link, fullLink, compareLink };
      }),
    };
  });
}

export function renderSidebar(sections: Section[]): string {
  return `<div class="sidebar" id="sidebar">
    ${enrichTableOfContents(sections)
      .map((section) => {
        return `<div>
        <div id=${
          section.id
        } class="sidebar-section-title {% unless ${section.items.map(
          (item) => item.compareLink
        )} contains page.url)} %}collapsed{% endunless %}">${
          section.title
        }</div>
          <div class="sidebar-section-item-group">
          ${section.items
            .map((item) => {
              return `<div class='sidebar-item {% if page.url == "${item.compareLink}" %}active{% endif %}'>
              <a href="{{ site.baseurl }}${item.fullLink}">
                <img src="{{ site.baseurl }}/img/docs-page.svg" alt="document"/>
                ${item.title}
              </a>
            </div>`;
            })
            .join("\n")}
          </div>
      </div>`;
      })
      .join("\n")}

  </div>`;
}

export function renderFooter(
  sections: Section[],
  rootPath: string,
  docPath: string
): string {
  const items = sections.flatMap((section) => section.items);
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
