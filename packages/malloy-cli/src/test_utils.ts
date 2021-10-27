/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { Loggable } from "./index";

export class TestLogger implements Loggable {
  errors: any[] = [];
  infos: any[] = [];
  warns: any[] = [];
  debugs: any[] = [];

  debug(message?: any, ...optionalParams: any[]): void {
    this.debugs.push(message);
  }

  info(message?: any, ...optionalParams: any[]): void {
    this.infos.push(message);
  }

  warn(message?: any, ...optionalParams: any[]): void {
    this.warns.push(message);
  }

  error(message?: any, ...optionalParams: any[]): void {
    this.errors.push(message);
  }
}
