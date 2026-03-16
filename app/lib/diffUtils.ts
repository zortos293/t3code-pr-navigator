export function fileStatusColor(status: string): string {
  switch (status) {
    case 'added': return 'text-green-500';
    case 'removed': return 'text-red-500';
    case 'renamed': return 'text-blue-500';
    default: return 'text-yellow-500';
  }
}

export function fileStatusLabel(status: string): string {
  switch (status) {
    case 'added': return 'A';
    case 'removed': return 'D';
    case 'renamed': return 'R';
    default: return 'M';
  }
}
