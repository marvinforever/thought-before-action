import { IGPProfile } from "./igp-types";

interface IGPHeaderProps {
  profile: IGPProfile;
  generatedAt: string;
}

export function IGPHeader({ profile, generatedAt }: IGPHeaderProps) {
  return (
    <div className="bg-primary text-primary-foreground rounded-xl p-6 md:p-8 print:rounded-none print:p-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-primary-foreground/60 mb-1">Individual Growth Plan</p>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{profile.full_name}</h1>
          {profile.job_title && (
            <p className="text-primary-foreground/80 mt-1 text-sm md:text-base">{profile.job_title}</p>
          )}
          {profile.company_name && (
            <p className="text-primary-foreground/60 text-sm">{profile.company_name}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-accent font-bold text-sm tracking-wide">JERICHO</p>
          <p className="text-primary-foreground/50 text-xs">by The Momentum Company</p>
          <p className="text-primary-foreground/60 text-xs mt-2">
            Generated {new Date(generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
          </p>
        </div>
      </div>
    </div>
  );
}
