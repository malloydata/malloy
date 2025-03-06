/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import * as Core from './core';

interface SessionInfoForCompileModel {
  type: 'compile_model';
  modelURL: string;
  extendModelURL?: string;
}

interface SessionInfoForCompileSource {
  type: 'compile_source';
  modelURL: string;
  extendModelURL?: string;
  name: string;
}

interface SessionInfoForCompileQuery {
  type: 'compile_query';
  modelURL: string;
  queryString: string;
  query: Malloy.Query;
}

type SessionInfo =
  | SessionInfoForCompileModel
  | SessionInfoForCompileSource
  | SessionInfoForCompileQuery;

type SessionState =
  | SessionStateForCompileModel
  | SessionStateForCompileSource
  | SessionStateForCompileQuery;

interface SessionStateBase {
  expires?: Date;
}

interface SessionStateForCompileModel extends SessionStateBase {
  type: 'compile_model';
  sessionInfo: SessionInfoForCompileModel;
  state: Core.CompileModelState;
}

interface SessionStateForCompileSource extends SessionStateBase {
  type: 'compile_source';
  sessionInfo: SessionInfoForCompileSource;
  state: Core.CompileModelState;
}

interface SessionStateForCompileQuery extends SessionStateBase {
  type: 'compile_query';
  sessionInfo: SessionInfoForCompileQuery;
  state: Core.CompileModelState;
}

function sessionInfosMatch(a: SessionInfo, b: SessionInfo) {
  if (a.type === 'compile_model') {
    if (b.type !== 'compile_model') return false;
    return a.modelURL === b.modelURL && a.extendModelURL === b.extendModelURL;
  } else if (a.type === 'compile_source') {
    if (b.type !== 'compile_source') return false;
    return (
      a.modelURL === b.modelURL &&
      a.extendModelURL === b.extendModelURL &&
      a.name === b.name
    );
  } else {
    if (b.type !== 'compile_query') return false;
    return a.modelURL === b.modelURL && a.queryString === b.queryString;
  }
}

class SessionManager {
  private sessions: SessionState[] = [];

  private purgeExpired(except?: SessionInfo) {
    const now = new Date();
    this.sessions = this.sessions.filter(
      s =>
        (except && sessionInfosMatch(s.sessionInfo, except)) ||
        s.expires === undefined ||
        s.expires > now
    );
  }

  private findSession(sessionInfo: SessionInfo) {
    const session = this.sessions.find(s =>
      sessionInfosMatch(s.sessionInfo, sessionInfo)
    );
    this.purgeExpired(sessionInfo);
    return session;
  }

  private getExpires(ttl: TTL): Date {
    if (ttl instanceof Date) {
      return ttl;
    } else {
      // TODO is this how you do this?
      return new Date(Date.now() + ttl.seconds * 1000);
    }
  }

  private newCompileModelSession(
    request: Malloy.CompileModelRequest,
    sessionInfo: SessionInfoForCompileModel,
    options?: OptionsBase
  ): SessionStateForCompileModel {
    const expires = options?.ttl ? this.getExpires(options.ttl) : undefined;
    const state = Core.newCompileModelState(request);
    return {
      type: 'compile_model',
      sessionInfo,
      state,
      expires,
    };
  }

  private newCompileSourceSession(
    request: Malloy.CompileSourceRequest,
    sessionInfo: SessionInfoForCompileSource,
    options?: OptionsBase
  ): SessionStateForCompileSource {
    const expires = options?.ttl ? this.getExpires(options.ttl) : undefined;
    const state = Core.newCompileSourceState(request);
    return {
      type: 'compile_source',
      sessionInfo,
      state,
      expires,
    };
  }

  private newCompileQuerySession(
    request: Malloy.CompileQueryRequest,
    sessionInfo: SessionInfoForCompileQuery,
    options?: OptionsBase
  ): SessionStateForCompileQuery {
    const expires = options?.ttl ? this.getExpires(options.ttl) : undefined;
    const state = Core.newCompileQueryState(request);
    return {
      type: 'compile_query',
      sessionInfo,
      state,
      expires,
    };
  }

  private findCompileModelSession(
    sessionInfo: SessionInfoForCompileModel
  ): SessionStateForCompileModel | undefined {
    const session = this.findSession(sessionInfo);
    if (session?.type === 'compile_model') {
      return session;
    }
  }

  private killSession(sessionInfo: SessionInfo) {
    this.sessions = this.sessions.filter(
      s => !sessionInfosMatch(s.sessionInfo, sessionInfo)
    );
  }

  public hasErrors(log: Malloy.LogMessage[] | undefined) {
    return Core.hasErrors(log);
  }

  public compileModel(
    request: Malloy.CompileModelRequest,
    options?: OptionsBase
  ): Malloy.CompileModelResponse {
    const sessionInfo: SessionInfoForCompileModel = {
      type: 'compile_model',
      modelURL: request.model_url,
      extendModelURL: request.extend_model_url,
    };
    let session = this.findCompileModelSession(sessionInfo);
    if (session) {
      Core.updateCompileModelState(session.state, request.compiler_needs);
    } else {
      session = this.newCompileModelSession(request, sessionInfo, options);
      this.sessions.push(session);
    }
    const result = Core.statedCompileModel(session.state);
    if (result.model || this.hasErrors(result.logs)) {
      this.killSession(sessionInfo);
    }
    return result;
  }

  private findCompileSourceSession(
    sessionInfo: SessionInfoForCompileSource
  ): SessionStateForCompileSource | undefined {
    const session = this.findSession(sessionInfo);
    if (session?.type === 'compile_source') {
      return session;
    }
  }

  public compileSource(
    request: Malloy.CompileSourceRequest,
    options?: OptionsBase
  ): Malloy.CompileSourceResponse {
    const sessionInfo: SessionInfoForCompileSource = {
      type: 'compile_source',
      modelURL: request.model_url,
      name: request.name,
      extendModelURL: request.extend_model_url,
    };
    let session = this.findCompileSourceSession(sessionInfo);
    if (session) {
      Core.updateCompileModelState(session.state, request.compiler_needs);
    } else {
      session = this.newCompileSourceSession(request, sessionInfo, options);
      this.sessions.push(session);
    }
    const result = Core.statedCompileSource(session.state, request.name);
    if (result.source || this.hasErrors(result.logs)) {
      this.killSession(sessionInfo);
    }
    return result;
  }

  private findCompileQuerySession(
    sessionInfo: SessionInfoForCompileQuery
  ): SessionStateForCompileQuery | undefined {
    const session = this.findSession(sessionInfo);
    if (session?.type === 'compile_query') {
      return session;
    }
  }

  public compileQuery(
    request: Malloy.CompileQueryRequest,
    options?: OptionsBase
  ): Malloy.CompileQueryResponse {
    const queryString = Malloy.queryToMalloy(request.query);
    const sessionInfo: SessionInfoForCompileQuery = {
      type: 'compile_query',
      modelURL: request.model_url,
      queryString,
      query: request.query,
    };
    let session = this.findCompileQuerySession(sessionInfo);
    if (session) {
      Core.updateCompileModelState(session.state, request.compiler_needs);
    } else {
      session = this.newCompileQuerySession(request, sessionInfo, options);
      this.sessions.push(session);
    }
    const result = Core.statedCompileQuery(session.state);
    if (result.result || this.hasErrors(result.logs)) {
      this.killSession(sessionInfo);
    }
    return result;
  }
}

const SESSION_MANAGER = new SessionManager();

export type TTL = {'seconds': number} | Date;

export interface OptionsBase {
  ttl?: TTL;
}

export function compileModel(
  request: Malloy.CompileModelRequest,
  options?: OptionsBase
): Malloy.CompileModelResponse {
  return SESSION_MANAGER.compileModel(request, options);
}

export function compileSource(
  request: Malloy.CompileSourceRequest,
  options?: OptionsBase
): Malloy.CompileSourceResponse {
  return SESSION_MANAGER.compileSource(request, options);
}

export function compileQuery(
  request: Malloy.CompileQueryRequest,
  options?: OptionsBase
): Malloy.CompileQueryResponse {
  return SESSION_MANAGER.compileQuery(request, options);
}
