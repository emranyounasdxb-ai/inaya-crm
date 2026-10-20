export type InterfaceLanguage = "en" | "ar";

export interface NarrativeTranslationRequest {
  readonly record: {
    readonly kind: "lead_requirement" | "comment";
    readonly id: string;
    readonly sourceRevision: string;
  };
  readonly originalText: string;
  readonly sourceLanguage: InterfaceLanguage | "unknown";
  readonly targetLanguage: InterfaceLanguage;
}

export type NarrativeTranslationResult =
  | {
      readonly status: "original";
      readonly reason:
        | "not_configured"
        | "provider_unavailable"
        | "quota_exhausted"
        | "same_language";
      readonly displayText: string;
      readonly targetLanguage: InterfaceLanguage;
      readonly sourceRevision: string;
    }
  | {
      readonly status: "translated";
      readonly displayText: string;
      readonly targetLanguage: InterfaceLanguage;
      readonly sourceRevision: string;
      readonly provider: string;
      readonly fromCache: boolean;
    };

export interface NarrativeTranslationPort {
  translate(request: NarrativeTranslationRequest): Promise<NarrativeTranslationResult>;
}

export interface CampaignAttribution {
  readonly utmSource?: string;
  readonly utmMedium?: string;
  readonly utmCampaign?: string;
  readonly utmTerm?: string;
  readonly utmContent?: string;
  readonly gclid?: string;
  readonly gbraid?: string;
  readonly wbraid?: string;
}

// An eventual ingress adapter must validate outside input and assign its trusted source.
// Customer phone duplicate review is separate from this request's ingestion key.
export interface ExternalLeadSubmission {
  readonly ingestionKey: string;
  readonly sourceKey: string;
  readonly externalReference?: string;
  readonly customerName: string;
  readonly phone: string;
  readonly requirement?: string;
  readonly attribution?: CampaignAttribution;
}

export type ExternalLeadCaptureResult =
  | { readonly status: "not_configured"; readonly accepted: false }
  | { readonly status: "accepted"; readonly accepted: true; readonly leadId: string };

export interface ExternalLeadCapturePort {
  submit(request: ExternalLeadSubmission): Promise<ExternalLeadCaptureResult>;
}
