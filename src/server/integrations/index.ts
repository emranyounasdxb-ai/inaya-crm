import type { IntegrationConfig } from "./config.ts";
import { readIntegrationConfig } from "./config.ts";
import type {
  ExternalLeadCapturePort,
  ExternalLeadSubmission,
  NarrativeTranslationPort,
  NarrativeTranslationRequest,
} from "./contracts.ts";

export interface IntegrationFoundation {
  readonly config: IntegrationConfig;
  readonly translation: NarrativeTranslationPort;
  readonly externalLeadCapture: ExternalLeadCapturePort;
}

// Provider adapters will be wired here, keeping cloud SDKs outside the core CRM.
// The current foundation has no provider imports, clients, routes or persistence.
export function createIntegrationFoundation(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): IntegrationFoundation {
  const config = readIntegrationConfig(environment);
  const translation: NarrativeTranslationPort = Object.freeze({
    async translate(request: NarrativeTranslationRequest) {
      return {
        status: "original" as const,
        reason: "not_configured" as const,
        displayText: request.originalText,
        targetLanguage: request.targetLanguage,
        sourceRevision: request.record.sourceRevision,
      };
    },
  });
  const externalLeadCapture: ExternalLeadCapturePort = Object.freeze({
    async submit(_request: ExternalLeadSubmission) {
      return { status: "not_configured" as const, accepted: false as const };
    },
  });
  return Object.freeze({ config, translation, externalLeadCapture });
}
