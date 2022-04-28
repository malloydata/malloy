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

import { Model } from "../../types";

interface ModelListProps {
  models: Model[];
  setModel: (model: Model) => void;
}

export const ModelList: React.FC<ModelListProps> = ({ models, setModel }) => {
  return (
    <div>
      {models.map((model) => {
        return (
          <div key={model.path} onClick={() => setModel(model)}>
            {model.path}
          </div>
        );
      })}
    </div>
  );
};
