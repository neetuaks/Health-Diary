import fs from 'fs';
import path from 'path';
import { decodeSevenSegmentRows, filterRowsByHeight } from '../src/services/sevenSegmentDecoder';

const DIR = path.join(__dirname, '..', 'docs', 'ocr-samples', 'cropped');

describe('decodeSevenSegmentRows', () => {
  const cases: [string, string[]][] = [
    ['omron-hem7111-150-89-75-crop.jpg', ['150', '89', '75']],
    ['omron-hem7111-131-78-76-tilt-crop.jpg', ['131', '78', '76']],
    ['omron-hem7111-135-79-77-rotated-crop.jpg', ['135', '79', '77']],
    ['accuchek-active-160-crop.jpg', ['160']],
  ];

  it.each(cases)('reads %s as %j', (file, expected) => {
    const bytes = fs.readFileSync(path.join(DIR, file));
    const rows = decodeSevenSegmentRows(bytes);
    expect(rows.map(r => r.text)).toEqual(expected);
  });
});

describe('filterRowsByHeight', () => {
  it('drops rows shorter than 40% of the tallest row', () => {
    const rows = [
      { text: '160', heightPx: 100, yCenter: 10 },
      { text: '25', heightPx: 30, yCenter: 30 },
    ];
    expect(filterRowsByHeight(rows).map(r => r.text)).toEqual(['160']);
  });

  it('keeps all rows when heights are similar', () => {
    const rows = [
      { text: '131', heightPx: 100, yCenter: 10 },
      { text: '78', heightPx: 95, yCenter: 30 },
      { text: '76', heightPx: 60, yCenter: 50 },
    ];
    expect(filterRowsByHeight(rows).map(r => r.text)).toEqual(['131', '78', '76']);
  });
});
