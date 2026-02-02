import type {Detector, DetectorAction} from './types';

// Color format patterns
const HEX_COLOR_RE = /#(?:[0-9a-fA-F]{3}){1,2}\b/;
const HEX8_COLOR_RE = /#(?:[0-9a-fA-F]{4}){1,2}\b/; // with alpha
const RGB_COLOR_RE = /rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)/i;
const RGBA_COLOR_RE = /rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*([\d.]+)\s*\)/i;
const HSL_COLOR_RE = /hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)/i;
const HSLA_COLOR_RE = /hsla\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*,\s*([\d.]+)\s*\)/i;

interface ColorValue {
    r: number;
    g: number;
    b: number;
    a: number;
}

function parseHex(hex: string): ColorValue | null {
    const h = hex.replace('#', '');
    let r: number, g: number, b: number, a = 1;

    if (h.length === 3) {
        r = parseInt(h[0] + h[0], 16);
        g = parseInt(h[1] + h[1], 16);
        b = parseInt(h[2] + h[2], 16);
    } else if (h.length === 4) {
        r = parseInt(h[0] + h[0], 16);
        g = parseInt(h[1] + h[1], 16);
        b = parseInt(h[2] + h[2], 16);
        a = parseInt(h[3] + h[3], 16) / 255;
    } else if (h.length === 6) {
        r = parseInt(h.substring(0, 2), 16);
        g = parseInt(h.substring(2, 4), 16);
        b = parseInt(h.substring(4, 6), 16);
    } else if (h.length === 8) {
        r = parseInt(h.substring(0, 2), 16);
        g = parseInt(h.substring(2, 4), 16);
        b = parseInt(h.substring(4, 6), 16);
        a = parseInt(h.substring(6, 8), 16) / 255;
    } else {
        return null;
    }

    return {r, g, b, a};
}

function parseRgb(text: string): ColorValue | null {
    const rgbaMatch = text.match(RGBA_COLOR_RE);
    if (rgbaMatch) {
        return {
            r: parseInt(rgbaMatch[1], 10),
            g: parseInt(rgbaMatch[2], 10),
            b: parseInt(rgbaMatch[3], 10),
            a: parseFloat(rgbaMatch[4]),
        };
    }

    const rgbMatch = text.match(RGB_COLOR_RE);
    if (rgbMatch) {
        return {
            r: parseInt(rgbMatch[1], 10),
            g: parseInt(rgbMatch[2], 10),
            b: parseInt(rgbMatch[3], 10),
            a: 1,
        };
    }

    return null;
}

function hslToRgb(h: number, s: number, l: number): {r: number; g: number; b: number} {
    h /= 360;
    s /= 100;
    l /= 100;

    let r: number, g: number, b: number;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number): number => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255),
    };
}

function parseHsl(text: string): ColorValue | null {
    const hslaMatch = text.match(HSLA_COLOR_RE);
    if (hslaMatch) {
        const {r, g, b} = hslToRgb(
            parseInt(hslaMatch[1], 10),
            parseInt(hslaMatch[2], 10),
            parseInt(hslaMatch[3], 10)
        );
        return {r, g, b, a: parseFloat(hslaMatch[4])};
    }

    const hslMatch = text.match(HSL_COLOR_RE);
    if (hslMatch) {
        const {r, g, b} = hslToRgb(
            parseInt(hslMatch[1], 10),
            parseInt(hslMatch[2], 10),
            parseInt(hslMatch[3], 10)
        );
        return {r, g, b, a: 1};
    }

    return null;
}

function extractColor(text: string): ColorValue | null {
    // Try each format
    const hexMatch = text.match(HEX8_COLOR_RE) || text.match(HEX_COLOR_RE);
    if (hexMatch) return parseHex(hexMatch[0]);

    const rgb = parseRgb(text);
    if (rgb) return rgb;

    const hsl = parseHsl(text);
    if (hsl) return hsl;

    return null;
}

function rgbToHsl(r: number, g: number, b: number): {h: number; s: number; l: number} {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
                break;
            case g:
                h = ((b - r) / d + 2) / 6;
                break;
            case b:
                h = ((r - g) / d + 4) / 6;
                break;
        }
    }

    return {
        h: Math.round(h * 360),
        s: Math.round(s * 100),
        l: Math.round(l * 100),
    };
}

function colorToHex(color: ColorValue): string {
    const r = color.r.toString(16).padStart(2, '0');
    const g = color.g.toString(16).padStart(2, '0');
    const b = color.b.toString(16).padStart(2, '0');
    if (color.a < 1) {
        const a = Math.round(color.a * 255).toString(16).padStart(2, '0');
        return `#${r}${g}${b}${a}`;
    }
    return `#${r}${g}${b}`;
}

function colorToRgb(color: ColorValue): string {
    if (color.a < 1) {
        return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
    }
    return `rgb(${color.r}, ${color.g}, ${color.b})`;
}

function colorToHsl(color: ColorValue): string {
    const {h, s, l} = rgbToHsl(color.r, color.g, color.b);
    if (color.a < 1) {
        return `hsla(${h}, ${s}%, ${l}%, ${color.a})`;
    }
    return `hsl(${h}, ${s}%, ${l}%)`;
}

function hasColor(text: string): boolean {
    return (
        HEX_COLOR_RE.test(text) ||
        HEX8_COLOR_RE.test(text) ||
        RGB_COLOR_RE.test(text) ||
        RGBA_COLOR_RE.test(text) ||
        HSL_COLOR_RE.test(text) ||
        HSLA_COLOR_RE.test(text)
    );
}

function findAndReplaceColor(text: string, converter: (color: ColorValue) => string): string {
    const patterns = [
        {re: new RegExp(HSLA_COLOR_RE.source, 'gi'), parser: parseHsl},
        {re: new RegExp(HSL_COLOR_RE.source, 'gi'), parser: parseHsl},
        {re: new RegExp(RGBA_COLOR_RE.source, 'gi'), parser: parseRgb},
        {re: new RegExp(RGB_COLOR_RE.source, 'gi'), parser: parseRgb},
        {re: new RegExp(HEX8_COLOR_RE.source, 'gi'), parser: parseHex},
        {re: new RegExp(HEX_COLOR_RE.source, 'gi'), parser: parseHex},
    ];

    let result = text;
    for (const {re, parser} of patterns) {
        result = result.replace(re, (match) => {
            const color = parser(match);
            return color ? converter(color) : match;
        });
    }
    return result;
}

export const colorDetector: Detector = {
    id: 'color',
    priority: 10,
    detect: hasColor,
    toastMessage: 'Color value detected',
    getToastMessage: (text: string) => {
        const color = extractColor(text);
        if (!color) return 'Color value detected';
        const hex = colorToHex(color);
        return `Color detected: ${hex}`;
    },
    actions: [],
    getActions: (text: string): DetectorAction[] => {
        const actions: DetectorAction[] = [];

        // Determine current format and offer conversions
        const hasHex = HEX_COLOR_RE.test(text) || HEX8_COLOR_RE.test(text);
        const hasRgb = RGB_COLOR_RE.test(text) || RGBA_COLOR_RE.test(text);
        const hasHsl = HSL_COLOR_RE.test(text) || HSLA_COLOR_RE.test(text);

        if (!hasHex || hasRgb || hasHsl) {
            actions.push({
                id: 'to-hex',
                label: 'To Hex',
                execute: (t: string) => findAndReplaceColor(t, colorToHex),
            });
        }

        if (hasHex || !hasRgb || hasHsl) {
            actions.push({
                id: 'to-rgb',
                label: 'To RGB',
                execute: (t: string) => findAndReplaceColor(t, colorToRgb),
            });
        }

        if (hasHex || hasRgb || !hasHsl) {
            actions.push({
                id: 'to-hsl',
                label: 'To HSL',
                execute: (t: string) => findAndReplaceColor(t, colorToHsl),
            });
        }

        return actions;
    },
};
