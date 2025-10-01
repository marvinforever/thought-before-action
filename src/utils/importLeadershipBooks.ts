import { supabase } from "@/integrations/supabase/client";

type BookResource = {
  title: string;
  authors: string;
  publisher: string;
  rating: number;
  external_url: string;
  description: string;
  capability_level: "foundational" | "advancing" | "independent" | "mastery";
};

// Leadership capability books from the PDF
const leadershipBooks: BookResource[] = [
  // LEVEL 1: FOUNDATIONAL
  {
    title: "First-Time Leader: Foundational Tools for Inspiring and Enabling Your New Team",
    authors: "George B. Bradt & Gillian Davis",
    publisher: "Wiley",
    rating: 4.5,
    external_url: "https://www.amazon.com/First-Time-Leader-Foundational-Inspiring-Enabling/dp/1118828127",
    description: "BRAVE framework specifically designed for first-time leaders building confidence in new leadership roles. Addresses willingness to take on tasks, showing respect for team members, and accepting feedback.",
    capability_level: "foundational"
  },
  {
    title: "Dare to Lead: Brave Work, Tough Conversations, Whole Hearts",
    authors: "Brené Brown",
    publisher: "Random House",
    rating: 4.7,
    external_url: "https://www.amazon.com/Dare-Lead-Brave-Conversations-Hearts/dp/0399592520",
    description: "Builds courage and vulnerability-based leadership, ideal for accepting feedback, showing respect for team members, and developing confidence when directing others.",
    capability_level: "foundational"
  },
  {
    title: "The First 90 Days: Proven Strategies for Getting Up to Speed Faster and Smarter",
    authors: "Michael D. Watkins",
    publisher: "Harvard Business Review Press",
    rating: 4.6,
    external_url: "https://www.amazon.com/First-90-Days-Strategies-Expanded/dp/1422188612",
    description: "Helps new leaders avoid common pitfalls and secure early wins while building initial confidence. Addresses struggle with authority and learning to lead with oversight.",
    capability_level: "foundational"
  },
  // LEVEL 2: ADVANCING
  {
    title: "The Five Dysfunctions of a Team: A Leadership Fable",
    authors: "Patrick Lencioni",
    publisher: "Jossey-Bass",
    rating: 4.6,
    external_url: "https://www.amazon.com/Five-Dysfunctions-Team-Leadership-Fable/dp/0787960756",
    description: "Essential for managing team dynamics with minimal supervision, addressing trust and accountability issues, building positive relationships with team members.",
    capability_level: "advancing"
  },
  {
    title: "Extreme Ownership: How U.S. Navy SEALs Lead and Win",
    authors: "Jocko Willink & Leif Babin",
    publisher: "St. Martin's Press",
    rating: 4.7,
    external_url: "https://www.amazon.com/Extreme-Ownership-U-S-Navy-SEALs/dp/1250067057",
    description: "Taking full responsibility for team outcomes, making independent decisions under pressure, handling day-to-day leadership challenges without supervision.",
    capability_level: "advancing"
  },
  {
    title: "The Coaching Habit: Say Less, Ask More & Change the Way You Lead Forever",
    authors: "Michael Bungay Stanier",
    publisher: "Page Two",
    rating: 4.6,
    external_url: "https://www.amazon.com/Coaching-Habit-Less-Change-Forever/dp/0978440749",
    description: "Seven essential questions for coaching team members, adapting leadership style based on situation, balancing task completion with team morale and development.",
    capability_level: "advancing"
  },
  // LEVEL 3: INDEPENDENT
  {
    title: "Good to Great: Why Some Companies Make the Leap and Others Don't",
    authors: "Jim Collins",
    publisher: "HarperBusiness",
    rating: 4.5,
    external_url: "https://www.amazon.com/Good-Great-Some-Companies-Others/dp/0066620996",
    description: "Level 5 Leadership framework for building high-performing teams autonomously, making difficult decisions about resources and priorities, inspiring and motivating others to achieve challenging goals.",
    capability_level: "independent"
  },
  {
    title: "Leading Teams: Setting the Stage for Great Performances",
    authors: "J. Richard Hackman",
    publisher: "Harvard Business Review Press",
    rating: 4.4,
    external_url: "https://www.amazon.com/Leading-Teams-Setting-Stage-Performances/dp/1578513332",
    description: "Research-based framework for creating self-managing, high-performing teams. Addresses developing talent, handling complex performance issues, and building strong collaboration and accountability.",
    capability_level: "independent"
  },
  {
    title: "Leaders Eat Last: Why Some Teams Pull Together and Others Don't",
    authors: "Simon Sinek",
    publisher: "Portfolio",
    rating: 4.6,
    external_url: "https://www.amazon.com/Leaders-Eat-Last-Together-Others/dp/1591848016",
    description: "Creating cultures of trust, inspiring teams through compelling vision, handling complex personnel decisions, developing leadership with full autonomy and confidence.",
    capability_level: "independent"
  },
  // LEVEL 4: MASTERY
  {
    title: "The Culture Code: The Secrets of Highly Successful Groups",
    authors: "Daniel Coyle",
    publisher: "Bantam",
    rating: 4.6,
    external_url: "https://www.amazon.com/Culture-Code-Secrets-Highly-Successful/dp/0804176981",
    description: "Deep insights into building organizational culture, shaping company culture through leadership, mentoring senior leaders, making strategic decisions about organizational structure and design.",
    capability_level: "mastery"
  },
  {
    title: "Multipliers: How the Best Leaders Make Everyone Smarter",
    authors: "Liz Wiseman",
    publisher: "HarperBusiness",
    rating: 4.5,
    external_url: "https://www.amazon.com/Multipliers-Best-Leaders-Everyone-Smarter/dp/0061964395",
    description: "Framework for amplifying team intelligence and capability, developing other leaders who can lead independently, creating systems for sustainable organizational growth and leadership excellence.",
    capability_level: "mastery"
  },
  {
    title: "Leadership and Self-Deception: Getting Out of the Box",
    authors: "The Arbinger Institute",
    publisher: "Berrett-Koehler Publishers",
    rating: 4.6,
    external_url: "https://www.amazon.com/Leadership-Self-Deception-Getting-Out-Box/dp/1576759776",
    description: "Advanced self-awareness and mindset transformation for senior leaders, addressing blind spots in leadership, creating breakthrough performance through authentic leadership.",
    capability_level: "mastery"
  },
  {
    title: "Turn the Ship Around!: A True Story of Turning Followers into Leaders",
    authors: "L. David Marquet",
    publisher: "Portfolio",
    rating: 4.7,
    external_url: "https://www.amazon.com/Turn-Ship-Around-Turning-Followers/dp/1591846404",
    description: "Revolutionary leader-leader model for developing autonomous leaders throughout organization, strategic approach to delegating authority and building self-sufficient teams.",
    capability_level: "mastery"
  }
];

const levelMap: Record<BookResource['capability_level'], 'beginner' | 'intermediate' | 'advanced' | 'expert'> = {
  foundational: 'beginner',
  advancing: 'intermediate',
  independent: 'advanced',
  mastery: 'expert',
};
const mapLevel = (lvl: BookResource['capability_level']) => levelMap[lvl];

export async function importLeadershipBooks(companyId: string) {
  try {
    // Get the Leadership capability
    const { data: capability, error: capError } = await supabase
      .from("capabilities")
      .select("id")
      .eq("name", "Leadership")
      .maybeSingle();

    if (capError) throw capError;
    if (!capability) throw new Error("Leadership capability not found");

    // Import each book
    const results = [];
    for (const book of leadershipBooks) {
      const { data, error } = await supabase
        .from("resources")
        .insert({
          title: book.title,
          content_type: "book",
          url: book.external_url,
          description: book.description,
          capability_id: capability.id,
          capability_level: mapLevel(book.capability_level),
          company_id: companyId,
          is_active: true,
          authors: book.authors,
          publisher: book.publisher,
          rating: book.rating,
          external_url: book.external_url
        } as any)
        .select()
        .single();

      if (error) {
        console.error(`Error importing ${book.title}:`, error);
        results.push({ success: false, title: book.title, error: error.message });
      } else {
        results.push({ success: true, title: book.title, id: data.id });
      }
    }

    return results;
  } catch (error: any) {
    console.error("Error importing leadership books:", error);
    throw error;
  }
}
