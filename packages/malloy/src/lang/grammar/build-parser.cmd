@REM # Copyright 2022 Google LLC
@REM #
@REM # This program is free software; you can redistribute it and/or
@REM # modify it under the terms of the GNU General Public License
@REM # version 2 as published by the Free Software Foundation.
@REM #
@REM # This program is distributed in the hope that it will be useful,
@REM # but WITHOUT ANY WARRANTY; without even the implied warranty of
@REM # MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
@REM # GNU General Public License for more details.
@REM #

@REM # Silly little hack to make it only run ANTLR when the grammar actually changes
@REM # BUG: If you go in $lib and delete a file which isn't MalloyParser.ts
@REM # this hack will fail. yarn clean will fix things though.

@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

SET lib=src/lang/lib/Malloy
SET digest=%lib%/Malloy.md5
SET target=%lib%/MalloyParser.ts

FOR /F "tokens=* USEBACKQ" %%V IN (`md5sum src\lang\grammar\Malloy.g4`) DO ( SET newmd5=%%V )
SET newmd5=%newmd5:~1,32%

SET oldmd5=Hash Not Found
IF EXIST %digest% FOR /F "tokens=* USEBACKQ" %%V IN ("%digest%") DO ( SET oldmd5=%%V )
SET oldmd5=%oldmd5:~0,32%

IF "%newmd5%" == "%oldmd5%" (
  @ECHO ANTLR parser %target% is up too date
) ELSE (
  @ECHO NEED TO BUILD
  antlr4ts -visitor -Xexact-output-dir -o %lib% src\lang\grammar\Malloy.g4 && echo %newmd5% > %digest%
)