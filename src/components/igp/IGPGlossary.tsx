const GLOSSARY = [
  { term: "Foundational", definition: "Beginning stage — building awareness and basic understanding. Requires guidance and supervision to apply." },
  { term: "Advancing", definition: "Developing stage — can apply with some support. Building confidence and consistency but still refining approach." },
  { term: "Independent", definition: "Proficient stage — consistently demonstrates without supervision. Can adapt approach and mentor others." },
  { term: "Mastery", definition: "Expert stage — recognized authority. Innovates, leads strategic initiatives, and elevates others." },
  { term: "Gap", definition: "Difference between current and target level. +1 = one level below target; +2 = two levels below." },
  { term: "On Target", definition: "Current level meets or exceeds target. No additional development required." },
  { term: "Experiential", definition: "Capability develops organically through day-to-day work, exposure, and on-the-job practice." },
  { term: "Instructional", definition: "Capability gap unlikely to close through experience alone. Structured learning is recommended." },
  { term: "Mixed Approach", definition: "Combination of on-the-job experience and targeted training recommended." },
];

export function IGPGlossary() {
  return (
    <div className="space-y-3 print:break-inside-avoid" id="igp-glossary">
      <h2 className="text-lg font-bold text-foreground">Glossary of Terms</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-2 px-3 font-semibold text-xs uppercase text-muted-foreground w-1/4">Term</th>
              <th className="text-left py-2 px-3 font-semibold text-xs uppercase text-muted-foreground">Definition</th>
            </tr>
          </thead>
          <tbody>
            {GLOSSARY.map((item, i) => (
              <tr key={item.term} className={`border-b ${i % 2 === 0 ? "bg-card" : "bg-muted/20"}`}>
                <td className="py-2 px-3 font-medium text-foreground">{item.term}</td>
                <td className="py-2 px-3 text-muted-foreground">{item.definition}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
