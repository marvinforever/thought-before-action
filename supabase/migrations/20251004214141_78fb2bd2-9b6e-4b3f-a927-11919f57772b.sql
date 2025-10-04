-- Insert new capabilities and their levels
-- Commercial Acumen
INSERT INTO capabilities (name, category, description, status)
VALUES (
  'Commercial Acumen',
  'Business Acumen',
  'Understanding of business economics, profit drivers, market dynamics, competitive positioning, and financial metrics that enables sound commercial decision-making.',
  'approved'
);

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Understands basic business concepts (revenue, costs, profit margins). Asks questions about how their work contributes to financial outcomes. Recognizes which customers or products are most profitable for organization. Follows pricing guidelines and approval processes. Identifies obvious opportunities to reduce costs or increase revenue. Reads company financial communications to understand business performance. Considers cost implications when making routine decisions.'
FROM capabilities WHERE name = 'Commercial Acumen';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Analyzes financial statements (P&L, balance sheet, cash flow) to understand business health. Calculates ROI for proposed initiatives or investments. Identifies pricing opportunities based on value delivered and competitive positioning. Monitors key commercial metrics (revenue growth, margin, customer acquisition cost). Understands economic model of different products or business lines. Proposes commercial improvements backed by financial analysis. Explains business rationale for decisions to non-financial stakeholders. Spots commercial risks or opportunities in market changes.'
FROM capabilities WHERE name = 'Commercial Acumen';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Develops commercial strategies for business unit or product line. Designs pricing models and revenue strategies that maximize profitability. Conducts market and competitive analysis to identify commercial opportunities. Manages P&L accountability for significant business area (revenue, costs, margin targets). Negotiates complex commercial agreements that balance risk and reward. Creates financial models that inform strategic decisions (make-versus-buy, market entry, M&A). Builds commercial capability in team through coaching and transparency. Partners effectively with finance to optimize business performance.'
FROM capabilities WHERE name = 'Commercial Acumen';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Shapes commercial strategy for entire organization or major business segment. Identifies and pursues new business models that create competitive advantage. Makes portfolio decisions (invest, divest, transform) that reshape organizational economics. Negotiates transformational deals (partnerships, acquisitions, major contracts) that change market position. Reads macroeconomic and market signals to anticipate commercial shifts. Balances short-term financial performance with long-term value creation. Creates commercial discipline and financial literacy across organization. Recognized as business leader who consistently delivers profitable growth.'
FROM capabilities WHERE name = 'Commercial Acumen';

-- Managing Expectations
INSERT INTO capabilities (name, category, description, status)
VALUES (
  'Managing Expectations',
  'Task Management',
  'Skill in setting realistic commitments, communicating progress and constraints clearly, and proactively managing stakeholder understanding of what can be delivered and when.',
  'approved'
);

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Provides honest updates on task status when asked by supervisor. Flags delays or problems as soon as they become apparent. Asks questions to clarify expectations before starting work. Communicates when workload makes deadline unrealistic. Underpromises and overdelivers when possible. Confirms understanding of requirements before committing to deliverables. Apologizes and adjusts when unable to meet commitments.'
FROM capabilities WHERE name = 'Managing Expectations';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Sets clear expectations with stakeholders about scope, timeline, and quality tradeoffs. Establishes regular update cadence for projects (weekly status, milestone reviews). Manages scope creep by documenting changes and their impact on timeline or resources. Negotiates realistic deadlines based on capacity and dependencies. Creates transparency around blockers and risks that could impact delivery. Recalibrates expectations proactively when situation changes. Balances optimism with realism in commitments. Tracks record of commitments met to build credibility.'
FROM capabilities WHERE name = 'Managing Expectations';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Establishes expectation management frameworks for team or department (SLAs, capacity planning, intake processes). Educates stakeholders on realistic timelines and resource requirements for different types of work. Creates dashboards or reporting that provide visibility into progress without requiring constant updates. Manages expectations across multiple concurrent initiatives with competing priorities. Negotiates executive-level commitments that balance ambition with feasibility. Builds buffer into plans to account for unforeseen challenges. Maintains stakeholder trust even when delivering difficult messages about delays or constraints. Coaches team members in effective expectation management techniques.'
FROM capabilities WHERE name = 'Managing Expectations';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Shapes organizational culture around realistic commitments and transparent communication. Manages expectations for board, investors, or executive stakeholders on strategic initiatives. Balances aggressive goals that stretch organization with achievable milestones that maintain credibility. Creates enterprise-wide visibility into commitments, capacity, and delivery performance. Turns missed commitments into opportunities for organizational learning rather than blame. Maintains reputation for integrity in commitments across years of delivery. Influences industry standards for project communication and stakeholder management. Trusted advisor to executives navigating complex stakeholder dynamics.'
FROM capabilities WHERE name = 'Managing Expectations';

-- Organisational Awareness
INSERT INTO capabilities (name, category, description, status)
VALUES (
  'Organisational Awareness',
  'Business Acumen',
  'Understanding own organisation and the broader context in which it operates.',
  'approved'
);

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Understands own role and team within the organization. Knows basic organizational policies.'
FROM capabilities WHERE name = 'Organisational Awareness';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Understands the organizational structure, key departments, and their functions. Recognizes the impact of external factors on the organization.'
FROM capabilities WHERE name = 'Organisational Awareness';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Possesses a comprehensive understanding of the organization''s strategic goals, stakeholder landscape, and the broader industry context. Navigates complex organizational dynamics effectively.'
FROM capabilities WHERE name = 'Organisational Awareness';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'A highly influential leader with an profound understanding of the organization''s history, culture, and strategic direction, as well as the global political and economic forces impacting it. Uses this insight to drive transformative change.'
FROM capabilities WHERE name = 'Organisational Awareness';

-- Resilience
INSERT INTO capabilities (name, category, description, status)
VALUES (
  'Resilience',
  'Personal',
  'Capacity to recover quickly from setbacks, maintain effectiveness under pressure, adapt to changing circumstances, and sustain performance through adversity.',
  'approved'
);

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Maintains basic productivity during routine stressful periods (deadlines, busy seasons). Asks for support when feeling overwhelmed. Takes breaks to manage energy throughout day. Recognizes personal signs of burnout (exhaustion, cynicism, reduced effectiveness). Separates work stress from personal life through boundaries. Bounces back from small setbacks within hours or days. Practices basic stress management techniques (exercise, sleep, time off).'
FROM capabilities WHERE name = 'Resilience';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Performs effectively during sustained periods of high pressure or ambiguity. Develops personal stress management routines (meditation, exercise, peer support). Maintains perspective when facing setbacks by focusing on what can be controlled. Adapts plans quickly when circumstances change unexpectedly. Supports team members who are struggling with stress or challenges. Identifies patterns in what depletes versus restores personal energy. Proactively manages workload to prevent burnout. Recovers from moderate failures within days or weeks without loss of confidence.'
FROM capabilities WHERE name = 'Resilience';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Maintains high performance through major organizational crises or transitions. Leads team through uncertainty with calm confidence and clear direction. Creates systems that prevent burnout (workload management, psychological safety, recovery time). Bounces back from significant failures with learnings extracted and confidence intact. Demonstrates emotional regulation during high-stakes or contentious situations. Builds organizational resilience through redundancy, cross-training, and risk management. Models healthy boundaries and self-care without sacrificing excellence. Helps others develop resilience through coaching and culture-building.'
FROM capabilities WHERE name = 'Resilience';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Sustains exceptional performance through extended periods of extreme adversity or uncertainty. Leads organizational turnarounds or transformations without losing team commitment. Creates organizational cultures that thrive under pressure through purpose, trust, and support systems. Recovers from catastrophic failures with reputation intact and wisdom gained. Maintains physical, emotional, and spiritual health through practices that others seek to emulate. Shares story of resilience in ways that inspire others facing hardship. Recognized as steady leader who others trust in crisis situations. Influences industry understanding of sustainable high performance.'
FROM capabilities WHERE name = 'Resilience';

-- Resource Management
INSERT INTO capabilities (name, category, description, status)
VALUES (
  'Resource Management',
  'Task Management',
  'Skill in acquiring, allocating, optimizing, and tracking use of resources (people, budget, equipment, technology) to maximize effectiveness and efficiency.',
  'approved'
);

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Tracks time spent on projects and tasks accurately. Uses assigned budget responsibly without overspending. Notifies supervisor when resources will run short before deadline. Takes care of equipment and tools provided for work. Requests resources needed to complete assignments. Shares resources with team members when not in use. Completes basic expense reporting and resource tracking.'
FROM capabilities WHERE name = 'Resource Management';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Forecasts resource needs for projects based on scope and timeline. Monitors budget spend against plan and adjusts to stay within limits. Identifies opportunities to repurpose or share resources across projects. Negotiates with peers for shared resources during peak demand periods. Tracks resource utilization to identify inefficiencies or waste. Proposes cost-saving alternatives when original plan becomes too expensive. Manages vendors or contractors to ensure value for investment. Documents resource lessons learned for future projects.'
FROM capabilities WHERE name = 'Resource Management';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Develops resource allocation strategies for department or portfolio of projects. Creates capacity planning models that forecast resource needs across quarters. Builds business cases for resource investments (headcount, technology, facilities). Optimizes resource utilization through cross-training, flexible allocation, and priority management. Establishes vendor management frameworks and negotiates strategic contracts. Implements resource tracking systems that provide real-time visibility. Makes trade-off decisions between competing resource demands based on strategic priorities. Develops team''s skills in resource estimation and management.'
FROM capabilities WHERE name = 'Resource Management';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Architects resource allocation frameworks for entire organization or business unit. Manages eight or nine-figure budgets with accountability for ROI and strategic outcomes. Creates resource optimization engines that drive competitive advantage through efficiency. Makes enterprise-level build-versus-buy decisions on critical capabilities. Negotiates enterprise agreements with major vendors that shape market dynamics. Reallocates resources at scale to respond to market shifts or strategic pivots. Builds organizational capability in financial discipline and resource stewardship. Recognized for ability to deliver exceptional results with constrained resources.'
FROM capabilities WHERE name = 'Resource Management';

-- Risk Management
INSERT INTO capabilities (name, category, description, status)
VALUES (
  'Risk Management',
  'Business Acumen',
  'Ability to identify, assess, prioritize, mitigate, and monitor risks (operational, financial, reputational, compliance) that could impact objectives.',
  'approved'
);

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Identifies obvious risks in assigned work (safety hazards, data loss, missed deadlines). Reports risks to supervisor when discovered. Follows established risk mitigation procedures and controls. Asks questions when uncertain about proper risk handling. Documents issues that could become larger problems. Escalates risk concerns to appropriate authority. Learns from incidents to avoid repeating mistakes.'
FROM capabilities WHERE name = 'Risk Management';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Conducts risk assessments for projects using likelihood and impact analysis. Creates risk registers that track identified risks and mitigation plans. Implements controls to reduce risk exposure (backups, approvals, testing). Monitors risk indicators and adjusts plans when risk levels change. Balances risk and reward when making tactical decisions. Communicates risks clearly to stakeholders with recommended actions. Learns from near-misses and implements preventive measures. Stays current on regulatory requirements relevant to role.'
FROM capabilities WHERE name = 'Risk Management';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Designs comprehensive risk management frameworks for business unit or function. Identifies strategic risks that could derail organizational objectives. Quantifies risk exposure using financial modeling and scenario analysis. Creates risk appetite statements and decision criteria for team. Implements risk governance (policies, controls, audits, reporting). Balances innovation and risk-taking with appropriate safeguards. Manages crises effectively when risks materialize into issues. Builds risk awareness and management capability across team. Ensures compliance with relevant regulations (SOX, GDPR, industry standards).'
FROM capabilities WHERE name = 'Risk Management';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Establishes enterprise risk management programs that span all risk categories. Manages organizational risk portfolio at board and executive level. Anticipates emerging risks from market, technology, or regulatory changes. Makes strategic decisions that balance calculated risk-taking with organizational protection. Creates risk culture that encourages transparency and learning over blame. Navigates major crises or regulatory challenges that threaten organizational survival. Influences industry risk management standards and best practices. Maintains organizational reputation through ethical leadership and risk discipline.'
FROM capabilities WHERE name = 'Risk Management';

-- Self Awareness
INSERT INTO capabilities (name, category, description, status)
VALUES (
  'Self Awareness',
  'Personal',
  'Understanding of one''s own strengths, weaknesses, emotional triggers, values, impact on others, and blind spots, paired with commitment to continuous growth.',
  'approved'
);

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'foundational',
  'Accepts feedback from supervisor and peers without becoming defensive. Recognizes own emotional reactions in the moment (frustration, anxiety, excitement). Identifies tasks that energize versus drain them. Asks colleagues how they experience working with them. Acknowledges mistakes and takes ownership when appropriate. Notices patterns in what situations cause stress or conflict. Completes self-assessment tools (DISC, StrengthsFinder) and reflects on results.'
FROM capabilities WHERE name = 'Self Awareness';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'advancing',
  'Actively seeks feedback from multiple sources (peers, direct reports, clients). Articulates own strengths and development areas clearly. Identifies emotional triggers and creates strategies to manage reactions. Adjusts communication style based on audience and context. Recognizes impact of mood and energy on team dynamics. Pursues targeted development activities to address growth areas. Practices regular reflection through journaling or coaching conversations. Shares learnings about self with team to improve collaboration.'
FROM capabilities WHERE name = 'Self Awareness';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'independent',
  'Demonstrates deep understanding of personal values, motivations, and leadership style. Solicits 360-degree feedback regularly and acts on insights gained. Identifies blind spots through intentional practices (peer coaching, executive coaching). Adapts leadership approach based on team needs and organizational context. Names personal biases and actively works to counter them in decision-making. Models vulnerability by sharing growth journey with team. Creates development plans aligned with long-term career vision and organizational needs. Mentors others in developing self-awareness practices.'
FROM capabilities WHERE name = 'Self Awareness';

INSERT INTO capability_levels (capability_id, level, description)
SELECT 
  id,
  'mastery',
  'Operates from place of profound self-knowledge that informs all leadership decisions. Uses self-awareness to navigate high-stakes situations with emotional intelligence and authenticity. Shares personal journey and learnings in ways that inspire organizational culture of growth. Recognizes patterns across career that reveal core purpose and calling. Integrates multiple feedback streams (formal assessments, informal input, outcomes analysis) into continuous development. Creates space for others to develop self-awareness through culture and systems. Recognized for authenticity and congruence between stated values and lived behavior. Influences organizational norms around feedback, growth mindset, and vulnerability.'
FROM capabilities WHERE name = 'Self Awareness';