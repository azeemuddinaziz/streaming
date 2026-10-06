// Name of the unique index a create/update violated, if that is what failed.
export function violatedUniqueIndex(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;

  const { code, meta } = error as {
    code?: string;
    meta?: {
      driverAdapterError?: { cause?: { constraint?: { index?: string } } };
    };
  };

  return code === "P2002"
    ? meta?.driverAdapterError?.cause?.constraint?.index
    : undefined;
}
