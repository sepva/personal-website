interface SuggestionChipsProps {
  suggestions: string[];
  onSelect: (suggestion: string) => void;
}

export function SuggestionChips({ suggestions, onSelect }: SuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-[8px]">
      {suggestions.map((suggestion, idx) => (
        <button
          key={idx}
          onClick={() => onSelect(suggestion)}
          className="bg-[#252831] hover:bg-[#2F323D] text-[#D1D5DB] hover:text-[#FAFAFA] border border-[#2F323D] hover:border-[#5560FF] rounded-[10px] px-[16px] py-[8px] transition-all duration-200"
        >
          {suggestion}
        </button>
      ))}
    </div>
  );
}
