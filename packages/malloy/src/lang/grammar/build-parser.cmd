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
@REM SET digest=%lib%/Malloy.md5

@REM SET index=1
@REM FOR /F "delims=" %%A IN ('certutil -hashfile Malloy.g4 MD5') DO (
@REM   CALL :parsemd5 %%A
@REM )

@REM SET oldmd5=Hash Not Found
@REM IF EXIST %digest% FOR /F "tokens=* USEBACKQ" %%V IN ("%digest%") DO ( SET oldmd5=%%V )
@REM SET oldmd5=%oldmd5:~0,32%

@ECHO ALWAYS REBUILD PARSER BECAUSE MTOY DOESN'T HAVE A WINDOWS MACHINE
@ECHO AND EVEN IF HE DID, HE DOESN'T HAVE SKILL IN WRITING CMD SCRIPTS
@REM IF "%newmd5%" != "%oldmd5%" (
  antlr4ts -Xexact-output-dir -o %lib% MalloyLexer.g4
  antlr4ts -visitor -listener -Xexact-output-dir -o %lib% MalloyParser.g4
@REM echo %newmd5% > %digest%
@REM )
@ECHO Antlr generated parser in %lib% is up to date

@REM :parsemd5
@REM IF /I %index% EQU 2 (
@REM   SET newmd5=%1
@REM )
@REM SET /a "index+=1"
GOTO :EOF
