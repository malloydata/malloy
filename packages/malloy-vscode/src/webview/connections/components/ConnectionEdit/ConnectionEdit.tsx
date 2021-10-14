import React, { useState } from "react";
import styled from "styled-components";
import {
  BigQueryConnection,
  Connection,
  PostgresConnection,
} from "../../types";
import { Button } from "../Button";

interface ConnectionEditProps {
  connection: Connection;
  setConnection: (connection: Connection) => void;
}

interface InputProps {
  value: string;
  setValue: (value: string) => void;
}

export const Input: React.FC<InputProps> = ({ value, setValue }) => {
  return (
    <StyledInput
      type="text"
      value={value}
      onChange={(event) => setValue(event.target.value)}
    />
  );
};

const StyledInput = styled.input`
  border-radius: 0px;
  padding: 4px;
  border: 1px solid rgb(204, 204, 204);
  outline: none;

  &:focus {
    outline: 1px solid #007ad2;
  }
`;

export const ConnectionEdit: React.FC<ConnectionEditProps> = ({
  connection,
  setConnection,
}) => {
  const [type, setType] = useState<"bigquery" | "postgres">("bigquery");
  return (
    <div>
      <TypeSelectRow>
        <Button
          disabled={type === "bigquery"}
          onClick={() => setType("bigquery")}
          inverted
        >
          BigQuery
        </Button>
        <Button
          disabled={type === "postgres"}
          onClick={() => setType("postgres")}
          inverted
        >
          PostgreSQL
        </Button>
      </TypeSelectRow>
      {type === "bigquery" && (
        <BigQueryConnectionEdit
          connection={{ ...connection, type: "bigquery" }}
          setConnection={setConnection}
        />
      )}
      {type === "postgres" && (
        <PostgresConnectionEdit
          connection={{
            ...connection,
            type: "postgres",
            host: "",
            port: 5432,
            username: "",
            password: "",
            database: "",
          }}
          setConnection={setConnection}
        />
      )}
    </div>
  );
};

interface BigQueryConnectionEditProps {
  connection: BigQueryConnection;
  setConnection: (connection: BigQueryConnection) => void;
}

export const BigQueryConnectionEdit: React.FC<BigQueryConnectionEditProps> = ({
  connection,
  setConnection,
}) => {
  const [name, setName] = useState(connection.name);
  const [projectId, setProjectId] = useState(connection.projectId);
  return (
    <div>
      <FormRow>
        <FormLabel>
          <Required>Name</Required>
        </FormLabel>
        <Input value={name} setValue={setName}></Input>
      </FormRow>
      <FormRow>
        <FormLabel>Project ID</FormLabel>
        <Input
          value={projectId || ""}
          setValue={(value) => setProjectId(value === "" ? undefined : value)}
        ></Input>
        <FormDescription>
          If none is provided, the default Project ID for the{" "}
          <code>gcloud</code> utility will be used.
        </FormDescription>
      </FormRow>
      <Button
        onClick={() => setConnection({ name, type: "bigquery", projectId })}
      >
        Save
      </Button>
    </div>
  );
};

const FormDescription = styled.div`
  color: rgb(164, 164, 164);
`;

const FormLabel = styled.label`
  display: block;
`;

const FormRow = styled.div`
  margin-bottom: 8px;
`;

const TypeSelectRow = styled.div`
  display: flex;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
`;

const Required = styled.span`
  &:after {
    content: "*";
    color: #cc4040;
  }
`;

interface PostgresConnectionEditProps {
  connection: PostgresConnection;
  setConnection: (connection: PostgresConnection) => void;
}

export const PostgresConnectionEdit: React.FC<PostgresConnectionEditProps> = ({
  connection,
  setConnection,
}) => {
  const [name, setName] = useState(connection.name);
  const [host, setHost] = useState(connection.host);
  const [port, setPort] = useState(connection.port);
  const [username, setUsername] = useState(connection.username);
  const [password, setPassword] = useState(connection.password);
  const [database, setDatabase] = useState(connection.database);
  return (
    <div>
      <FormRow>
        <FormLabel>
          <Required>Name</Required>
        </FormLabel>
        <Input value={name} setValue={setName}></Input>
      </FormRow>
      <FormRow>
        <FormLabel>
          <Required>Host</Required>
        </FormLabel>
        <Input value={host} setValue={setHost}></Input>
      </FormRow>
      <FormRow>
        <FormLabel>
          <Required>Port</Required>
        </FormLabel>
        <Input
          value={port.toString()}
          setValue={(value) => setPort(parseInt(value))}
        ></Input>
      </FormRow>
      <FormRow>
        <FormLabel>
          <Required>Username</Required>
        </FormLabel>
        <Input value={username} setValue={setUsername}></Input>
      </FormRow>
      <FormRow>
        <FormLabel>
          <Required>Password</Required>
        </FormLabel>
        <Input value={password} setValue={setPassword}></Input>
      </FormRow>
      <FormRow>
        <FormLabel>
          <Required>Database</Required>
        </FormLabel>
        <Input value={database} setValue={setDatabase}></Input>
      </FormRow>
      <Button
        onClick={() =>
          setConnection({
            name,
            type: "postgres",
            host,
            port,
            username,
            password,
            database,
          })
        }
      >
        Save
      </Button>
    </div>
  );
};
