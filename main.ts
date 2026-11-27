// news-image-20261127 — a one-page newspaper front page for Friday 27 November 2026.
// Drawn entirely in code with the Node standard library only (no network, no fonts
// on disk). Deterministic: the same input always produces the same PNG bytes.
//
// Layout: masthead, one lead story (EU budget summit deadlock), two mid stories
// (New Zealand election count, Australia sanctions), an IN BRIEF strip (ECB,
// Japan defence plan, Indonesia court case, markets), and a sources footer.

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

const W = 1024;
const H = 1024;

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------
const PAPER: RGBA = [253, 253, 247, 255];
const INK: RGBA = [17, 17, 17, 255];
const RED: RGBA = [166, 25, 46, 255];
const BLUE: RGBA = [31, 58, 143, 255];
const GOLD: RGBA = [242, 194, 0, 255];
const GREY: RGBA = [102, 102, 102, 255];
const LIGHT_GREY: RGBA = [228, 228, 220, 255];
const GREEN: RGBA = [34, 120, 74, 255];
const SKY: RGBA = [214, 232, 245, 255];

type RGBA = [number, number, number, number];

// ---------------------------------------------------------------------------
// Canvas: a plain RGBA buffer with tiny drawing primitives.
// ---------------------------------------------------------------------------
const px = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  px[i * 4] = PAPER[0];
  px[i * 4 + 1] = PAPER[1];
  px[i * 4 + 2] = PAPER[2];
  px[i * 4 + 3] = PAPER[3];
}

function setPixel(x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const o = (y * W + x) * 4;
  px[o] = c[0];
  px[o + 1] = c[1];
  px[o + 2] = c[2];
  px[o + 3] = c[3];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGBA): void {
  const x0 = Math.max(0, x);
  const y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w);
  const y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const o = (yy * W + xx) * 4;
      px[o] = c[0];
      px[o + 1] = c[1];
      px[o + 2] = c[2];
      px[o + 3] = c[3];
    }
  }
}

function hline(x: number, y: number, w: number, c: RGBA, t = 1): void {
  fillRect(x, y, w, t, c);
}

function vline(x: number, y: number, h: number, c: RGBA, t = 1): void {
  fillRect(x, y, t, h, c);
}

function border(x: number, y: number, w: number, h: number, c: RGBA, t = 1): void {
  hline(x, y, w, c, t);
  hline(x, y + h - t, w, c, t);
  vline(x, y, h, c, t);
  vline(x + w - t, y, h, c, t);
}

function fillCircle(cx: number, cy: number, r: number, c: RGBA): void {
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    fillRect(cx - dx, cy + dy, dx * 2 + 1, 1, c);
  }
}

function circleOutline(cx: number, cy: number, r: number, c: RGBA, t = 2): void {
  for (let a = 0; a < 360; a += 1) {
    const rad = (a * Math.PI) / 180;
    for (let k = 0; k < t; k++) {
      setPixel(
        Math.round(cx + (r - k) * Math.cos(rad)),
        Math.round(cy + (r - k) * Math.sin(rad)),
        c,
      );
    }
  }
}

// Bresenham line.
function line(x0: number, y0: number, x1: number, y1: number, c: RGBA, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}

// Scanline fill of a simple polygon given as [x, y, x, y, ...].
function fillPolygon(points: number[], c: RGBA): void {
  let minY = H;
  let maxY = 0;
  for (let i = 1; i < points.length; i += 2) {
    minY = Math.min(minY, points[i]);
    maxY = Math.max(maxY, points[i]);
  }
  const n = points.length / 2;
  for (let y = minY; y <= maxY; y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const x1 = points[i * 2];
      const y1 = points[i * 2 + 1];
      const x2 = points[((i + 1) % n) * 2];
      const y2 = points[((i + 1) % n) * 2 + 1];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        xs.push(x1 + ((y - y1) * (x2 - x1)) / (y2 - y1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      fillRect(Math.ceil(xs[k]), y, Math.floor(xs[k + 1]) - Math.ceil(xs[k]), 1, c);
    }
  }
}

// A small five-pointed star centred at (cx, cy), outer radius r.
function star(cx: number, cy: number, r: number, c: RGBA): void {
  const pts: number[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = (i * Math.PI) / 5 - Math.PI / 2;
    const rr = i % 2 === 0 ? r : r * 0.45;
    pts.push(Math.round(cx + rr * Math.cos(rad)), Math.round(cy + rr * Math.sin(rad)));
  }
  fillPolygon(pts, c);
}

// ---------------------------------------------------------------------------
// Bitmap font: 5x7 glyphs, drawn from scratch. Upper and lower case, digits
// and common punctuation. Each glyph is 7 rows of 5 bits.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  a: ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
  b: ["10000", "10000", "11110", "10001", "10001", "10001", "11110"],
  c: ["00000", "00000", "01110", "10000", "10000", "10001", "01110"],
  d: ["00001", "00001", "01111", "10001", "10001", "10001", "01111"],
  e: ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
  f: ["00110", "01000", "01000", "11110", "01000", "01000", "01000"],
  g: ["00000", "01111", "10001", "10001", "01111", "00001", "01110"],
  h: ["10000", "10000", "11110", "10001", "10001", "10001", "10001"],
  i: ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
  j: ["00010", "00000", "00110", "00010", "00010", "10010", "01100"],
  k: ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
  l: ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
  m: ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
  n: ["00000", "00000", "11110", "10001", "10001", "10001", "10001"],
  o: ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
  p: ["00000", "00000", "11110", "10001", "10001", "11110", "10000"],
  q: ["00000", "00000", "01111", "10001", "10001", "01111", "00001"],
  r: ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
  s: ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
  t: ["01000", "01000", "11100", "01000", "01000", "01000", "00110"],
  u: ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
  v: ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
  w: ["00000", "00000", "10001", "10101", "10101", "10101", "01010"],
  x: ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
  y: ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
  z: ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
  "'": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
  ":": ["00000", "01100", "01100", "00000", "01100", "01100", "00000"],
  ";": ["00000", "01100", "01100", "00000", "01100", "00100", "01000"],
  "!": ["00100", "00100", "00100", "00100", "00100", "00000", "00100"],
  "?": ["01110", "10001", "00001", "00010", "00100", "00000", "00100"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  "—": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
  "(": ["00010", "00100", "01000", "01000", "01000", "00100", "00010"],
  ")": ["01000", "00100", "00010", "00010", "00010", "00100", "01000"],
  "/": ["00001", "00010", "00010", "00100", "01000", "01000", "10000"],
  "%": ["11001", "11010", "00010", "00100", "01000", "01011", "10011"],
  "+": ["00000", "00100", "00100", "01110", "00100", "00100", "00000"],
  "=": ["00000", "00000", "11111", "00000", "11111", "00000", "00000"],
  "&": ["01100", "10010", "10100", "01000", "10101", "10010", "01101"],
  '"': ["01010", "01010", "00000", "00000", "00000", "00000", "00000"],
  "*": ["00000", "10101", "01110", "11111", "01110", "10101", "00000"],
  "•": ["00000", "00000", "01100", "01100", "01100", "00000", "00000"],
  "$": ["00100", "01111", "10100", "01110", "00101", "11110", "00100"],
  "’": ["00100", "00100", "01000", "00000", "00000", "00000", "00000"],
};

const GLYPH_W = 5;
const GLYPH_H = 7;
const GLYPH_ADV = 6; // glyph width + 1px gap, in font units

function drawGlyph(ch: string, x: number, y: number, s: number, c: RGBA): void {
  const g = FONT[ch];
  if (!g) return;
  for (let r = 0; r < GLYPH_H; r++) {
    const row = g[r];
    for (let col = 0; col < GLYPH_W; col++) {
      if (row[col] === "1") {
        fillRect(x + col * s, y + r * s, s, s, c);
      }
    }
  }
}

function textWidth(text: string, s: number): number {
  if (text.length === 0) return 0;
  return text.length * GLYPH_ADV * s - s;
}

function drawText(text: string, x: number, y: number, s: number, c: RGBA): number {
  let cx = x;
  for (const ch of text) {
    drawGlyph(ch, cx, y, s, c);
    cx += GLYPH_ADV * s;
  }
  return cx - x;
}

function drawTextCentered(text: string, cx: number, y: number, s: number, c: RGBA): void {
  drawText(text, cx - Math.floor(textWidth(text, s) / 2), y, s, c);
}

// Greedy word wrap; returns lines that fit maxW pixels at scale s.
function wrapText(text: string, s: number, maxW: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur === "" ? w : cur + " " + w;
    if (textWidth(trial, s) <= maxW || cur === "") {
      cur = trial;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}

function drawPara(
  text: string,
  x: number,
  y: number,
  s: number,
  c: RGBA,
  maxW: number,
  lineGap = 4,
): number {
  const lines = wrapText(text, s, maxW);
  let yy = y;
  for (const ln of lines) {
    drawText(ln, x, yy, s, c);
    yy += GLYPH_H * s + lineGap;
  }
  return yy;
}

// ---------------------------------------------------------------------------
// PNG encoder (deterministic: fixed filter 0, fixed zlib level, no ancillary
// chunks, so identical input bytes always give identical output bytes).
// ---------------------------------------------------------------------------
const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(H * (1 + W * 4));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 4)] = 0; // filter: none
    px.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Illustrations (all drawn with the primitives above).
// ---------------------------------------------------------------------------

// EU flag: blue disc with a ring of twelve gold stars.
function drawEuFlag(cx: number, cy: number, r: number): void {
  fillCircle(cx, cy, r, BLUE);
  circleOutline(cx, cy, r, INK, 2);
  const ring = Math.round(r * 0.68);
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6 - Math.PI / 2;
    star(
      Math.round(cx + ring * Math.cos(a)),
      Math.round(cy + ring * Math.sin(a)),
      Math.max(5, Math.round(r * 0.09)),
      GOLD,
    );
  }
}

// A simple parliament building: base, columns, triangular roof.
function drawParliament(x: number, y: number, w: number, h: number): void {
  const roofH = Math.round(h * 0.28);
  fillPolygon([x, y + roofH, x + w / 2, y, x + w, y + roofH], INK);
  fillRect(x, y + roofH, w, Math.round(h * 0.1), INK);
  const cols = 6;
  const colW = Math.round(w / (cols * 2 + 1));
  const bodyY = y + roofH + Math.round(h * 0.1);
  const bodyH = h - roofH - Math.round(h * 0.1) - Math.round(h * 0.12);
  for (let i = 0; i < cols; i++) {
    fillRect(x + colW * (1 + i * 2), bodyY, colW, bodyH, INK);
  }
  fillRect(x, bodyY + bodyH, w, Math.round(h * 0.12), INK);
}

// New Zealand: two green islands on a pale sea.
function drawNzMap(x: number, y: number, w: number, h: number): void {
  fillRect(x, y, w, h, SKY);
  border(x, y, w, h, INK, 2);
  // North Island (upper, wider)
  fillPolygon(
    [
      x + 52, y + 8, x + 78, y + 14, x + 88, y + 34, x + 74, y + 52,
      x + 58, y + 62, x + 40, y + 52, x + 34, y + 30,
    ],
    GREEN,
  );
  // South Island (lower, long and thin)
  fillPolygon(
    [
      x + 30, y + 72, x + 58, y + 66, x + 76, y + 82, x + 66, y + 108,
      x + 44, y + 122, x + 26, y + 104, x + 18, y + 86,
    ],
    GREEN,
  );
  // A small red marker dot on the North Island (Wellington).
  fillCircle(x + 56, y + 52, 4, RED);
}

// Scales of justice: post, beam, two pans.
function drawScales(x: number, y: number, w: number, h: number): void {
  const cx = x + Math.floor(w / 2);
  const top = y + 6;
  const beamY = y + 18;
  const baseY = y + h - 8;
  vline(cx, top, baseY - top, INK, 4);
  hline(x + 8, beamY, w - 16, INK, 4);
  hline(cx - 16, baseY, 32, INK, 4);
  fillCircle(cx, top - 2, 4, INK);
  const panY = beamY + 26;
  line(x + 10, beamY + 2, x + 26, panY, INK, 2);
  line(x + w - 10, beamY + 2, x + w - 26, panY, INK, 2);
  fillPolygon([x + 8, panY, x + 44, panY, x + 26, panY + 16], INK);
  fillPolygon([x + w - 44, panY, x + w - 8, panY, x + w - 26, panY + 16], INK);
}

// ---------------------------------------------------------------------------
// Page layout. Margins: 36px left/right. A running y cursor per section.
// ---------------------------------------------------------------------------
const MX = 36; // margin x
const CW = W - MX * 2; // content width = 952

function drawPage(): void {
  // ---- Masthead ------------------------------------------------------------
  hline(MX, 22, CW, INK, 2);
  drawTextCentered("THE WORLD IN ONE PICTURE", W / 2, 38, 5, INK);
  hline(MX, 84, CW, INK, 3);
  hline(MX, 89, CW, INK, 1);
  drawTextCentered("FRIDAY, 27 NOVEMBER 2026", W / 2, 100, 3, INK);
  drawTextCentered("THE DAY'S WORLD NEWS, DRAWN IN ONE PAGE", W / 2, 128, 2, GREY);
  hline(MX, 152, CW, INK, 2);

  // ---- Lead story: EU summit deadlock --------------------------------------
  let y = 168;
  drawText("EUROPE  •  BRUSSELS", MX, y, 2, RED);
  y += 22;
  drawText("EU SUMMIT ENDS IN DEADLOCK", MX, y, 4, INK);
  y += 36;
  drawText("NO DEAL ON BUDGET OR UKRAINE LOAN", MX, y, 4, INK);
  y += 40;
  y = drawPara(
    "European Union leaders ended an emergency summit in Brussels without " +
      "agreement on the bloc's next seven-year budget or a new 45 billion euro " +
      "loan for Ukraine.",
    MX, y, 2, INK, CW, 5,
  );
  y += 4;
  // Body text on the left, EU flag + parliament on the right.
  const bodyW = 600;
  const illX = MX + bodyW + 24;
  const illW = CW - bodyW - 24;
  const bodyTop = y;
  const bodyEnd = drawPara(
    "Chancellor Friedrich Merz said leaders would not meet again on Friday, " +
      "after talks exposed deep divisions over spending, debt and support for " +
      "Kyiv. France's Emmanuel Macron set a year-end deadline, saying he " +
      "would sign a good deal when leaders return in December. The budget " +
      "needs the agreement of all 27 states.",
    MX, bodyTop, 2, INK, bodyW, 5,
  );
  drawEuFlag(illX + Math.floor(illW / 2), bodyTop + 66, 64);
  drawParliament(illX + 40, bodyTop + 146, illW - 80, 54);
  drawTextCentered("TWELVE STARS, NO DEAL.", illX + Math.floor(illW / 2), bodyTop + 212, 2, GREY);
  y = Math.max(bodyEnd, bodyTop + 234) + 10;
  hline(MX, y, CW, INK, 2);
  y += 18;

  // ---- Middle row: two stories side by side --------------------------------
  const colW = Math.floor((CW - 24) / 2);
  const col2X = MX + colW + 24;
  const midTop = y;

  // Left: New Zealand.
  drawText("NEW ZEALAND  •  WELLINGTON", MX, midTop, 2, RED);
  drawText("LUXON ONE SEAT", MX, midTop + 24, 3, INK);
  drawText("SHORT OF A MAJORITY", MX, midTop + 48, 3, INK);
  const nzEnd = drawPara(
    "Final results leave the ruling coalition with 65 of 130 seats, one short " +
      "of a majority. Prime Minister Christopher Luxon will need the centrist " +
      "Opportunity Party, which won seven seats, to stay in power.",
    MX, midTop + 80, 2, INK, colW - 118, 4,
  );
  drawNzMap(MX + colW - 108, midTop + 80, 108, 128);
  drawTextCentered("THE TWO ISLANDS: 65 OF 130 SEATS.", MX + Math.floor(colW / 2), nzEnd + 4, 2, GREY);

  // Right: Australia.
  drawText("AUSTRALIA  •  CANBERRA", col2X, midTop, 2, RED);
  drawText("CANBERRA SANCTIONS", col2X, midTop + 24, 3, INK);
  drawText("TWO OVER IRAN ATTACKS", col2X, midTop + 48, 3, INK);
  const auEnd = drawPara(
    "Australia placed counterterrorism financing sanctions on two people it " +
      "said were responsible for antisemitic attacks in the country on behalf " +
      "of Iran's Islamic Revolutionary Guard Corps. The sanctions freeze " +
      "assets and ban dealings with the two people.",
    col2X, midTop + 80, 2, INK, colW - 118, 4,
  );
  drawScales(col2X + colW - 104, midTop + 80, 100, 128);
  drawTextCentered("SANCTIONS FREEZE ASSETS.", col2X + Math.floor(colW / 2), auEnd + 4, 2, GREY);

  y = Math.max(nzEnd, auEnd) + 22;
  hline(MX, y, CW, INK, 2);
  y += 16;

  // ---- In brief -------------------------------------------------------------
  drawText("IN BRIEF", MX, y, 3, INK);
  y += 30;
  const briefs: Array<[string, string]> = [
    [
      "ECB — ",
      "Hernandez de Cos to succeed Lagarde as European Central Bank president.",
    ],
    [
      "JAPAN — ",
      "Tokyo eyes a 56.3 trillion yen ($353 billion) defence plan for 2027-2031.",
    ],
    [
      "INDONESIA — ",
      "Yogyakarta court jails daycare foundation head for nine years.",
    ],
    [
      "MARKETS — ",
      "Shares steadied; Brent crude ended at $96.14, up 3.9% on the week.",
    ],
  ];
  for (const [lead, text] of briefs) {
    drawText("•", MX, y, 2, RED);
    const tx = MX + 24;
    drawText(lead, tx, y, 2, INK);
    const leadW = textWidth(lead, 2);
    y = drawPara(text, tx + leadW, y, 2, INK, CW - 24 - leadW, 4);
    y += 8;
  }

  // ---- Footer ---------------------------------------------------------------
  hline(MX, y + 6, CW, INK, 2);
  drawTextCentered("SOURCES: REUTERS  •  EURONEWS  •  ASAHI  —  27 NOVEMBER 2026", W / 2, y + 18, 2, GREY);
}

// ---------------------------------------------------------------------------
// Entry point.
// ---------------------------------------------------------------------------
function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "out";
  fs.mkdirSync(outDir, { recursive: true });
  drawPage();
  const png = encodePNG();
  fs.writeFileSync(path.join(outDir, "entry.png"), png);
}

main();
