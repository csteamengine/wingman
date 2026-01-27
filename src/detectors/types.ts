export interface DetectorAction {
    id: string;
    label: string;
    execute: (text: string) => string;
}

export interface DetectorResult {
    detectorId: string;
    toastMessage: string;
    actions: DetectorAction[];
}

export interface Detector {
    id: string;
    priority: number;
    detect: (text: string) => boolean;
    toastMessage: string;
    actions: DetectorAction[];
}
