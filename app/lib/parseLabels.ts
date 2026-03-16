export function parseLabels(labelsJson: string | null): string[] {
  if (!labelsJson) return [];
  try {
    return JSON.parse(labelsJson);
  } catch {
    return [];
  }
}
