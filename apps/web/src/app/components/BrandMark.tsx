/** Three cut bars; the tall orange one is the clip you keep. */
export default function BrandMark({ className = "" }: { className?: string }) {
    return (
        <span className={`inline-grid h-[22px] grid-cols-[4px_10px_4px] items-center gap-[3px] ${className}`} aria-hidden="true">
            <i className="block h-3 rounded-[2px] bg-ink opacity-45" />
            <i className="block h-[22px] rounded-[2px] bg-action" />
            <i className="block h-4 rounded-[2px] bg-ink opacity-45" />
        </span>
    );
}
