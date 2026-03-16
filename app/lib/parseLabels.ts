export function parseLabels(labelsJson: string | null): string[] {
  if (!labelsJson) return [];
  try {
    const parsed = JSON.parse(labelsJson);
    if (!Array.isArray(parsed)) return [];

    return parsed.flatMap((label) => {
      if (typeof label === 'string') {
        const normalizedLabel = label.trim();
        return normalizedLabel ? [normalizedLabel] : [];
      }

      if (
        label &&
        typeof label === 'object' &&
        'name' in label &&
        typeof label.name === 'string'
      ) {
        const normalizedLabel = label.name.trim();
        return normalizedLabel ? [normalizedLabel] : [];
      }

      return [];
    });
  } catch {
    return [];
  }
}
