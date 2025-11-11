-- Add comprehensive level descriptions for Coaching & Mentoring
INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Shares knowledge and best practices with team members when asked for help or guidance

Provides encouraging feedback that acknowledges others'' efforts and contributions positively

Demonstrates patience when explaining concepts or processes to less experienced colleagues

Models desired behaviors and work habits that others can observe and learn from

Asks thoughtful questions to understand others'' challenges before offering suggestions

Documents processes or creates simple guides that help others learn and develop skills'
FROM capabilities WHERE name = 'Coaching & Mentoring'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Provides regular coaching and feedback that helps others identify and close skill gaps effectively

Creates development plans with clear goals and actionable steps for mentees to follow

Asks powerful questions that encourage self-discovery rather than simply providing answers

Balances support and challenge appropriately to stretch mentees without overwhelming them

Identifies learning opportunities and growth assignments that accelerate others'' development

Shares personal experiences and lessons learned to help others navigate challenges successfully

Tailors coaching approach to individual learning styles, motivations, and development needs'
FROM capabilities WHERE name = 'Coaching & Mentoring'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Develops comprehensive mentoring programs that systematically build capabilities across teams

Coaches others through complex challenges using advanced techniques like powerful questioning and reflective practice

Provides developmental feedback that transforms performance and accelerates career progression significantly

Creates learning culture where team members actively seek growth and support each other''s development

Identifies high-potential talent and designs customized development paths aligned with organizational needs

Measures mentoring impact through improved performance, retention, and career advancement metrics

Navigates difficult coaching conversations about performance or behavior issues with skill and empathy

Develops other coaches and mentors throughout the organization, multiplying impact exponentially'
FROM capabilities WHERE name = 'Coaching & Mentoring'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Establishes organizational coaching and mentoring methodologies adopted enterprise-wide for talent development

Transforms organizational learning culture through systematic capability building at all levels

Develops leaders who become exceptional coaches themselves, creating sustainable talent development systems

Creates mentoring frameworks that accelerate high-potential development and succession planning effectiveness

Achieves measurably improved organizational capability, engagement, and retention through coaching excellence

Influences senior leadership development through executive coaching that drives strategic thinking and decision-making

Recognized as coaching authority internally and externally, contributing to industry best practices and knowledge

Coaches across organizational boundaries, building capabilities in partners, customers, or industry peers'
FROM capabilities WHERE name = 'Coaching & Mentoring'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

-- Add comprehensive level descriptions for Cross-functional Partnership
INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Coordinates work with other departments following established processes and escalation paths

Responds promptly and professionally to requests from cross-functional team members

Communicates clearly about dependencies, timelines, and potential obstacles affecting other teams

Seeks to understand other departments'' priorities and constraints when collaborating

Participates constructively in cross-functional meetings and project teams

Builds positive working relationships with colleagues across organizational boundaries'
FROM capabilities WHERE name = 'Cross-functional Partnership'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Proactively engages relevant functions early when planning initiatives requiring cross-team support

Identifies and resolves conflicts between departmental priorities through collaborative problem-solving

Translates technical or functional requirements into language other departments understand clearly

Builds trusted relationships across functions that enable informal problem-solving and faster resolution

Balances own team''s needs with broader organizational objectives when making decisions

Facilitates effective collaboration by clarifying roles, responsibilities, and decision rights upfront

Represents team effectively in cross-functional forums, advocating for needs while remaining collaborative'
FROM capabilities WHERE name = 'Cross-functional Partnership'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Designs and leads complex cross-functional initiatives involving multiple departments and stakeholder groups

Navigates organizational politics and competing priorities to drive alignment and forward momentum

Breaks down silos by creating new collaboration models and communication channels across functions

Influences cross-functional partners through expertise, data, and relationship capital built over time

Resolves complex conflicts between departments by finding creative solutions serving broader organizational goals

Builds and leads high-performing cross-functional teams with clear governance and accountability

Identifies systemic organizational issues hindering collaboration and drives improvements at scale

Develops frameworks and processes that make cross-functional partnership easier and more effective'
FROM capabilities WHERE name = 'Cross-functional Partnership'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Establishes organizational partnership models and governance frameworks adopted enterprise-wide

Transforms organizational culture from siloed to truly collaborative through systematic intervention

Influences senior leadership to prioritize cross-functional collaboration in strategy and decision-making

Designs and implements matrixed organizational structures that optimize collaboration without chaos

Creates mechanisms ensuring knowledge sharing and capability building flows freely across boundaries

Achieves measurably improved organizational effectiveness through superior cross-functional integration

Develops leaders throughout organization who excel at partnership and collaborative problem-solving

Recognized as partnership authority internally and externally, shaping industry best practices'
FROM capabilities WHERE name = 'Cross-functional Partnership'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

-- Add comprehensive level descriptions for Empathy
INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Listens attentively to others without interrupting or rushing to offer solutions immediately

Acknowledges others'' emotions and perspectives even when disagreeing with their viewpoint

Responds with patience and respect when others are frustrated, stressed, or facing challenges

Asks questions to better understand others'' situations before making judgments or assumptions

Shows consideration for others'' workload and personal circumstances when making requests

Expresses appreciation for others'' contributions and recognizes when they are struggling'
FROM capabilities WHERE name = 'Empathy'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Accurately reads others'' emotional states and adjusts communication style accordingly to be more effective

Demonstrates genuine understanding of diverse perspectives and experiences different from own background

Provides support tailored to individual needs rather than assuming everyone needs same approach

Recognizes when someone needs space versus when they need support during difficult situations

Creates psychologically safe environment where others feel comfortable sharing concerns and challenges

Balances empathy with accountability, caring about people while maintaining performance standards

Helps others feel heard and understood even when unable to accommodate their requests or preferences'
FROM capabilities WHERE name = 'Empathy'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Builds deep trust with diverse stakeholders by demonstrating consistent empathy and understanding

Navigates emotionally charged situations with sensitivity while moving toward constructive outcomes

Anticipates others'' reactions and concerns, proactively addressing them before they escalate

Coaches others to develop greater empathy and emotional intelligence in their interactions

Creates inclusive environment where people from all backgrounds feel valued and respected

Balances empathy for individuals with needs of broader team or organization when making difficult decisions

Uses empathy strategically to build relationships, influence effectively, and drive positive change

Recognizes and addresses systemic issues causing stress or inequality rather than treating symptoms'
FROM capabilities WHERE name = 'Empathy'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Transforms organizational culture to prioritize empathy, psychological safety, and human-centered leadership

Influences senior leadership to integrate empathy into strategy, policies, and decision-making processes

Designs systems and practices that embed empathy throughout employee experience and customer interactions

Creates lasting organizational change in how people treat each other and relate across differences

Develops leaders throughout organization who lead with empathy while maintaining high performance

Achieves measurably improved engagement, retention, innovation, and performance through empathetic culture

Recognized as empathy authority internally and externally, shaping industry practices and leadership thinking

Addresses societal or industry-level issues related to inclusion, equity, and human dignity at scale'
FROM capabilities WHERE name = 'Empathy'
ON CONFLICT (capability_id, level) DO UPDATE SET description = EXCLUDED.description;