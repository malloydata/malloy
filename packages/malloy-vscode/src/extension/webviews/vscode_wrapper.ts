/*
 * Copyright 2022 Google LLC
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

/**
 * API exposed to webviews.
 *
 * @template StateType Type of the persisted state stored for the webview.
 */
export interface WebviewApi<StateType, MessageType> {
  /**
   * Post a message to the owner of the webview.
   *
   * @param message Data to post. Must be JSON serializable.
   */
  postMessage(message: MessageType): void;

  /**
   * Get the persistent state stored for this webview.
   *
   * @return The current state or `undefined` if no state has been set.
   */
  getState(): StateType | undefined;

  /**
   * Set the persistent state stored for this webview.
   *
   * @param newState New persisted state. This must be a JSON serializable object. Can be retrieved
   * using {@link getState}.
   *
   * @return The new state.
   */
  setState<T extends StateType | undefined>(newState: T): T;
}

/**
 * Acquire an instance of the webview API.
 *
 * This may only be called once in a webview's context. Attempting to call `acquireVsCodeApi` after it has already
 * been called will throw an exception.
 *
 * @template StateType Type of the persisted state stored for the webview.
 */
export function getVSCodeAPI<
  StateType = unknown,
  MessageType = unknown
>(): WebviewApi<StateType, MessageType> {
  return acquireVsCodeApi();
}
