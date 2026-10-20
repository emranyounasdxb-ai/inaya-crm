import assert from 'node:assert/strict';
import test from 'node:test';
import {createIntegrationFoundation} from '../src/server/integrations/index.ts';
import {IntegrationDeferredError} from '../src/server/integrations/config.ts';

test('core integration foundation starts without database or Google credentials', () => {
  const integrations = createIntegrationFoundation({});
  assert.deepEqual(integrations.config, {
    translationProvider: 'disabled',
    publicEnquiryCaptureEnabled: false,
    googleAdsMeasurementEnabled: false,
  });
});

test('disabled translation preserves originals and source revisions for simultaneous languages', async () => {
  const integrations = createIntegrationFoundation({});
  const originalText = 'Need a worker. أحتاج عاملة +971501234567';
  const record = Object.freeze({kind: 'lead_requirement', id: 'lead-1', sourceRevision: 'revision-2'});
  const english = Object.freeze({record, originalText, sourceLanguage: 'unknown', targetLanguage: 'en'});
  const arabic = Object.freeze({...english, targetLanguage: 'ar'});
  const [englishResult, arabicResult] = await Promise.all([
    integrations.translation.translate(english),
    integrations.translation.translate(arabic),
  ]);
  for (const result of [englishResult, arabicResult]) {
    assert.equal(result.status, 'original');
    assert.equal(result.reason, 'not_configured');
    assert.equal(result.displayText, originalText);
    assert.equal(result.sourceRevision, 'revision-2');
  }
  assert.equal(englishResult.targetLanguage, 'en');
  assert.equal(arabicResult.targetLanguage, 'ar');
  assert.equal(english.originalText, originalText);
});

test('disabled capture never reports an accepted lead or fabricates a lead ID', async () => {
  const integrations = createIntegrationFoundation({});
  const submission = Object.freeze({
    ingestionKey: 'request-1', sourceKey: 'website', customerName: 'Example',
    phone: '+971501234567', requirement: 'Enquiry',
  });
  assert.deepEqual(await integrations.externalLeadCapture.submit(submission), {
    status: 'not_configured', accepted: false,
  });
});

test('stray provider credentials do not activate integrations or initiate fetch requests', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = () => { fetchCalls += 1; throw new Error('Network must not be used'); };
  try {
    const integrations = createIntegrationFoundation({
      GOOGLE_CLOUD_PROJECT: 'unused-project', GOOGLE_APPLICATION_CREDENTIALS: 'not-a-real-file',
    });
    await integrations.translation.translate({
      record: {kind: 'comment', id: 'comment-1', sourceRevision: '1'},
      originalText: 'Original', sourceLanguage: 'en', targetLanguage: 'ar',
    });
    assert.equal(integrations.config.translationProvider, 'disabled');
    assert.equal(fetchCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('premature activation and typo settings fail instead of connecting a partial adapter', () => {
  for (const [setting, value] of [
    ['TRANSLATION_PROVIDER', 'google-cloud'],
    ['PUBLIC_ENQUIRY_CAPTURE_ENABLED', 'true'],
    ['GOOGLE_ADS_MEASUREMENT_ENABLED', 'true'],
    ['PUBLIC_ENQUIRY_CAPTURE_ENABLED', 'treu'],
  ]) {
    assert.throws(() => createIntegrationFoundation({[setting]: value}), IntegrationDeferredError);
  }
});
