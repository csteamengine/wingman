import type {Detector, DetectorResult} from './types';
import {secretsDetector} from './secrets';
import {jsonYamlDetector} from './json-yaml';
import {stackTraceDetector} from './stack-trace';
import {envFileDetector} from './env-file';
import {sqlDetector} from './sql';
import {csvTsvDetector} from './csv-tsv';
import {uuidDetector} from './uuid';
import {base64Detector} from './base64';
import {timestampDetector} from './timestamp';
import {codeSnippetDetector} from './code-snippet';
import {filePathDetector} from './file-path';

const detectors: Detector[] = [
    secretsDetector,
    jsonYamlDetector,
    stackTraceDetector,
    envFileDetector,
    sqlDetector,
    csvTsvDetector,
    uuidDetector,
    base64Detector,
    timestampDetector,
    codeSnippetDetector,
    filePathDetector,
].sort((a, b) => a.priority - b.priority);

export function detectContent(text: string): DetectorResult | null {
    if (!text || text.trim().length < 5) return null;

    for (const detector of detectors) {
        if (detector.detect(text)) {
            return {
                detectorId: detector.id,
                toastMessage: detector.getToastMessage ? detector.getToastMessage(text) : detector.toastMessage,
                actions: detector.actions,
            };
        }
    }
    return null;
}

export type {DetectorResult, DetectorAction} from './types';
