-- Insert capability levels for Strategic Thinking
INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'foundational', 'Understands basic business goals and how their work contributes to them. Asks questions to understand the "why" behind decisions and priorities. Begins to see connections between different parts of the business. Focuses primarily on immediate tasks but shows curiosity about broader context. Can articulate the purpose of their role within the larger organization. Participates in strategic discussions but primarily as a listener/learner. May struggle to think beyond day-to-day operations without guidance.'
FROM capabilities WHERE name = 'Strategic Thinking'
ON CONFLICT (capability_id, level) DO NOTHING;

INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'advancing', 'Consistently connects daily work to broader business objectives. Identifies patterns and trends that may impact their area of work. Anticipates near-term challenges and proactively raises concerns. Contributes ideas during strategic planning discussions. Understands competitive landscape and market dynamics at a basic level. Thinks 3-6 months ahead when planning projects and priorities.'
FROM capabilities WHERE name = 'Strategic Thinking'
ON CONFLICT (capability_id, level) DO NOTHING;

INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'independent', 'Develops strategic plans for their area with minimal guidance. Identifies opportunities and threats that others may miss. Thinks 1-2 years ahead and positions team accordingly. Makes strategic trade-offs between competing priorities effectively. Analyzes market trends, competitive dynamics, and organizational capabilities. Challenges assumptions and proposes innovative strategic approaches.'
FROM capabilities WHERE name = 'Strategic Thinking'
ON CONFLICT (capability_id, level) DO NOTHING;

INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'mastery', 'Shapes organizational strategy at the highest levels. Integrates insights across multiple disciplines (market, operations, finance, culture). Influences industry trends and competitive dynamics through strategic moves. Coaches other leaders to develop strategic thinking capabilities. Makes bold strategic bets that position the organization for long-term success. Recognized as a strategic thinker by leadership and peers. Visionary who can see around corners. Sought out by board and C-suite for strategic counsel. Sets the strategic direction for major business units or the entire organization.'
FROM capabilities WHERE name = 'Strategic Thinking'
ON CONFLICT (capability_id, level) DO NOTHING;

-- Insert capability levels for Decision Making
INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'foundational', 'Makes routine decisions independently within clearly defined boundaries. Seeks guidance when facing unfamiliar or complex situations. Gathers basic information before making decisions. May hesitate or delay when uncertain about the right choice. Understands the importance of considering consequences. Accepts and learns from decision-making mistakes. Defaults to asking manager when in doubt rather than taking calculated risks.'
FROM capabilities WHERE name = 'Decision Making'
ON CONFLICT (capability_id, level) DO NOTHING;

INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'advancing', 'Makes sound decisions on routine and moderately complex matters independently. Gathers relevant information and considers multiple perspectives. Weighs pros and cons systematically before deciding. Makes timely decisions without unnecessary delay. Knows when to escalate and when to decide independently. Considers short-term and medium-term implications.'
FROM capabilities WHERE name = 'Decision Making'
ON CONFLICT (capability_id, level) DO NOTHING;

INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'independent', 'Makes high-quality decisions on complex, ambiguous issues with confidence. Balances analysis with intuition and experience. Considers multiple stakeholders, long-term implications, and risk factors. Makes tough calls when information is incomplete or time is limited. Takes calculated risks and owns the outcomes. Involves the right people at the right time in the decision-making process. Communicates decisions clearly with supporting rationale. Adjusts decisions quickly when circumstances change. Known for sound judgment in difficult situations.'
FROM capabilities WHERE name = 'Decision Making'
ON CONFLICT (capability_id, level) DO NOTHING;

INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'mastery', 'Makes critical decisions that shape organizational direction and culture. Reflects deeply on decision outcomes to refine approach continuously. Sought out by C-suite for counsel on the most difficult decisions. Sets the standard for decision-making excellence organization-wide. Coaches senior leaders on improving their decision-making capabilities.'
FROM capabilities WHERE name = 'Decision Making'
ON CONFLICT (capability_id, level) DO NOTHING;