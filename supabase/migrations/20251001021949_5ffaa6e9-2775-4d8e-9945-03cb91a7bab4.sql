-- Update capabilities with full descriptions and insert all capability levels
-- This migration populates the detailed capability framework from the Jericho standard

-- Update full_description for each capability
UPDATE capabilities SET full_description = 'The ability to guide, inspire, and develop others to achieve organizational goals while building high-performing teams and creating a positive culture.' WHERE name = 'Leadership';
UPDATE capabilities SET full_description = 'The ability to think long-term, connect daily work to broader business objectives, identify patterns and opportunities, and make strategic decisions that position the organization for success.' WHERE name = 'Strategic Thinking';
UPDATE capabilities SET full_description = 'The ability to make sound, timely decisions on matters ranging from routine to complex, considering multiple perspectives, stakeholders, and long-term implications.' WHERE name = 'Decision Making';
UPDATE capabilities SET full_description = 'The ability to effectively assign tasks and responsibilities to others, providing clear expectations while empowering team members and developing their capabilities.' WHERE name = 'Delegation';
UPDATE capabilities SET full_description = 'The ability to set clear expectations, provide regular feedback, address performance issues, and create accountability while supporting employee development and maintaining organizational standards.' WHERE name = 'Performance Management';
UPDATE capabilities SET full_description = 'The ability to express ideas clearly and professionally in writing across various formats, adapting tone and style for different audiences and purposes.' WHERE name = 'Written Communication';
UPDATE capabilities SET full_description = 'The ability to communicate clearly and confidently in spoken interactions, from one-on-one conversations to large group settings, adapting to different audiences and situations.' WHERE name = 'Verbal Communication';
UPDATE capabilities SET full_description = 'The ability to deliver compelling presentations that inform, persuade, and inspire audiences while maintaining engagement and handling questions effectively.' WHERE name = 'Presentation Skills';
UPDATE capabilities SET full_description = 'The ability to fully concentrate on what others are saying, understand their message and emotions, ask clarifying questions, and respond thoughtfully.' WHERE name = 'Active Listening';
UPDATE capabilities SET full_description = 'The ability to address disagreements and tensions constructively, helping parties understand each other and find workable solutions that strengthen relationships.' WHERE name = 'Conflict Resolution';
UPDATE capabilities SET full_description = 'The ability to gather, analyze, and interpret data to identify patterns, draw insights, and make data-driven recommendations that solve business problems.' WHERE name = 'Data Analysis';
UPDATE capabilities SET full_description = 'Deep proficiency in the technical skills and knowledge required for one''s role, staying current with developments and applying expertise to solve problems.' WHERE name = 'Technical Expertise';
UPDATE capabilities SET full_description = 'The ability to plan, organize, and execute projects of varying complexity, managing scope, time, resources, and stakeholders to deliver successful outcomes.' WHERE name = 'Project Management';
UPDATE capabilities SET full_description = 'The ability to identify inefficiencies in current processes, design better approaches, and implement improvements that increase quality, speed, or cost-effectiveness.' WHERE name = 'Process Improvement';
UPDATE capabilities SET full_description = 'The ability to define problems clearly, identify root causes, develop creative solutions, and implement approaches that address current issues and prevent future ones.' WHERE name = 'Problem Solving';
UPDATE capabilities SET full_description = 'The ability to work effectively with others toward shared goals, building trust, sharing information and credit, and navigating diverse perspectives and work styles.' WHERE name = 'Collaboration';
UPDATE capabilities SET full_description = 'The ability to build and maintain professional relationships based on trust and mutual respect, expanding one''s network and leveraging connections to create value.' WHERE name = 'Relationship Building';
UPDATE capabilities SET full_description = 'The ability to recognize and manage one''s own emotions, understand others'' emotions and perspectives, and use this awareness to guide interactions and decisions.' WHERE name = 'Emotional Intelligence';
UPDATE capabilities SET full_description = 'The ability to adjust to changing circumstances, remain effective in ambiguous situations, and help others navigate uncertainty and transformation.' WHERE name = 'Adaptability';
UPDATE capabilities SET full_description = 'The ability to gain buy-in for ideas and proposals by building credibility, using multiple influence strategies, and adapting approach to different audiences.' WHERE name = 'Influence';
UPDATE capabilities SET full_description = 'The ability to take ownership of commitments and outcomes, follow through consistently, and hold oneself and others accountable to high standards.' WHERE name = 'Accountability';
UPDATE capabilities SET full_description = 'The ability to prioritize effectively, manage competing demands, meet deadlines consistently, and optimize time to maximize productivity and impact.' WHERE name = 'Time Management';
UPDATE capabilities SET full_description = 'The ability to produce accurate, thorough work with appropriate precision, catching errors before they cause problems while balancing quality with speed.' WHERE name = 'Attention to Detail';
UPDATE capabilities SET full_description = 'The ability to create comprehensive plans, organize work and information effectively, anticipate obstacles, and adjust plans as circumstances change.' WHERE name = 'Planning & Organization';
UPDATE capabilities SET full_description = 'The ability to focus on achieving goals and measurable outcomes, persist through obstacles, and consistently deliver results that create organizational impact.' WHERE name = 'Results Orientation';
UPDATE capabilities SET full_description = 'The ability to drive organizational transformation through radical transformation and renewal of thinking patterns, structures, and approaches to work.' WHERE name = 'Change Management';

-- Insert capability levels for Leadership
INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'foundational', 'Demonstrates willingness to take on small leadership tasks when asked. Leads simple, short-term initiatives with clear instructions and oversight. Shows respect for team members and attempts to motivate others informally. Begins to understand the difference between managing tasks and leading people. Accepts feedback on leadership approach and attempts to apply it. May struggle with authority or confidence when directing others. Focuses primarily on completing assigned leadership tasks rather than inspiring vision.'
FROM capabilities WHERE name = 'Leadership'
ON CONFLICT (capability_id, level) DO NOTHING;

INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'advancing', 'Leads small teams or projects with minimal supervision. Inspires and motivates others to achieve challenging goals. Makes difficult leadership decisions on resource allocation and priorities. Handles performance issues and difficult conversations with increasing skill. Develops talent by identifying strengths and creating growth opportunities. Builds collaborative teams with accountability. Articulates vision and translates it into actionable plans. Balances short-term results with team morale and development.'
FROM capabilities WHERE name = 'Leadership'
ON CONFLICT (capability_id, level) DO NOTHING;

INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'independent', 'Exceptional leader who transforms team culture and drives organizational change. Handles complex performance issues, conflicts, and difficult conversations skillfully. Builds high-performing teams with strong collaboration and accountability. Articulates a compelling vision and translates it into actionable plans. Recognized by peers and senior leaders as an effective leader. Balances long-term results with high-performing team health and development. Creates succession plans and deliberately develops future leaders.'
FROM capabilities WHERE name = 'Leadership'
ON CONFLICT (capability_id, level) DO NOTHING;

INSERT INTO capability_levels (capability_id, level, description)
SELECT id, 'mastery', 'Develops other leaders and builds leadership capability across the organization. Sought out by executives for advice on complex leadership challenges. Shapes organizational vision and strategy at the highest levels. Coaches senior leaders on their leadership development. Sets the benchmark for leadership excellence in the organization. Creates resilient, high-performing teams and organizational cultures that sustain performance over time.'
FROM capabilities WHERE name = 'Leadership'
ON CONFLICT (capability_id, level) DO NOTHING;