export interface DetectorActionResult {
    text: string;
    validationMessage?: string;
    validationType?: 'success' | 'error';
    errorLine?: number;
    errorColumn?: number;
}

export interface DetectorAction {
    id: string;
    label: string;
    execute: (text: string) => string | DetectorActionResult;
}

export interface DetectorResult {
    detectorId: string;
    toastMessage: string;
    actions: DetectorAction[];
    suggestedLanguage?: string;
}

export interface Detector {
    id: string;
    priority: number;
    detect: (text: string) => boolean;
    toastMessage: string;
    getToastMessage?: (text: string) => string;
    actions: DetectorAction[];
    getActions?: (text: string) => DetectorAction[];
    suggestedLanguage?: string;
    getSuggestedLanguage?: (text: string) => string | undefined;
}
