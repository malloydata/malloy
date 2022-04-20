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

import { compileModel } from "../../core/compile";
import { Model, Analysis } from "../../types";
import { SelectDropdown } from "../SelectDropdown";

interface AnalysisPickerProps {
  models: Model[];
  analyses: Analysis[];
  analysis: Analysis | undefined;
  selectAnalysis: (analysable: Analysis) => void;
}

interface ModelSourceOption {
  type: "model/source";
  model: Model;
  sourceName: string;
  key: string;
}

interface AnalysisOption {
  type: "analysis";
  analysis: Analysis;
  key: string;
}

type Option = ModelSourceOption | AnalysisOption;

export const AnalysisPicker: React.FC<AnalysisPickerProps> = ({
  models,
  analyses,
  analysis,
  selectAnalysis,
}) => {
  const options: { key: string; value: Option; label: string }[] = [
    ...models.flatMap((model) =>
      model.sources.map((source) => {
        const option: Option = {
          model,
          sourceName: source.name,
          type: "model/source",
          key: `${model.fullPath}/${source.name}`,
        };
        return {
          key: option.key,
          value: option,
          label: `${model.path.replace(/\.malloy$/, "")} / ${source.name}`,
        };
      })
    ),
    ...analyses.map((analysis) => {
      const key = `${analysis.fullPath}/${analysis.sourceName}`;
      const option: Option = { type: "analysis", analysis, key };
      return {
        key,
        value: option,
        label: (analysis.path || "").replace(/\.a\.malloy$/, ""),
      };
    }),
  ];

  const value: Option | undefined = analysis
    ? { type: "analysis", analysis, key: analysis.id || "" }
    : undefined;

  return (
    <SelectDropdown
      value={value}
      options={options}
      onChange={(o: Option) => {
        if (o.type === "analysis") {
          selectAnalysis({ ...o.analysis, id: o.key });
        } else {
          const sourceName = `${o.sourceName}_analysis`;
          const code = `import "file://${o.model.fullPath}"\n\n explore: ${sourceName} is ${o.sourceName} {}`;
          compileModel(o.model.modelDef, code).then((modelDef) => {
            const analysis: Analysis = {
              type: "analysis",
              malloy: code,
              path: undefined,
              fullPath: undefined,
              modelFullPath: o.model.fullPath,
              sourceName,
              modelDef,
              id: o.key,
              dataStyles: o.model.dataStyles,
            };
            selectAnalysis(analysis);
          });
        }
      }}
      placeholder="Select analysis..."
      valueEqual={(a, b) => a.key === b.key}
    />
  );
};
