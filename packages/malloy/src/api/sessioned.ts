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
}

interface SessionInfoForCompileSource {
  type: 'compile_source';
  modelURL: string;
  name: string;
}

interface SessionInfoForCompileQuery {
  type: 'compile_query';
  modelURL: string;
  query: string;
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
}

interface SessionStateForCompileQuery extends SessionStateBase {
  type: 'compile_query';
  sessionInfo: SessionInfoForCompileQuery;
}

function sessionInfosMatch(a: SessionInfo, b: SessionInfo) {
  if (a.type === 'compile_model') {
    if (b.type !== 'compile_model') return false;
    return a.modelURL === b.modelURL;
  } else if (a.type === 'compile_source') {
    if (b.type !== 'compile_source') return false;
    return a.modelURL === b.modelURL && a.name === b.name;
  } else {
    if (b.type !== 'compile_query') return false;
    return a.modelURL === b.modelURL && a.query === b.query;
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

  findSession(sessionInfo: SessionInfo) {
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

  newCompileModelSession(
    sessionInfo: SessionInfoForCompileModel,
    compilerNeeds?: Malloy.CompilerNeeds,
    options?: OptionsBase
  ): SessionStateForCompileModel {
    const expires = options?.ttl ? this.getExpires(options.ttl) : undefined;
    const state = Core.newCompileModelState(
      sessionInfo.modelURL,
      compilerNeeds,
      undefined
    );
    return {
      type: 'compile_model',
      sessionInfo,
      state,
      expires,
    };
  }

  newCompileSourceSession(
    _sessionInfo: SessionInfoForCompileSource
  ): SessionStateForCompileSource {
    throw new Error('Method not implemented.');
  }

  newCompileQuerySession(
    _sessionInfo: SessionInfoForCompileQuery
  ): SessionStateForCompileQuery {
    throw new Error('Method not implemented.');
  }

  private findCompileModelSession(
    sessionInfo: SessionInfoForCompileModel
  ): SessionStateForCompileModel | undefined {
    const session = this.findSession(sessionInfo);
    if (session?.type === 'compile_model') {
      return session;
    }
  }

  compileModel(
    request: Malloy.CompileModelRequest,
    options?: OptionsBase
  ): Malloy.CompileModelResponse {
    const sessionInfo: SessionInfoForCompileModel = {
      type: 'compile_model',
      modelURL: request.model_url,
    };
    let session = this.findCompileModelSession(sessionInfo);
    if (session) {
      Core.updateCompileModelState(session.state, request.compiler_needs);
    } else {
      session = this.newCompileModelSession(
        sessionInfo,
        request.compiler_needs,
        options
      );
      this.sessions.push(session);
    }
    return Core.statedCompileModel(session.state);
  }

  compileSource(
    request: Malloy.CompileSourceRequest,
    _options?: OptionsBase
  ): Malloy.CompileSourceResponse {
    const _sessionInfo = {
      type: 'compile_source',
      modelURL: request.model_url,
      name: request.name,
    };
    throw new Error('Method not implemented.');
  }

  compileQuery(
    request: Malloy.CompileQueryRequest,
    _options?: OptionsBase
  ): Malloy.CompileQueryResponse {
    const query = Malloy.queryToMalloy(request.query);
    const _sessionInfo = {
      type: 'compile_query',
      modelURL: request.model_url,
      query,
    };
    throw new Error('Method not implemented.');
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
