-- Add comprehensive level descriptions for Influencing
INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Presents ideas and recommendations clearly with supporting facts and logical reasoning

Listens actively to others'' perspectives before advocating for own viewpoint

Adapts communication approach based on audience feedback and engagement levels

Builds credibility through consistent delivery on commitments and professional behavior

Asks questions to understand others'' concerns and interests before presenting solutions

Acknowledges valid concerns and incorporates feedback when appropriate to build buy-in'
FROM capabilities WHERE name = 'Influencing'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Persuades others by connecting proposals to their goals, values, and priorities effectively

Anticipates objections and proactively addresses concerns before they become barriers

Uses data, stories, and examples strategically to make compelling cases for change or action

Builds coalitions of support by engaging key stakeholders early in the process

Negotiates win-win solutions when facing conflicting interests or competing priorities

Maintains relationships and trust even when unable to achieve desired outcomes

Influences through expertise, relationships, and strategic communication rather than authority alone'
FROM capabilities WHERE name = 'Influencing'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Influences senior leaders and executives through strategic framing and business impact articulation

Navigates complex political landscapes to advance important initiatives despite resistance or obstacles

Builds and leverages broad networks to mobilize support for strategic priorities across the organization

Changes minds on controversial topics by reframing issues and finding common ground effectively

Uses influence ethically, balancing organizational needs with individual and team interests appropriately

Develops influencing strategies that account for diverse stakeholder motivations and decision-making styles

Creates momentum for change by identifying and activating early adopters and influencers strategically

Coaches others in effective influence and persuasion techniques to multiply impact across teams'
FROM capabilities WHERE name = 'Influencing'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Shapes organizational strategy and culture through exceptional influence at the highest levels

Transforms how leaders throughout organization think about critical issues and priorities

Influences external stakeholders including board members, investors, regulators, or industry bodies

Drives large-scale organizational change by building broad coalitions and shifting collective mindsets

Creates influence frameworks and methodologies adopted throughout the organization for consistent impact

Develops leaders who become highly influential in their own right, multiplying impact exponentially

Achieves recognition as influential authority internally and externally, shaping industry thinking

Uses influence to advance organizational mission while maintaining highest ethical standards and trust'
FROM capabilities WHERE name = 'Influencing'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

-- Add comprehensive level descriptions for People Management
INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Provides clear direction and expectations for individual tasks with appropriate level of detail

Follows up regularly to track progress and offer support when team members encounter obstacles

Recognizes good work and provides constructive feedback to help team members improve performance

Treats all team members fairly and with respect, creating positive working environment

Escalates people issues or conflicts to manager when appropriate rather than ignoring problems

Participates in team meetings and one-on-ones consistently and comes prepared with relevant topics'
FROM capabilities WHERE name = 'People Management'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Sets clear goals and expectations that align individual work with team and organizational objectives

Delegates effectively by matching assignments to team members'' capabilities and development needs

Provides regular coaching and feedback that improves performance and builds capabilities systematically

Conducts productive one-on-ones addressing both business priorities and individual development needs

Addresses performance issues promptly and directly with clear expectations for improvement

Recognizes and leverages diverse strengths across team to optimize overall team performance

Builds team cohesion through effective communication, recognition, and creating shared purpose

Advocates for team members'' development opportunities and career advancement appropriately'
FROM capabilities WHERE name = 'People Management'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Builds high-performing teams with clear roles, accountability, and collaborative culture

Attracts and selects talent that raises team capability and fits organizational culture effectively

Develops comprehensive talent strategy addressing capability gaps, succession planning, and retention risks

Navigates complex people situations involving performance, behavior, or interpersonal conflicts skillfully

Creates development opportunities that accelerate team member growth and prepare them for advancement

Manages team performance through effective goal setting, feedback, and differentiated recognition

Builds inclusive environment where diverse perspectives are valued and all team members can thrive

Makes difficult people decisions including restructuring, role changes, or separations when necessary

Implements people management practices and processes that other managers adopt as best practices'
FROM capabilities WHERE name = 'People Management'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Establishes people management philosophies and systems adopted throughout the organization

Develops management capabilities across the organization through leadership development programs

Transforms organizational culture through systematic attention to talent, performance, and engagement

Creates talent management processes that ensure right people in right roles with clear succession plans

Builds organizational bench strength that enables growth and ensures leadership continuity

Achieves measurably superior talent outcomes including engagement, performance, retention, and diversity

Influences senior leadership to prioritize people management as strategic advantage and competitive differentiator

Recognized as people management authority internally and externally, shaping industry best practices

Develops leaders who become exceptional people managers themselves, creating sustainable organizational capability'
FROM capabilities WHERE name = 'People Management'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

-- Update Organisational Awareness with comprehensive descriptions
DELETE FROM capability_levels WHERE capability_id = (SELECT id FROM capabilities WHERE name = 'Organisational Awareness');

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Understands own role, team structure, and immediate department within the broader organization

Knows key organizational policies, procedures, and where to find information and resources needed

Recognizes major organizational events, initiatives, and changes communicated through standard channels

Identifies relevant stakeholders for own work and understands basic escalation paths

Asks questions to understand organizational context when unclear about priorities or decisions

Attends company meetings and communications actively, staying informed about organizational direction'
FROM capabilities WHERE name = 'Organisational Awareness'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Understands organizational structure across departments and how different functions interact and depend on each other

Recognizes how external factors including market conditions, competition, and regulations impact the organization

Identifies key decision-makers and influencers beyond immediate reporting structure for various topics

Anticipates how organizational changes or external events will affect team and plans accordingly

Seeks information from multiple sources to understand full context behind organizational decisions

Helps team members understand organizational priorities and how their work connects to broader goals

Navigates organizational processes and informal networks effectively to get work done efficiently'
FROM capabilities WHERE name = 'Organisational Awareness'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Demonstrates deep understanding of organizational strategy, competitive position, and stakeholder dynamics

Recognizes underlying political dynamics and power structures that influence organizational decisions

Anticipates organizational changes before they are announced by reading environmental and leadership signals

Uses organizational knowledge strategically to advance important initiatives and navigate complexity

Identifies systemic organizational issues and proposes solutions that address root causes effectively

Helps others develop organizational awareness by sharing context and explaining the "why" behind decisions

Builds strategic relationships across organizational boundaries that create value and enable influence

Advises leadership on organizational implications of strategic decisions and change initiatives'
FROM capabilities WHERE name = 'Organisational Awareness'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Shapes organizational strategy by deeply understanding internal capabilities and external competitive dynamics

Influences how the organization positions itself strategically in the market and industry ecosystem

Anticipates industry shifts and disruptions, positioning organization to adapt or lead proactively

Develops organizational sensing mechanisms that enable early detection of threats and opportunities

Creates shared understanding of organizational purpose, strategy, and competitive position across all levels

Transforms organizational culture and capabilities to align with strategic direction and market realities

Achieves recognition as organizational sage who others consult for strategic perspective and organizational wisdom

Builds organizational awareness capabilities throughout leadership ranks, improving strategic decision-making quality'
FROM capabilities WHERE name = 'Organisational Awareness'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;