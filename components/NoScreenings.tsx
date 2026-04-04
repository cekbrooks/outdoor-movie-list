type Props = {
  message?: string;
  className?: string;
};

export function NoScreenings({
  message = "No screenings found",
  className = "",
}: Props) {
  return (
    <p
      role="status"
      className={`rounded-2xl border border-white/10 bg-[#0d1428]/50 px-6 py-10 text-center text-base text-[#f0ede8]/80 ${className}`}
    >
      {message}
    </p>
  );
}
