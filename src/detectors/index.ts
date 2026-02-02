import type {Detector, DetectorResult} from './types';
import {jwtDetector} from './jwt';
import {secretsDetector} from './secrets';
import {uuidDetector} from './uuid';
import {base64Detector} from './base64';
import {jsonYamlDetector} from './json-yaml';
import {urlDetector} from './url';
import {sqlDetector} from './sql';
import {xmlHtmlDetector} from './xml-html';
import {csvTsvDetector} from './csv-tsv';
import {colorDetector} from './color';
import {stackTraceDetector} from './stack-trace';
import {cssDetector} from './css';
import {envFileDetector} from './env-file';
import {filePathDetector} from './file-path';
import {timestampDetector} from './timestamp';
import {markdownDetector} from './markdown';
import {codeSnippetDetector} from './code-snippet';
import {plainTextDetector} from './plain-text';

const detectors: Detector[] = [
    jwtDetector,
    secretsDetector,
    uuidDetector,
    base64Detector,
    jsonYamlDetector,
    urlDetector,
    sqlDetector,
    xmlHtmlDetector,
    csvTsvDetector,
    colorDetector,
    stackTraceDetector,
    cssDetector,
    envFileDetector,
    filePathDetector,
    timestampDetector,
    markdownDetector,
    codeSnippetDetector,
    plainTextDetector,
].sort((a, b) => a.priority - b.priority);

export function detectContent(text: string): DetectorResult | null {
    if (!text || text.trim().length < 5) return null;

    for (const detector of detectors) {
        if (detector.detect(text)) {
            return {
                detectorId: detector.id,
                toastMessage: detector.getToastMessage ? detector.getToastMessage(text) : detector.toastMessage,
                actions: detector.getActions ? detector.getActions(text) : detector.actions,
                suggestedLanguage: detector.getSuggestedLanguage ? detector.getSuggestedLanguage(text) : detector.suggestedLanguage,
            };
        }
    }
    return null;
}

export type {DetectorResult, DetectorAction, DetectorActionResult} from './types';
