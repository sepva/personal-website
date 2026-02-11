interface FilterBarProps {
  filters: string[];
  activeFilter: string;
  onFilterChange: (filter: string) => void;
}

export function FilterBar({
  filters,
  activeFilter,
  onFilterChange
}: FilterBarProps) {
  return (
    <div className="flex gap-[8px] mb-[24px] flex-wrap">
      <button
        onClick={() => onFilterChange("all")}
        className={`px-[16px] py-[8px] rounded-[10px] transition-all ${
          activeFilter === "all"
            ? "bg-[#2D3AEE] text-white"
            : "bg-[#252831] text-[#D1D5DB] hover:bg-[#2F323D] border border-[#2F323D]"
        }`}
        style={{ fontSize: "14px" }}
      >
        All
      </button>
      {filters.map((filter) => (
        <button
          key={filter}
          onClick={() => onFilterChange(filter)}
          className={`px-[16px] py-[8px] rounded-[10px] transition-all ${
            activeFilter === filter
              ? "bg-[#2D3AEE] text-white"
              : "bg-[#252831] text-[#D1D5DB] hover:bg-[#2F323D] border border-[#2F323D]"
          }`}
          style={{ fontSize: "14px" }}
        >
          {filter}
        </button>
      ))}
    </div>
  );
}
