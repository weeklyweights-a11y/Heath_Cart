export default function WeeklyContext({ summary }: { summary: string }) {
  if (!summary) return null;
  return (
    <p className="text-sm text-text/80 italic">{summary}</p>
  );
}
