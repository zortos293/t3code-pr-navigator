export default function LabelBadge({ label }: { label: string }) {
  const getBadgeStyle = (l: string) => {
    if (l.includes('vouch:trusted')) return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700';
    if (l.includes('vouch:unvouched')) return 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700';
    if (l.includes('size:S')) return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700 text-[10px]';
    if (l.includes('size:M')) return 'bg-blue-200 text-blue-800 border-blue-300 dark:bg-blue-800/40 dark:text-blue-200 dark:border-blue-600';
    if (l.includes('size:XXL')) return 'bg-purple-500 text-white border-purple-600 dark:bg-purple-600 dark:border-purple-500';
    if (l.includes('size:XL')) return 'bg-blue-500 text-white border-blue-600 dark:bg-blue-600 dark:border-blue-500';
    if (l.includes('size:L')) return 'bg-blue-300 text-blue-900 border-blue-400 dark:bg-blue-700/50 dark:text-blue-200 dark:border-blue-600';
    if (l.includes('bug')) return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/40 dark:text-red-300 dark:border-red-700';
    if (l.includes('enhancement') || l.includes('feature')) return 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/40 dark:text-cyan-300 dark:border-cyan-700';
    if (l.includes('help')) return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-300 dark:border-yellow-700';
    return 'bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600';
  };

  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium border leading-tight ${getBadgeStyle(label)}`}>
      {label}
    </span>
  );
}
