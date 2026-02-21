/**
 * 크로스 링크 시스템 — barrel export
 */

export type {
  PostIndex,
  PostIndexEntry,
  RelatedPostMatch,
  InlineLinkCandidate,
  InlineLinkInsertion,
  HamkkeEntry,
} from './types.js';

export {
  buildPostIndex,
  savePostIndex,
  loadPostIndex,
} from './build-index.js';

export {
  findRelatedPosts,
} from './matcher.js';

export {
  generateHamkkeSection,
  appendHamkkeSection,
} from './hamkke-section.js';

export {
  detectInlineLinkCandidates,
} from './inline-detector.js';

export {
  insertInlineLinks,
  generateInlineLinkSentences,
} from './inline-inserter.js';

export {
  fixBrokenInternalLinks,
} from './url-fixer.js';

export {
  buildVisitKoreaUrl,
  generateInfoLinks,
  generateInfoSection,
  appendInfoSection,
} from './info-links.js';
