// news-image-20261123 entry: a one-page newspaper poster for 23 November 2026.
//
// Running this script RENDERS entry.png (1024x1024) from scratch: a hand-built
// PNG encoder (zlib + CRC32, standard library only) and a hand-built 5x7
// bitmap font draw the whole page. No image assets, no dependencies, no
// network, fully deterministic: two runs produce byte-identical output.
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The output directory defaults to /output inside the grader container.
// Node 22+, standard library only.

import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is 7 rows of 5 cells ('#' = ink, '.' = empty).
// ---------------------------------------------------------------------------

const GLYPHS: Record<string, string[]> = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '"': ['.#.#.', '.#.#.', '.#.#.', '.....', '.....', '.....', '.....'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '$': ['..#..', '.####', '#.#..', '.###.', '..#.#', '####.', '..#..'],
  '%': ['##..#', '##.#.', '...#.', '..#..', '.#...', '#.##.', '#..##'],
  '&': ['.##..', '#..#.', '#..#.', '.#...', '#.#.#', '#..#.', '.##.#'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '*': ['.....', '.#.#.', '.###.', '#####', '.###.', '.#.#.', '.....'],
  '+': ['.....', '..#..', '..#..', '.###.', '..#..', '..#..', '.....'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '.##..', '.#...', '#....'],
  '-': ['.....', '.....', '.....', '.###.', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  '/': ['....#', '...#.', '...#.', '..#..', '.#...', '.#...', '#....'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['.###.', '#...#', '....#', '..##.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['.###.', '#...#', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '#...#', '.###.'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.#...', '#....'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '=': ['.....', '.....', '.###.', '.....', '.###.', '.....', '.....'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  '@': ['.###.', '#...#', '#.###', '#.#.#', '#.###', '#....', '.###.'],
  'A': ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'B': ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  'C': ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  'D': ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  'E': ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  'F': ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  'G': ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  'H': ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  'I': ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  'J': ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  'K': ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  'L': ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  'M': ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  'N': ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  'O': ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'P': ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  'Q': ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  'R': ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  'S': ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  'T': ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  'U': ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  'V': ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  'W': ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  'X': ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  'Y': ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  'Z': ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  '_': ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  'a': ['.....', '.....', '.###.', '....#', '.####', '#...#', '.####'],
  'b': ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  'c': ['.....', '.....', '.###.', '#...#', '#....', '#...#', '.###.'],
  'd': ['....#', '....#', '.####', '#...#', '#...#', '#...#', '.####'],
  'e': ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  'f': ['..##.', '.#..#', '.#...', '####.', '.#...', '.#...', '.#...'],
  'g': ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '.###.'],
  'h': ['#....', '#....', '####.', '#...#', '#...#', '#...#', '#...#'],
  'i': ['..#..', '.....', '.##..', '..#..', '..#..', '..#..', '.###.'],
  'j': ['...#.', '.....', '..##.', '...#.', '...#.', '...#.', '...#.', '.##..'],
  'k': ['#....', '#....', '#..#.', '#.#..', '##...', '#.#..', '#..#.'],
  'l': ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  'm': ['.....', '.....', '##.#.', '#.#.#', '#.#.#', '#.#.#', '#.#.#'],
  'n': ['.....', '.....', '####.', '#...#', '#...#', '#...#', '#...#'],
  'o': ['.....', '.....', '.###.', '#...#', '#...#', '#...#', '.###.'],
  'p': ['.....', '.....', '####.', '#...#', '#...#', '####.', '#....', '#....'],
  'q': ['.....', '.....', '.####', '#...#', '#...#', '.####', '....#', '....#'],
  'r': ['.....', '.....', '#.##.', '##..#', '#....', '#....', '#....'],
  's': ['.....', '.....', '.####', '#....', '.###.', '....#', '####.'],
  't': ['.#...', '.#...', '####.', '.#...', '.#...', '.#..#', '..##.'],
  'u': ['.....', '.....', '#...#', '#...#', '#...#', '#..##', '.##.#'],
  'v': ['.....', '.....', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  'w': ['.....', '.....', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  'x': ['.....', '.....', '#...#', '.#.#.', '..#..', '.#.#.', '#...#'],
  'y': ['.....', '.....', '#...#', '#...#', '#...#', '.####', '....#', '.###.'],
  'z': ['.....', '.....', '#####', '...#.', '..#..', '.#...', '#####'],
  '·': ['.....', '.....', '.##..', '.##..', '.....', '.....', '.....'],
  '—': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
};

// Some glyphs carry a descender (comma, semicolon, g, j, p, q, y). They are
// stored with 8 rows; the renderer draws rows 0-6 and rows 7 in the line
// below the baseline when present.
function glyphRows(ch: string): string[] {
  return GLYPHS[ch] ?? GLYPHS['?'] ?? ['#####', '#...#', '#...#', '#...#', '#...#', '#...#', '#####'];
}

// ---------------------------------------------------------------------------
// Minimal PNG encoder (truecolour RGB, 8 bit, filter 0 on every scanline).
// ---------------------------------------------------------------------------

const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}

function encodePNG(width: number, height: number, rgb: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), y * (1 + width * 3) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Canvas: a plain RGB framebuffer with text drawing on top of the font.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

const PAPER: RGB = [248, 244, 233];
const INK: RGB = [25, 25, 25];
const RED: RGB = [158, 27, 27];
const GREY: RGB = [96, 90, 78];
const RULE: RGB = [178, 168, 148];

class Page {
  readonly w: number;
  readonly h: number;
  readonly px: Uint8Array;
  constructor(w: number, h: number, bg: RGB) {
    this.w = w;
    this.h = h;
    this.px = new Uint8Array(w * h * 3);
    for (let i = 0; i < w * h; i++) {
      this.px[i * 3] = bg[0];
      this.px[i * 3 + 1] = bg[1];
      this.px[i * 3 + 2] = bg[2];
    }
  }
  set(x: number, y: number, c: RGB): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = c[0];
    this.px[i + 1] = c[1];
    this.px[i + 2] = c[2];
  }
  rect(x: number, y: number, w: number, h: number, c: RGB): void {
    for (let yy = y; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }
  hline(x: number, y: number, w: number, thick: number, c: RGB): void {
    this.rect(x, y, w, thick, c);
  }
  vline(x: number, y: number, h: number, thick: number, c: RGB): void {
    this.rect(x, y, thick, h, c);
  }
  // Draw one glyph with its top-left at (x, y). Rows beyond 7 are descenders.
  glyph(ch: string, x: number, y: number, s: number, c: RGB): void {
    const rows = glyphRows(ch);
    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      for (let col = 0; col < 5; col++) {
        if (row[col] !== '#') continue;
        this.rect(x + col * s, y + r * s, s, s, c);
      }
    }
  }
  text(str: string, x: number, y: number, s: number, c: RGB): number {
    let cx = x;
    for (const ch of str) {
      this.glyph(ch, cx, y, s, c);
      cx += 6 * s;
    }
    return cx - x;
  }
  textWidth(str: string, s: number): number {
    return str.length === 0 ? 0 : str.length * 6 * s - s;
  }
  centered(str: string, cx: number, y: number, s: number, c: RGB): void {
    this.text(str, cx - Math.floor(this.textWidth(str, s) / 2), y, s, c);
  }
}

// Greedy word wrap: returns lines that fit inside maxWidth pixels at scale s.
function wrap(text: string, maxWidth: number, s: number, page: Page): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur === '' ? w : cur + ' ' + w;
    if (page.textWidth(next, s) <= maxWidth) {
      cur = next;
    } else {
      if (cur !== '') lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// The twelve verified stories of Monday 23 November 2026.
// Sources: Reuters / AP / ESA / Al Jazeera wire reporting, all dated 23 Nov.
// See scratch research note for one source URL per story.
// ---------------------------------------------------------------------------

interface Story {
  kicker: string;
  headline: string;
  body: string;
}

const STORIES: Story[] = [
  {
    kicker: 'UKRAINE · LIBYA',
    headline: 'Zelenskyy says Ukraine sank Russian warship in Libya',
    body: 'Kyiv says seven naval drones struck the corvette Merkury at Benghazi, taking the sea war to a third country.',
  },
  {
    kicker: 'MARKETS · WALL STREET',
    headline: 'Nvidia brings back Huang; stocks soar as AI trade revives',
    body: "Nvidia jumped 31% as Jensen Huang returned as CEO, lifting the Nasdaq 6% after last week's rout.",
  },
  {
    kicker: 'CLIMATE · COP31',
    headline: 'Saudi influence loomed large over the failed COP31 deal',
    body: 'Riyadh had a hand in the Antalya collapse, the first COP with no overarching deal since 2009.',
  },
  {
    kicker: 'ASIA · MARKETS',
    headline: 'Asian chip stocks slide after Wall Street AI rout',
    body: "South Korea's Kospi fell as much as 5.8% on Monday, with Samsung and SK Hynix leading losses.",
  },
  {
    kicker: 'INDONESIA · BANTEN',
    headline: '24 confirmed dead in factory fire; about 30 still missing',
    body: 'Rescuers searched the burned candy plant in Cikande as Jakarta confirmed the toll and vowed a safety probe.',
  },
  {
    kicker: 'EUROPE · SANCTIONS',
    headline: 'EU unveils 22nd Russia sanctions, targeting banks and crypto',
    body: 'Brussels would cut 60 banks from SWIFT, hit crypto networks and list 70 more shadow-fleet ships.',
  },
  {
    kicker: 'EUROPE · POLAND',
    headline: 'Poland says Russia tried to kill rapper Kyivstoner twice',
    body: 'Warsaw revealed the Ukrainian-American musician was targeted in Poland in August, then again in Denmark.',
  },
  {
    kicker: 'CAUCASUS · PEACE',
    headline: 'Armenia unveils draft constitution to clear way for peace deal',
    body: 'Pashinyan staked his credibility on a charter dropping the Karabakh claim Azerbaijan demands removed.',
  },
  {
    kicker: 'HEALTH · CONGO',
    headline: 'Ebola deaths in Congo may be undercounted by half, analysis finds',
    body: 'Satellite images and gravedigger accounts suggest far more graves than the official toll of 5,678.',
  },
  {
    kicker: 'IRAN · GULF',
    headline: 'Iran vows to use all means to confront US naval blockade',
    body: 'Tehran said it would resist the blockade as the standoff over oil exports and the Gulf deepened.',
  },
  {
    kicker: 'SPACE · MERCURY',
    headline: 'BepiColombo safe in Mercury orbit after software glitch',
    body: 'ESA said the probe is stable after a software fault cut its insertion burn short at 77% of planned thrust.',
  },
  {
    kicker: 'SPORT · TURIN',
    headline: 'Alcaraz beats Zverev to clinch the ATP Finals title',
    body: 'The Spaniard powered past the world number one 6-2, 7-6 in Turin to end the season on top.',
  },
];

// ---------------------------------------------------------------------------
// Layout: a newspaper front page, 1024 x 1024.
// ---------------------------------------------------------------------------

const W = 1024;
const H = 1024;
const M = 40; // margin
const CW = W - 2 * M; // content width = 944
const GAP = 24; // gutter between the two columns
const COLW = Math.floor((CW - GAP) / 2); // 460

function render(): Buffer {
  const p = new Page(W, H, PAPER);

  // ---- masthead -----------------------------------------------------------
  p.centered('MONDAY, 23 NOVEMBER 2026 · TWELVE STORIES, ONE PAGE', W / 2, 42, 2, GREY);
  p.centered('THE WORLD TODAY', W / 2, 66, 7, INK);
  p.centered("The day's world news, summed up in a single image", W / 2, 126, 2, GREY);
  p.hline(M, 150, CW, 3, INK);
  p.hline(M, 156, CW, 1, INK);

  // ---- lead story (story 1, full width) -----------------------------------
  const lead = STORIES[0];
  let y = 172;
  p.text(lead.kicker, M, y, 2, RED);
  y += 22;
  const leadHead = wrap(lead.headline, CW, 3, p);
  for (const line of leadHead) {
    p.text(line, M, y, 3, INK);
    y += 27;
  }
  y += 4;
  const leadBody = wrap(lead.body, CW, 2, p);
  for (const line of leadBody) {
    p.text(line, M, y, 2, INK);
    y += 18;
  }
  y += 10;
  p.hline(M, y, CW, 2, INK);
  y += 12;

  // ---- grid: stories 2..12 in two columns ---------------------------------
  const gridTop = y;
  const rest = STORIES.slice(1); // 11 stories -> 6 rows, last row has 1 + box
  const rows: Story[][] = [];
  for (let i = 0; i < rest.length; i += 2) rows.push(rest.slice(i, i + 2));

  // Pre-wrap every cell so row heights are exact.
  interface Cell {
    kicker: string;
    head: string[];
    body: string[];
  }
  const cellOf = (s: Story): Cell => ({
    kicker: s.kicker,
    head: wrap(s.headline, COLW, 2, p),
    body: wrap(s.body, COLW, 2, p),
  });
  const cellH = (c: Cell): number =>
    7 + 6 + c.head.length * 17 + 6 + c.body.length * 17;

  // Last row, second column: an "about this page" box instead of a story.
  // Its height joins the row-height computation so it can never spill over
  // the footer.
  const aboutLines = wrap(
    'Rendered entirely in code: a hand-built PNG encoder and a 5x7 bitmap font.',
    COLW - 24,
    2,
    p,
  );
  const srcLines = wrap('Sources: wire reports, 23 November 2026.', COLW - 24, 2, p);
  const aboutH = 12 + (7 + 10) + aboutLines.length * 17 + 6 + srcLines.length * 17 + 10;
  const rowHeights = rows.map((row, ri) => {
    const hs = row.map((s) => cellH(cellOf(s)));
    if (ri === rows.length - 1 && row.length === 1) hs.push(aboutH);
    return Math.max(...hs);
  });

  let gy = gridTop;
  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].map(cellOf);
    const rowH = rowHeights[r];
    for (let c = 0; c < cells.length; c++) {
      const cell = cells[c];
      const x = M + c * (COLW + GAP);
      let cy = gy;
      p.text(cell.kicker, x, cy, 1, RED);
      cy += 7 + 6;
      for (const line of cell.head) {
        p.text(line, x, cy, 2, INK);
        cy += 17;
      }
      cy += 6;
      for (const line of cell.body) {
        p.text(line, x, cy, 2, GREY);
        cy += 17;
      }
    }
    // Last row, second column: an "about this page" box instead of a story.
    if (r === rows.length - 1 && cells.length === 1) {
      const x = M + COLW + GAP;
      p.rect(x, gy, COLW, rowH, [238, 232, 214]);
      p.rect(x, gy, COLW, 2, RED);
      let cy = gy + 12;
      p.text('ABOUT THIS PAGE', x + 12, cy, 1, RED);
      cy += 7 + 10;
      for (const line of aboutLines) {
        p.text(line, x + 12, cy, 2, INK);
        cy += 17;
      }
      cy += 6;
      for (const line of srcLines) {
        p.text(line, x + 12, cy, 2, GREY);
        cy += 17;
      }
    }
    gy += rowH;
    if (r < rows.length - 1) {
      p.hline(M, gy + 5, CW, 1, RULE);
      gy += 10;
    }
  }

  // Vertical divider between the two columns, across the grid.
  p.vline(M + COLW + Math.floor(GAP / 2), gridTop, gy - gridTop, 1, RULE);

  // ---- footer ---------------------------------------------------------------
  const fy = gy + 12;
  p.hline(M, fy, CW, 2, INK);
  p.centered('THE WORLD TODAY · 23 NOVEMBER 2026 · 12 STORIES · RENDERED BY CODE', W / 2, fy + 12, 1, GREY);

  return encodePNG(W, H, p.px);
}

// ---------------------------------------------------------------------------

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const target = join(outDir, 'entry.png');
mkdirSync(outDir, { recursive: true });
writeFileSync(target, render());
console.log(`rendered entry.png -> ${target}`);
