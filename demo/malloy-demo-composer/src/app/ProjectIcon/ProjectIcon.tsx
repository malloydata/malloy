/*
 * Copyright 2022 Google LLC
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

import { ReactComponent as ProjectIconAirplane } from "../assets/img/project_icons/airplane.svg";
import { ReactComponent as ProjectIconBallotBox } from "../assets/img/project_icons/ballot-box.svg";
import { ReactComponent as ProjectIconIdentity } from "../assets/img/project_icons/identity.svg";
import { ReactComponent as ProjectIconLiquor } from "../assets/img/project_icons/liquor.svg";
import { ReactComponent as ProjectIconMuseum } from "../assets/img/project_icons/museum.svg";
import { ReactComponent as ProjectIconNewspaper } from "../assets/img/project_icons/newspaper.svg";
import { ReactComponent as ProjectIconShopping } from "../assets/img/project_icons/shopping.svg";
import { ReactComponent as ProjectIconWebBrowser } from "../assets/img/project_icons/web-browser.svg";

export const ProjectIcon: React.FC<{ name: string }> = ({ name }) => {
  const sizeProps = { width: "40px", height: "40px" };
  switch (name) {
    case "airplane":
      return <ProjectIconAirplane {...sizeProps} />;
    case "ballot-box":
      return <ProjectIconBallotBox {...sizeProps} />;
    case "identity":
      return <ProjectIconIdentity {...sizeProps} />;
    case "liquor":
      return <ProjectIconLiquor {...sizeProps} />;
    case "museum":
      return <ProjectIconMuseum {...sizeProps} />;
    case "newspaper":
      return <ProjectIconNewspaper {...sizeProps} />;
    case "shopping":
      return <ProjectIconShopping {...sizeProps} />;
    case "web-browser":
      return <ProjectIconWebBrowser {...sizeProps} />;
    default:
      return <ProjectIconNewspaper {...sizeProps} />;
  }
};
