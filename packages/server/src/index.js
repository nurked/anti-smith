export { createAntiSmithHandler } from './handler.js';
export { verifyWebBotAuth, signWebBotAuth, signatureBase, jwkThumbprint, createDirectoryFetcher, DIRECTORY_PATH } from './web-bot-auth.js';
export { collectRequestSignals, classifyRequest } from './signals.js';
export { createCanaryScanner, DEFAULT_CANARY_PATTERN } from './canary.js';
export { createSessionStore } from './sessions.js';
export { parseDictionary, parseItemValue } from './structured-fields.js';
export { createStepUp, createCredentialStore, coseToJwk } from './webauthn.js';
export { decodeCbor } from './cbor.js';
export { injectIntoHtml, bootstrapSnippet } from './inject.js';
