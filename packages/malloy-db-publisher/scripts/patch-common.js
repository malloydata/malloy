#!/usr/bin/env node
/* tslint:disable */
/* eslint-disable */
/**
 * Post-generation script to patch generated files after OpenAPI Generator runs.
 * This ensures that:
 * 1. configuration.baseOptions (including timeout) is merged into axios requests in common.ts
 * 2. RawAxiosRequestConfig is exported from index.ts
 *
 * This is a JavaScript version that can run without ts-node.
 */

const fs = require('fs');
const path = require('path');

const commonTsPath = path.join(__dirname, '../src/client/common.ts');
const indexTsPath = path.join(__dirname, '../src/client/index.ts');

let patched = false;

// Patch common.ts
console.log('Patching common.ts to merge baseOptions into axios requests...');

if (fs.existsSync(commonTsPath)) {
    let content = fs.readFileSync(commonTsPath, 'utf8');

    // Check if already patched
    if (!content.includes('...configuration?.baseOptions')) {
        // Pattern to match the old createRequestFunction implementation
        // We're looking for: const axiosRequestArgs = {...axiosArgs.options, url: ...
        // This pattern handles both single-line and multi-line formats
        const oldPattern = /(const axiosRequestArgs = )\{\.\.\.axiosArgs\.options([^}]*url: [^}]+)\}/s;

        if (oldPattern.test(content)) {
            // Replace with the patched version that includes baseOptions
            content = content.replace(
                oldPattern,
                (match, prefix, suffix) => {
                    // Extract the url line and format it properly
                    const urlMatch = suffix.match(/url: ([^}]+)/);
                    const urlLine = urlMatch ? urlMatch[1].trim() : '(axios.defaults.baseURL ? \'\' : configuration?.basePath ?? basePath) + axiosArgs.url';

                    // Check if the original was single-line or multi-line
                    const isMultiline = suffix.includes('\n');
                    const indent = isMultiline ? '            ' : '        ';

                    return `${prefix}{\n${indent}...configuration?.baseOptions,\n${indent}...axiosArgs.options,\n${indent}url: ${urlLine}\n        }`;
                }
            );

            fs.writeFileSync(commonTsPath, content, 'utf8');
            console.log('✓ Successfully patched common.ts');
            patched = true;
        } else {
            console.error('✗ Could not find the expected pattern in common.ts');
            console.error('The file format may have changed. Please check manually.');
        }
    } else {
        console.log('✓ common.ts already patched, skipping...');
    }
} else {
    console.log('⚠ common.ts not found, skipping...');
}

// Patch index.ts
console.log('Patching index.ts to add RawAxiosRequestConfig import and export...');

if (fs.existsSync(indexTsPath)) {
    let content = fs.readFileSync(indexTsPath, 'utf8');
    let needsImport = !content.includes("import type {RawAxiosRequestConfig} from 'axios';");
    let needsExport = !content.includes('export type {RawAxiosRequestConfig};');

    if (needsImport || needsExport) {
        // Add import if missing
        if (needsImport) {
            // Find the end of the comment block (after "Do not edit the class manually.")
            // Look for the closing */ followed by newline(s) and then exports
            const commentEndPattern = /(\*\/\s*\n\s*)(export \* from)/;
            const commentEndMatch = content.match(commentEndPattern);

            if (commentEndMatch) {
                // Insert import after the comment block, before the exports
                const insertIndex = commentEndMatch.index + commentEndMatch[1].length;
                content = content.slice(0, insertIndex) + "import type {RawAxiosRequestConfig} from 'axios';\n\n" + content.slice(insertIndex);
            } else {
                // If pattern not found, try to find just the comment end
                const simpleCommentEnd = content.match(/(\*\/\s*\n)/);
                if (simpleCommentEnd) {
                    const insertIndex = simpleCommentEnd.index + simpleCommentEnd[0].length;
                    content = content.slice(0, insertIndex) + "import type {RawAxiosRequestConfig} from 'axios';\n\n" + content.slice(insertIndex);
                } else {
                    // Fallback: add before first export
                    const firstExportMatch = content.match(/export \* from/);
                    if (firstExportMatch) {
                        const insertIndex = firstExportMatch.index;
                        content = content.slice(0, insertIndex) + "import type {RawAxiosRequestConfig} from 'axios';\n\n" + content.slice(insertIndex);
                    }
                }
            }
        }

        // Add export if missing
        if (needsExport) {
            // Find all export statements
            const exportMatches = content.match(/export \* from ['"].*['"];/g);

            if (exportMatches && exportMatches.length > 0) {
                // Find the last export statement and add the export after it
                const lastExport = exportMatches[exportMatches.length - 1];
                const lastExportIndex = content.lastIndexOf(lastExport);
                const insertIndex = lastExportIndex + lastExport.length;

                // Insert the export after the last export statement
                content = content.slice(0, insertIndex) + '\nexport type {RawAxiosRequestConfig};' + content.slice(insertIndex);
            } else {
                // If no export statements found, add it at the end
                content = content.trim() + '\n\nexport type {RawAxiosRequestConfig};';
            }
        }

        fs.writeFileSync(indexTsPath, content, 'utf8');
        console.log('✓ Successfully patched index.ts');
        patched = true;
    } else {
        console.log('✓ index.ts already patched, skipping...');
    }
} else {
    console.log('⚠ index.ts not found, skipping...');
}

if (!patched) {
    console.log('No patches applied.');
}
