export interface IntegrationConfig {
  readonly translationProvider: "disabled";
  readonly publicEnquiryCaptureEnabled: false;
  readonly googleAdsMeasurementEnabled: false;
}

export class IntegrationDeferredError extends Error {
  constructor(setting: string) {
    super(
      `${setting} cannot be enabled yet: Google connections are deferred and no live adapter is configured.`,
    );
    this.name = "IntegrationDeferredError";
  }
}

export function readIntegrationConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): IntegrationConfig {
  const provider = environment.TRANSLATION_PROVIDER?.trim().toLowerCase() || "disabled";
  if (provider !== "disabled") throw new IntegrationDeferredError("TRANSLATION_PROVIDER");

  for (const name of ["PUBLIC_ENQUIRY_CAPTURE_ENABLED", "GOOGLE_ADS_MEASUREMENT_ENABLED"]) {
    const value = environment[name]?.trim().toLowerCase() || "false";
    if (value !== "false") throw new IntegrationDeferredError(name);
  }

  return Object.freeze({
    translationProvider: "disabled",
    publicEnquiryCaptureEnabled: false,
    googleAdsMeasurementEnabled: false,
  });
}
