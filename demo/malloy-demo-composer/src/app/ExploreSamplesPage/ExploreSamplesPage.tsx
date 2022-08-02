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

import styled from "styled-components";
import { ProjectInfo } from "../../types";
import { COLORS } from "../colors";
import { ProjectIcon } from "../ProjectIcon";

interface ExploreSamplesPageProps {
  sampleProjects: ProjectInfo[] | undefined;
}

export const ExploreSamplesPage: React.FC<ExploreSamplesPageProps> = ({
  sampleProjects,
}) => {
  console.log(sampleProjects);
  return (
    <Content>
      <Heading1>Sample Projects</Heading1>
      <Paragraph>Select a project to copy it to your workspace.</Paragraph>
      <SampleProjectsList>
        {sampleProjects &&
          sampleProjects.map((sampleProject) => (
            <SampleProjectItem key={sampleProject.fullPath}>
              <ProjectIcon name={sampleProject.iconName} />
              <SampleProjectLabel>
                <SampleProjectName>
                  <Link href="#">{sampleProject.displayName}</Link>
                </SampleProjectName>
                <span>{sampleProject.description}</span>
              </SampleProjectLabel>
            </SampleProjectItem>
          ))}
      </SampleProjectsList>
    </Content>
  );
};

const Content = styled.div`
  padding: 10px 30px 30px 30px;
  width: 100%;
  font-family: Google Sans;
  max-width: 900px;
`;

const Heading1 = styled.h1`
  font-size: 21px;
  font-weight: 500;
  margin-block-end: 8px;
  margin-block-start: 16px;
`;

const Link = styled.a`
  color: ${COLORS.dimension.fillStrong};
`;

const SampleProjectsList = styled.div`
  display: flex;
  gap: 20px;
  flex-direction: column;
  margin-left: 10px;
  font-size: 14px;
  margin-top: 20px;
  color: #4b4c50;
`;

const Paragraph = styled.div`
  font-size: 14px;
  margin-block-start: 8px;
  color: #4b4c50;
`;

const SampleProjectItem = styled.div`
  display: flex;
  flex-direction: row;
  gap: 15px;
  align-items: center;
`;

const SampleProjectLabel = styled.div`
  display: flex;
  flex-direction: column;
`;

const SampleProjectName = styled.span`
  font-weight: bold;
`;
