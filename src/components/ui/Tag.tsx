export default function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-gray-200 px-2 py-0.5 text-xs text-text">
      {label}
    </span>
  );
}
