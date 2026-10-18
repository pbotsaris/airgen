import {airtableColorToHex, fuseMatcher, isHexColor, pillSizeClasses, shouldUseLightText} from '@airgen/ui';

export const green = airtableColorToHex('greenBright');
export const lightText = shouldUseLightText('blueBright');
export const validHex = isHexColor('#008000');
// Unlike consumer className values, these utilities already carry the ag- prefix.
export const smallPillClasses = pillSizeClasses('sm');
export const matchingIndices = fuseMatcher(['Website design', 'Audio campaign'], 'website');
// With airgen: query(records, {search: {query: 'website', fields: ['name'], matcher: fuseMatcher}}).
