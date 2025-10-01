import { supabase } from "@/integrations/supabase/client";

type VideoResource = {
  title: string;
  authors: string; // Channel or creator name
  description: string;
  capability_level: "foundational" | "advancing" | "independent" | "mastery";
  external_url?: string;
  estimated_time_minutes?: number;
};

// Leadership capability YouTube videos from the PDF
const leadershipVideos: VideoResource[] = [
  // LEVEL 1: FOUNDATIONAL
  {
    title: "How Great Leaders Inspire Action",
    authors: "Simon Sinek (TEDx)",
    description: "Start with Why: Introduces Golden Circle concept accessibly for understanding purpose-driven leadership basics",
    capability_level: "foundational",
    external_url: "https://www.youtube.com/results?search_query=Simon+Sinek+How+Great+Leaders+Inspire+Action",
    estimated_time_minutes: 18
  },
  {
    title: "The Secret to Successful Leadership",
    authors: "Drew Dudley (TEDx)",
    description: "Makes leadership accessible in everyday moments, perfect for building confidence",
    capability_level: "foundational",
    external_url: "https://www.youtube.com/results?search_query=Drew+Dudley+Secret+to+Successful+Leadership",
    estimated_time_minutes: 15
  },
  {
    title: "First Time Manager Training",
    authors: "Adriana Girdler",
    description: "Practical tips for day-to-day challenges, communication, and team management basics",
    capability_level: "foundational",
    external_url: "https://www.youtube.com/c/AdrianaCGirdler",
    estimated_time_minutes: 30
  },
  // LEVEL 2: ADVANCING
  {
    title: "Leadership Skills: How to Lead Small Teams",
    authors: "Project Management Institute (PMI)",
    description: "Practical guidance on managing project teams and setting expectations independently",
    capability_level: "advancing",
    external_url: "https://www.youtube.com/user/PMInstitute",
    estimated_time_minutes: 25
  },
  {
    title: "The Five Dysfunctions of a Team",
    authors: "Patrick Lencioni",
    description: "Video presentations of team dysfunction model for managing dynamics autonomously",
    capability_level: "advancing",
    external_url: "https://www.youtube.com/results?search_query=Patrick+Lencioni+Five+Dysfunctions",
    estimated_time_minutes: 45
  },
  {
    title: "Extreme Ownership",
    authors: "Jocko Willink (Jocko Podcast Official)",
    description: "Accountability, decision-making under pressure, independent problem-solving",
    capability_level: "advancing",
    external_url: "https://www.youtube.com/results?search_query=Jocko+Willink+Extreme+Ownership",
    estimated_time_minutes: 60
  },
  // LEVEL 3: INDEPENDENT
  {
    title: "Building High-Performing Teams",
    authors: "Harvard Business Review",
    description: "Research-backed strategies for talent development and conflict resolution",
    capability_level: "independent",
    external_url: "https://www.youtube.com/user/HarvardBusiness",
    estimated_time_minutes: 20
  },
  {
    title: "Leadership Agility: Fostering Autonomous Teams",
    authors: "LeadDev",
    description: "Building trust, delegating effectively, creating self-sustaining teams",
    capability_level: "independent",
    external_url: "https://www.youtube.com/c/TheLeadDeveloper",
    estimated_time_minutes: 35
  },
  {
    title: "Why Good Leaders Make You Feel Safe",
    authors: "Simon Sinek (TED)",
    description: "Creating environments where teams thrive and perform at high levels independently",
    capability_level: "independent",
    external_url: "https://www.youtube.com/results?search_query=Simon+Sinek+Leaders+Make+You+Feel+Safe",
    estimated_time_minutes: 12
  },
  // LEVEL 4: MASTERY
  {
    title: "Transformational Leadership",
    authors: "Bernard Bass",
    description: "Academic foundation for transformational leadership theory at organizational scale",
    capability_level: "mastery",
    external_url: "https://www.youtube.com/results?search_query=Bernard+Bass+Transformational+Leadership",
    estimated_time_minutes: 40
  },
  {
    title: "Leading Through Crisis and Ambiguity",
    authors: "MIT Sloan",
    description: "Creating vision in uncertain situations, developing resilient organizations",
    capability_level: "mastery",
    external_url: "https://www.youtube.com/c/MITSloanSchool",
    estimated_time_minutes: 45
  },
  {
    title: "Creating Leadership Pipelines",
    authors: "DDI Leadership Insights",
    description: "Succession planning, developing leaders at all levels, sustainable systems",
    capability_level: "mastery",
    external_url: "https://www.youtube.com/user/DDIWorld",
    estimated_time_minutes: 30
  }
];

export async function importLeadershipVideos(companyId: string) {
  try {
    // Get the Leadership capability
    const { data: capability, error: capError } = await supabase
      .from("capabilities")
      .select("id")
      .eq("name", "Leadership")
      .maybeSingle();

    if (capError) throw capError;
    if (!capability) throw new Error("Leadership capability not found");

    // Import each video
    const results = [];
    for (const video of leadershipVideos) {
      const { data, error } = await supabase
        .from("resources")
        .insert({
          title: video.title,
          content_type: "video",
          url: video.external_url,
          description: video.description,
          capability_id: capability.id,
          capability_level: video.capability_level,
          company_id: companyId,
          is_active: true,
          authors: video.authors,
          external_url: video.external_url,
          estimated_time_minutes: video.estimated_time_minutes
        } as any)
        .select()
        .single();

      if (error) {
        console.error(`Error importing ${video.title}:`, error);
        results.push({ success: false, title: video.title, error: error.message });
      } else {
        results.push({ success: true, title: video.title, id: data.id });
      }
    }

    return results;
  } catch (error: any) {
    console.error("Error importing leadership videos:", error);
    throw error;
  }
}
