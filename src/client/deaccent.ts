/**
 * Latin transliteration, shared by the generator (identifier sanitization) and
 * the runtime's default search matcher (accent-insensitive matching).
 */

const NON_DECOMPOSABLE: {[ch: string]: string} = {
  ß: 'ss',
  ẞ: 'SS',
  æ: 'ae',
  Æ: 'AE',
  œ: 'oe',
  Œ: 'OE',
  ø: 'o',
  Ø: 'O',
  đ: 'd',
  Đ: 'D',
  ð: 'd',
  Ð: 'D',
  þ: 'th',
  Þ: 'Th',
  ł: 'l',
  Ł: 'L',
};

/** Replace non-decomposable chars, then strip combining marks (ç→c, á→a, ê→e). */
export function deaccent(name: string): string {
  return name
    .replace(/[ßẞæÆœŒøØđĐðÐþÞłŁ]/g, ch => NON_DECOMPOSABLE[ch])
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}
