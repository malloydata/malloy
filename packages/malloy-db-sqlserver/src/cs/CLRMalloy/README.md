# IMPORTANT! Must use Windows to build the dll.

`dotnet add package Microsoft.SqlServer.Server --version 1.0.0`
`dotnet build -c Release`

```tsql
sp_configure 'show advanced options', 1;
GO
RECONFIGURE;
GO
sp_configure 'clr enabled', 1;
GO
RECONFIGURE;
GO
```

```tsql
sp_configure 'clr strict security', 0;
GO
RECONFIGURE;
GO
```

```sh
docker exec -it malloysqlserver mkdir -p /var/opt/mssql/assemblies
```

```sh
docker cp \
./CLRMalloy.dll \
malloysqlserver:/var/opt/mssql/assemblies/CLRMalloy.dll
```

```tsql
CREATE ASSEMBLY CLRMalloy
    FROM '/var/opt/mssql/assemblies/CLRMalloy.dll'
    WITH PERMISSION_SET = SAFE;
GO
```

```tsql
CREATE FUNCTION malloytest.RegexpMatch(
    @input NVARCHAR(MAX),
    @pattern NVARCHAR(MAX)
)
    RETURNS BIT
AS
    EXTERNAL NAME CLRMalloy.[CLRMalloy.Regexp].Match;
GO
```
