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

import { useRef, useState } from "react";
import styled from "styled-components";
import { Model, Analysis, Directory, Source } from "../../types";
import { ActionIcon } from "../ActionIcon";
import { FieldButton } from "../FieldButton";
import { ListNest } from "../ListNest";
import { Popover } from "../Popover";
import { InputBox } from "../SelectDropdown/SelectDropdown";
import { ReactComponent as ChevronDown } from "../assets/img/chevrons/chevron_down.svg";
import { ContextMenuSearchHeader, EmptyMessage } from "../CommonElements";
import { compileModel } from "../../core/compile";
import { SearchInput } from "../SearchInput";

interface DirectoryPickerProps {
  directory: Directory | undefined;
  analysis: Analysis | undefined;
  selectAnalysis: (analysis: Analysis) => void;
}

export const DirectoryPicker: React.FC<DirectoryPickerProps> = ({
  directory,
  analysis,
  selectAnalysis,
}) => {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const pickAnalysis = (analysis: Analysis) => {
    selectAnalysis(analysis);
    setOpen(false);
    setSearchTerm("");
  };

  const selectSource = (model: Model, source: Source) => {
    const sourceName = `${source.name}_analysis`;
    const code = `import "file://${model.fullPath}"\n\n explore: ${sourceName} is ${source.name} {}`;
    compileModel(model.modelDef, code).then((modelDef) => {
      const analysis: Analysis = {
        type: "analysis",
        malloy: code,
        path: undefined,
        fullPath: undefined,
        modelFullPath: model.fullPath,
        sourceName,
        modelDef,
        id: `${model.fullPath}/${source.name}`,
        dataStyles: model.dataStyles,
      };
      pickAnalysis(analysis);
    });
  };

  const label = directory
    ? analysis
      ? analysis.path
        ? analysis.path.replace(/\.a\.malloy$/, "")
        : analysis.sourceName
      : "Select analysis..."
    : "Loading...";

  return (
    <>
      <InputBoxNoOutline tabIndex={0} onClick={() => setOpen(true)} ref={ref}>
        {label}
        <ChevronDown width="22px" height="22px" />
      </InputBoxNoOutline>
      <Popover
        open={open}
        setOpen={setOpen}
        referenceDiv={ref}
        placement="bottom-start"
      >
        <ContextMenuSearchHeader>
          <SearchInput
            value={searchTerm}
            setValue={setSearchTerm}
            placeholder="Search"
          />
        </ContextMenuSearchHeader>
        <Wapper>
          {directory && (
            <>
              {searchTerm === "" && (
                <DirectoryContents
                  directory={directory}
                  selectAnalysis={pickAnalysis}
                  selectSource={selectSource}
                />
              )}
              {searchTerm !== "" && (
                <SearchResults
                  directory={directory}
                  searchTerm={searchTerm}
                  selectAnalysis={pickAnalysis}
                  selectSource={selectSource}
                />
              )}
            </>
          )}
          {!directory && <EmptyMessage>Loading...</EmptyMessage>}
        </Wapper>
      </Popover>
    </>
  );
};

const InputBoxNoOutline = styled(InputBox)`
  border: none;
  &:hover {
    border: none;
  }
  :focus {
    border: none;
  }
`;

const Wapper = styled.div`
  max-height: 400px;
  overflow-y: auto;
  padding: 10px;
`;

interface DirectoryContentsProps {
  directory: Directory;
  selectAnalysis: (analysis: Analysis) => void;
  selectSource: (model: Model, source: Source) => void;
}

const ListDiv = styled.div`
  overflow: hidden;
  display: flex;
  gap: 2px;
  flex-direction: column;
`;

interface SearchResultsProps {
  directory: Directory;
  searchTerm: string;
  selectAnalysis: (analysis: Analysis) => void;
  selectSource: (model: Model, source: Source) => void;
}

const SearchResults: React.FC<SearchResultsProps> = ({
  directory,
  searchTerm,
  selectAnalysis,
  selectSource,
}) => {
  const results = flatAnalyses(directory)
    .map((a) => ({ item: a, rank: scoreTerm(a, searchTerm) }))
    .filter(({ rank }) => rank > 0)
    .sort(({ rank: rankA }, { rank: rankB }) => rankB - rankA);

  if (results.length === 0) {
    return <EmptyMessage>No results</EmptyMessage>;
  }

  return (
    <ListDiv>
      {flatAnalyses(directory)
        .map((a) => ({ item: a, rank: scoreTerm(a, searchTerm) }))
        .filter(({ rank }) => rank > 0)
        .sort(({ rank: rankA }, { rank: rankB }) => rankB - rankA)
        .map(({ item }, index) => {
          if (item.type === "analysis") {
            return (
              <FieldButton
                key={item.path || "" + index}
                icon={<ActionIcon action="analysis" color="dimension" />}
                onClick={() => selectAnalysis(item)}
                name={item.sourceName}
                color="dimension"
              />
            );
          } else {
            return (
              <FieldButton
                icon={<ActionIcon action="analysis" color="dimension" />}
                onClick={() => selectSource(item.model, item.source)}
                name={item.source.name}
                key={item.source.name + index}
                color="dimension"
                detail={item.model.path.replace(/\.malloy$/, "")}
              />
            );
          }
        })}
    </ListDiv>
  );
};

function sortOrder(entry: Directory | Model | Analysis) {
  return {
    directory: 3,
    model: 2,
    analysis: 1,
  }[entry.type];
}

function bySortOrder(
  aentry: Directory | Model | Analysis,
  bentry: Directory | Model | Analysis
) {
  return sortOrder(aentry) - sortOrder(bentry);
}

const DirectoryContents: React.FC<DirectoryContentsProps> = ({
  directory,
  selectAnalysis,
  selectSource,
}) => {
  return (
    <ListDiv>
      {directory.contents.sort(bySortOrder).map((entry) => {
        if (entry.type === "directory") {
          return (
            <DirectoryItem
              directory={entry}
              selectAnalysis={selectAnalysis}
              key={entry.path}
              selectSource={selectSource}
            />
          );
        } else if (entry.type === "analysis") {
          return (
            <FieldButton
              key={entry.path}
              icon={<ActionIcon action="analysis" color="dimension" />}
              onClick={() => selectAnalysis(entry)}
              name={entry.sourceName}
              color="dimension"
            />
          );
        } else if (entry.type === "model") {
          return (
            <ModelItem
              model={entry}
              selectAnalysis={selectAnalysis}
              key={entry.path}
              selectSource={selectSource}
            />
          );
        }
        return null;
      })}
    </ListDiv>
  );
};

interface DirectoryItemProps {
  directory: Directory;
  selectAnalysis: (analysis: Analysis) => void;
  selectSource: (model: Model, source: Source) => void;
}

const DirectoryItem: React.FC<DirectoryItemProps> = ({
  directory,
  selectAnalysis,
  selectSource,
}) => {
  const [open, setOpen] = useState(false);

  const count = countAnalyses(directory);

  return (
    <>
      <FieldButton
        icon={
          <ActionIcon
            action={open ? "container-open" : "container-closed"}
            color="other"
          />
        }
        onClick={() => setOpen(!open)}
        name={directory.path}
        color="other"
        detail={count.toString()}
        fullDetail={true}
      />
      {open && count > 0 && (
        <ListNest>
          <DirectoryContents
            directory={directory}
            selectAnalysis={selectAnalysis}
            selectSource={selectSource}
          />
        </ListNest>
      )}
    </>
  );
};

interface ModelItemProps {
  model: Model;
  selectAnalysis: (analysis: Analysis) => void;
  selectSource: (model: Model, source: Source) => void;
}

const ModelItem: React.FC<ModelItemProps> = ({ model, selectSource }) => {
  const [open, setOpen] = useState(false);

  const count = countAnalyses(model);

  return (
    <>
      <FieldButton
        icon={
          <ActionIcon
            action={open ? "container-open" : "container-closed"}
            color="other"
          />
        }
        onClick={() => setOpen(!open)}
        name={model.path}
        color="other"
        detail={countAnalyses(model).toString()}
        fullDetail={true}
      />
      {open && count > 0 && (
        <ListNest>
          {model.sources.map((source) => {
            return (
              <FieldButton
                icon={<ActionIcon action="analysis" color="dimension" />}
                onClick={() => selectSource(model, source)}
                name={source.name}
                key={source.name}
                color="dimension"
              />
            );
          })}
        </ListNest>
      )}
    </>
  );
};

function countAnalyses(thing: Directory | Model | Analysis): number {
  if (thing.type === "directory") {
    return thing.contents.map(countAnalyses).reduce((a, b) => a + b, 0);
  } else if (thing.type === "analysis") {
    return 1;
  } else {
    return thing.sources.length;
  }
}

type FlatAnalysisItem =
  | Analysis
  | { type: "source"; model: Model; source: Source };

function flatAnalyses(directory: Directory): FlatAnalysisItem[] {
  return directory.contents.flatMap((entry) => {
    if (entry.type === "directory") {
      return flatAnalyses(entry);
    } else if (entry.type === "analysis") {
      return [entry];
    } else {
      return entry.sources.map((source) => ({
        type: "source",
        model: entry,
        source,
      }));
    }
  });
}

function scoreTerm(item: FlatAnalysisItem, searchTerm: string) {
  const searchTerms = searchTerm
    .split(" ")
    .map((st) => st.trim())
    .filter((searchTerm) => searchTerm.length > 0);
  let score = 0;
  const terms = termsForItem(item);
  for (const searchTerm of searchTerms) {
    for (let index = 0; index < terms.length; index++) {
      const term = terms[index];
      const weight = terms.length - index;
      const termWords = term.split("_");
      if (term.toLowerCase().includes(searchTerm.toLowerCase())) {
        score += weight;
      }
      if (term.toLowerCase() === searchTerm.toLowerCase()) {
        score += weight * 10;
      }
      if (term.toLowerCase().startsWith(searchTerm.toLowerCase())) {
        score += weight * 6;
      }
      if (
        termWords.some((termWord) =>
          termWord.toLowerCase().startsWith(searchTerm.toLowerCase())
        )
      ) {
        score += weight;
      }
    }
  }
  return score;
}

function termsForItem(item: FlatAnalysisItem) {
  if (item.type === "analysis") {
    return [item.path || "", item.sourceName];
  } else {
    return [item.source.name, item.model.path];
  }
}
