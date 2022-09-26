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
@REM # this hack will fail. npm run clean will fix things though.

@ECHO OFF
SETLOCAL ENABLEDELAYEDEXPANSION

SET lib=../lib/Malloy
SET digest=%lib%/Malloy.md5
SET newmd5=

FOR %%F in (MalloyLexer.g4 MalloyParser.g4) DO (
  SET index=1
  FOR /F "delims=" %%A IN ('certutil -hashfile %%F MD5') DO (
    CALL :parsemd5 %%A
  )
)

SET oldmd5=Hash Not Found
IF EXIST %digest% FOR /F "tokens=* USEBACKQ" %%V IN ("%digest%") DO ( SET oldmd5=%%V )
SET oldmd5=%oldmd5:~0,64%

IF "%newmd5%" == "%oldmd5%" (
  @ECHO Antlr generated Malloy parser in %lib% is up to date
) ELSE (
  antlr4ts -Xexact-output-dir -o %lib% MalloyLexer.g4 && antlr4ts -visitor -listener -Xexact-output-dir -o %lib% MalloyParser.g4 && echo %newmd5% > %digest%
)

:parsemd5
IF /I %index% EQU 2 (
  SET newmd5=%newmd5%%1
)
SET /a "index+=1"
GOTO :EOF
