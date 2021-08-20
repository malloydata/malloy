/*
 * Copyright 2021 Google LLC
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

export function loadingIndicator(text = "Loading"): string {
  return `
		<style>
			.spinner {
				animation: rotation 2s infinite linear;
			}
			@keyframes rotation {
				from {
					transform: rotate(0deg);
				}
				to {
					transform: rotate(359deg);
				}
			}

			.vertical-center {
				display: flex;
				flex-direction: column;
				justify-content: center;
				flex: 1 0 auto;
				width: 100%;
				height: 100%;
			}

			.horizontal-center {
				display: flex;
				justify-content: center;
				align-items: center;
				flex-direction: column;
			}

			.label {
				margin-bottom: 10px;
				color: #505050;
				font-size: 15px;
			}
		</style>
		<div class="vertical-center">
			<div class="horizontal-center">
				<div class="label">${text}</div>
				<svg class="spinner" width="25px" height="25px" viewBox="0 0 15 15" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
					<title>malloy-icon-status-progress</title>
					<defs>
							<circle id="path-1" cx="7.5" cy="7.5" r="7.5"></circle>
							<mask id="mask-2" maskContentUnits="userSpaceOnUse" maskUnits="objectBoundingBox" x="0" y="0" width="15" height="15" fill="white">
									<use xlink:href="#path-1"></use>
							</mask>
					</defs>
					<g id="malloy-icon-status-progress" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd" stroke-dasharray="16">
							<use id="Oval-Copy-3" stroke="#1a73e8" mask="url(#mask-2)" stroke-width="3" transform="translate(7.500000, 7.500000) rotate(-240.000000) translate(-7.500000, -7.500000) " xlink:href="#path-1"></use>
					</g>
				</svg>
			</div>
		</div>
	`;
}

export function renderErrorHtml(error: Error): string {
  return wrapHTMLSnippet(`<div style="color: red;">${error.toString()}</div>`);
}

export function wrapHTMLSnippet(snippet: string): string {
  return `<!DOCTYPE html>
	<html lang="en">
		<head>
			<meta charset="UTF-8">
			<meta name="viewport" content="width=device-width, initial-scale=1.0">
			<title>Malloy Query Results</title>
			<style>
				body, html { height: 100%; }
			</style>
		</head>
		<body style="padding: 10px;">
			${snippet}
		</body>
	</html>`;
}
