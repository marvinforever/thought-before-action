-- Add comprehensive level descriptions for Stakeholder Communication
INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Communicates basic updates to immediate stakeholders with manager guidance

Responds to stakeholder inquiries promptly and professionally

Uses standard communication templates and established channels effectively

Escalates stakeholder concerns to manager when appropriate

Maintains regular contact with key stakeholders through scheduled touchpoints

Documents stakeholder interactions in required systems accurately'
FROM capabilities WHERE name = 'Stakeholder Communication'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Proactively communicates project status and issues to relevant stakeholders

Tailors communication style and detail level to different stakeholder audiences

Manages stakeholder expectations by setting clear timelines and deliverables

Identifies and addresses stakeholder concerns before they escalate

Builds trusted relationships with key stakeholders through consistent engagement

Facilitates productive stakeholder meetings with clear agendas and outcomes'
FROM capabilities WHERE name = 'Stakeholder Communication'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Develops comprehensive stakeholder communication strategies for complex initiatives

Maps stakeholder influence and interest levels to prioritize engagement effectively

Navigates conflicting stakeholder priorities and builds consensus around solutions

Communicates complex technical or business concepts clearly to non-expert audiences

Manages executive-level stakeholder relationships with confidence and professionalism

Anticipates stakeholder needs and proactively provides relevant information and updates

Creates communication frameworks adopted by team members for consistent stakeholder engagement'
FROM capabilities WHERE name = 'Stakeholder Communication'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Establishes organization-wide stakeholder engagement standards and best practices

Influences senior leadership decisions through strategic stakeholder alignment

Transforms difficult stakeholder relationships into productive partnerships

Develops stakeholder management methodologies adopted across the organization

Coaches others in advanced stakeholder communication and influence techniques

Achieves measurably improved stakeholder satisfaction and engagement metrics

Creates lasting stakeholder value through exceptional relationship management and strategic communication'
FROM capabilities WHERE name = 'Stakeholder Communication'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

-- Add comprehensive level descriptions for Prioritization
INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Completes assigned tasks in order of specified priority with manager guidance

Recognizes when workload exceeds capacity and requests help appropriately

Uses basic time management tools to track tasks and deadlines effectively

Communicates delays or obstacles that may impact priority deliverables

Focuses on completing one task before moving to the next

Asks clarifying questions to understand task urgency and importance'
FROM capabilities WHERE name = 'Prioritization'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Independently assesses task urgency and importance to set effective priorities

Balances multiple concurrent projects by allocating time based on business impact

Adjusts priorities dynamically as situations and business needs change

Communicates trade-offs clearly when competing priorities require decisions

Identifies and focuses on high-value activities that drive key outcomes

Helps team members prioritize their work by providing clear context and guidance

Protects time for strategic work while managing urgent operational demands'
FROM capabilities WHERE name = 'Prioritization'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Develops prioritization frameworks that align team efforts with strategic objectives

Makes complex priority decisions balancing short-term needs with long-term goals

Identifies opportunities to eliminate low-value work and redirect resources effectively

Manages stakeholder expectations when priorities shift, explaining rationale clearly

Evaluates competing initiatives objectively using data and business impact criteria

Empowers team to make priority decisions within defined guidelines and boundaries

Protects team from unnecessary urgency while maintaining focus on critical deliverables

Coaches others in effective prioritization techniques and decision-making frameworks'
FROM capabilities WHERE name = 'Prioritization'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Establishes organizational prioritization methodologies driving strategic alignment

Influences executive-level priority decisions through data-driven business case development

Creates systems ensuring resources flow to highest-impact initiatives consistently

Eliminates organizational inefficiencies by identifying and stopping low-value work

Develops portfolio management approaches adopted across multiple teams or departments

Transforms organizational culture to focus on strategic priorities over reactive urgency

Achieves measurably improved organizational effectiveness through superior priority management

Mentors leaders in strategic prioritization and resource allocation across the enterprise'
FROM capabilities WHERE name = 'Prioritization'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

-- Add comprehensive level descriptions for Leadership
INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Demonstrates reliability and accountability for individual contributions and commitments

Takes initiative on assigned tasks without requiring constant direction or follow-up

Models professional behavior and positive attitude that influences team culture

Supports team goals by completing quality work on time and helping others when needed

Seeks feedback actively and applies learning to improve personal performance

Communicates openly about challenges and asks for guidance when facing obstacles'
FROM capabilities WHERE name = 'Leadership'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Takes ownership of projects or initiatives beyond individual tasks, coordinating work effectively

Provides guidance and support to team members, sharing knowledge and helping remove obstacles

Makes sound decisions within scope of authority, escalating appropriately when needed

Builds credibility through consistent delivery and professional relationships across the organization

Influences others through expertise, communication, and collaborative problem-solving approaches

Identifies opportunities for improvement and takes action to implement positive changes

Demonstrates resilience during challenges, maintaining team morale and forward momentum'
FROM capabilities WHERE name = 'Leadership'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Leads teams or significant initiatives requiring coordination across multiple stakeholders and functions

Sets clear direction and inspires others to commit to ambitious goals and challenging objectives

Develops talent through effective coaching, feedback, and creating growth opportunities for team members

Makes difficult decisions balancing competing priorities and stakeholder needs with sound judgment

Builds high-performing team culture characterized by trust, accountability, and collaboration

Drives change initiatives successfully by building buy-in and managing resistance effectively

Navigates organizational complexity and politics to achieve results while maintaining strong relationships

Demonstrates strategic thinking by connecting team work to broader organizational objectives clearly'
FROM capabilities WHERE name = 'Leadership'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Establishes vision and strategy that shapes organizational direction and inspires commitment across all levels

Develops leaders throughout the organization through systematic talent development and succession planning

Influences organizational culture profoundly through values, behaviors, and decisions that cascade downward

Drives transformational change successfully by building coalitions and navigating complex political landscapes

Makes enterprise-level decisions with incomplete information, accepting accountability for outcomes and impacts

Builds organizational capabilities that create sustainable competitive advantages in the marketplace

Develops leadership frameworks and methodologies adopted organization-wide for consistent excellence

Achieves recognition as organizational leadership authority internally and externally in the industry or field'
FROM capabilities WHERE name = 'Leadership'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;