/*
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import * as Malloy from '@malloydata/malloy-interfaces';
import * as Core from './core';
import {v4 as uuidv4} from 'uuid';
import {Timer} from '../timing';

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
  query?: Malloy.Query;
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
  sessionId: string;
  timer: Timer;
  waitingTimer?: Timer;
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
  state: Core.CompileQueryState;
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
  private sessions: Map<string, SessionState> = new Map();

  private purgeExpired(options?: {except?: string}) {
    const now = new Date();
    for (const session of this.sessions.values()) {
      if (session.sessionId === options?.except) continue;
      if (session.expires && session.expires < now) {
        this.sessions.delete(session.sessionId);
      }
    }
  }

  private findSession(sessionId: string, sessionInfo: SessionInfo) {
    const session = this.sessions.get(sessionId);
    if (session && sessionInfosMatch(session.sessionInfo, sessionInfo)) {
      return session;
    }
  }

  private getExpires(ttl: TTL): Date {
    if (ttl instanceof Date) {
      return ttl;
    } else {
      // TODO is this how you do this?
      return new Date(Date.now() + ttl.seconds * 1000);
    }
  }

  private newSessionId() {
    let id: string;
    do {
      id = uuidv4();
    } while (this.sessions.has(id));
    return id;
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
      sessionId: this.newSessionId(),
      timer: new Timer('compile_model'),
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
      sessionId: this.newSessionId(),
      timer: new Timer('compile_source'),
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
      sessionId: this.newSessionId(),
      timer: new Timer('compile_query'),
    };
  }

  private findCompileModelSession(
    sessionId: string,
    sessionInfo: SessionInfoForCompileModel
  ): SessionStateForCompileModel | undefined {
    const session = this.findSession(sessionId, sessionInfo);
    if (session?.type === 'compile_model') {
      return session;
    }
  }

  private killSession(sessionId: string) {
    this.sessions.delete(sessionId);
  }

  public hasErrors(log: Malloy.LogMessage[] | undefined) {
    return Core.hasErrors(log);
  }

  public compileModel(
    request: Malloy.CompileModelRequest,
    options?: OptionsBase
  ): Malloy.CompileModelResponse & {session_id: string} {
    const sessionInfo: SessionInfoForCompileModel = {
      type: 'compile_model',
      modelURL: request.model_url,
      extendModelURL: request.extend_model_url,
    };
    let session =
      options?.session_id &&
      this.findCompileModelSession(options.session_id, sessionInfo);
    this.purgeExpired({except: options?.session_id});
    if (session) {
      if (session.waitingTimer) {
        session.timer.contribute([session.waitingTimer.stop()]);
        session.waitingTimer = undefined;
      }
      if (options?.ttl) {
        session.expires = this.getExpires(options.ttl);
      }
      Core.updateCompileModelState(session.state, request.compiler_needs);
    } else {
      session = this.newCompileModelSession(request, sessionInfo, options);
      this.sessions.set(session.sessionId, session);
    }
    const result = Core.statedCompileModel(session.state);
    session.timer.incorporate(result.timing_info);
    const done = result.model || this.hasErrors(result.logs);
    if (done) {
      this.killSession(session.sessionId);
    }
    // TODO not really using it as "stop", but more like "current"
    const timingInfo = session.timer.stop();
    if (!done) {
      session.waitingTimer = new Timer('session_wait');
    }
    return {
      ...result,
      session_id: session.sessionId,
      timing_info: timingInfo,
    };
  }

  private findCompileSourceSession(
    sessionId: string,
    sessionInfo: SessionInfoForCompileSource
  ): SessionStateForCompileSource | undefined {
    const session = this.findSession(sessionId, sessionInfo);
    if (session?.type === 'compile_source') {
      return session;
    }
  }

  public compileSource(
    request: Malloy.CompileSourceRequest,
    options?: OptionsBase
  ): Malloy.CompileSourceResponse & {session_id: string} {
    const sessionInfo: SessionInfoForCompileSource = {
      type: 'compile_source',
      modelURL: request.model_url,
      name: request.name,
      extendModelURL: request.extend_model_url,
    };
    let session =
      options?.session_id &&
      this.findCompileSourceSession(options.session_id, sessionInfo);
    this.purgeExpired({except: options?.session_id});
    if (session) {
      if (session.waitingTimer) {
        session.timer.contribute([session.waitingTimer.stop()]);
        session.waitingTimer = undefined;
      }
      if (options?.ttl) {
        session.expires = this.getExpires(options.ttl);
      }
      Core.updateCompileModelState(session.state, request.compiler_needs);
    } else {
      session = this.newCompileSourceSession(request, sessionInfo, options);
      this.sessions.set(session.sessionId, session);
    }
    const result = Core.statedCompileSource(session.state, request.name);
    session.timer.incorporate(result.timing_info);
    const done = result.source || this.hasErrors(result.logs);
    if (done) {
      this.killSession(session.sessionId);
    }
    const timingInfo = session.timer.stop();
    if (!done) {
      session.waitingTimer = new Timer('session_wait');
    }
    return {
      ...result,
      session_id: session.sessionId,
      timing_info: timingInfo,
    };
  }

  private findCompileQuerySession(
    sessionId: string,
    sessionInfo: SessionInfoForCompileQuery
  ): SessionStateForCompileQuery | undefined {
    const session = this.findSession(sessionId, sessionInfo);
    if (session?.type === 'compile_query') {
      return session;
    }
  }

  public compileQuery(
    request: Malloy.CompileQueryRequest,
    options?: OptionsBase
  ): Malloy.CompileQueryResponse & {session_id: string} {
    const queryString =
      request.query_malloy ??
      (request.query ? Malloy.queryToMalloy(request.query) : undefined);
    if (queryString === undefined) {
      throw new Error('Expected query_malloy or query');
    }
    const sessionInfo: SessionInfoForCompileQuery = {
      type: 'compile_query',
      modelURL: request.model_url,
      queryString,
      query: request.query,
    };
    let session =
      options?.session_id &&
      this.findCompileQuerySession(options.session_id, sessionInfo);
    this.purgeExpired({except: options?.session_id});
    if (session) {
      if (session.waitingTimer) {
        session.timer.contribute([session.waitingTimer.stop()]);
        session.waitingTimer = undefined;
      }
      if (options?.ttl) {
        session.expires = this.getExpires(options.ttl);
      }
      Core.updateCompileModelState(session.state, request.compiler_needs);
    } else {
      session = this.newCompileQuerySession(request, sessionInfo, options);
      this.sessions.set(session.sessionId, session);
    }
    const result = Core.statedCompileQuery(session.state);
    session.timer.incorporate(result.timing_info);
    const done = result.result || this.hasErrors(result.logs);
    if (done) {
      this.killSession(session.sessionId);
    }
    const timingInfo = session.timer.stop();
    if (!done) {
      session.waitingTimer = new Timer('session_wait');
    }
    return {
      ...result,
      session_id: session.sessionId,
      timing_info: timingInfo,
    };
  }
}

const SESSION_MANAGER = new SessionManager();

export type TTL = {'seconds': number} | Date;

export interface OptionsBase {
  ttl?: TTL;
  session_id?: string;
}

export function compileModel(
  request: Malloy.CompileModelRequest,
  options?: OptionsBase
): Malloy.CompileModelResponse & {session_id: string} {
  return SESSION_MANAGER.compileModel(request, options);
}

export function compileSource(
  request: Malloy.CompileSourceRequest,
  options?: OptionsBase
): Malloy.CompileSourceResponse & {session_id: string} {
  return SESSION_MANAGER.compileSource(request, options);
}

export function compileQuery(
  request: Malloy.CompileQueryRequest,
  options?: OptionsBase
): Malloy.CompileQueryResponse & {session_id: string} {
  return SESSION_MANAGER.compileQuery(request, options);
}
