-- Seed 26 standard capabilities (idempotent)
WITH seeds(name, description, category) AS (
  VALUES
    -- Leadership & Management (5)
    ('Strategic Thinking', 'Define long-term direction, anticipate trends, and align teams to vision.', 'Leadership & Management'),
    ('People Management', 'Hire, develop, and retain talent while fostering accountability and engagement.', 'Leadership & Management'),
    ('Coaching & Mentoring', 'Enable growth through actionable feedback, guidance, and role modeling.', 'Leadership & Management'),
    ('Delegation', 'Assign clear ownership with context, autonomy, and support.', 'Leadership & Management'),
    ('Change Management', 'Lead teams through change with clarity, sequencing, and communication.', 'Leadership & Management'),

    -- Communication (5)
    ('Written Communication', 'Write clear, concise, audience-appropriate content and documentation.', 'Communication'),
    ('Verbal Communication', 'Communicate clearly in meetings, 1:1s, and informal settings.', 'Communication'),
    ('Presentation Skills', 'Craft structured narratives and present with clarity and confidence.', 'Communication'),
    ('Active Listening', 'Listen to understand, reflect, and clarify before responding.', 'Communication'),
    ('Stakeholder Communication', 'Adapt message and expectations for executives, peers, and partners.', 'Communication'),

    -- Technical/Functional (5)
    ('Data Analysis', 'Interpret data to generate insights and inform decisions.', 'Technical/Functional'),
    ('Domain Expertise', 'Demonstrate deep understanding of the domain and its best practices.', 'Technical/Functional'),
    ('Tool Proficiency', 'Use core tools efficiently and select the right tool for the job.', 'Technical/Functional'),
    ('Quality Assurance', 'Prevent defects with reviews, testing, and continuous improvement.', 'Technical/Functional'),
    ('Documentation', 'Create maintainable, discoverable, and up-to-date documentation.', 'Technical/Functional'),

    -- Interpersonal (5)
    ('Collaboration', 'Work cross-functionally, share context, and co-create outcomes.', 'Interpersonal'),
    ('Empathy', 'Understand perspectives and tailor approach to individual needs.', 'Interpersonal'),
    ('Conflict Resolution', 'Address tensions early and drive toward constructive outcomes.', 'Interpersonal'),
    ('Influencing', 'Drive alignment without authority through trust and reasoning.', 'Interpersonal'),
    ('Cross-functional Partnership', 'Build strong relationships with adjacent teams to accelerate outcomes.', 'Interpersonal'),

    -- Execution (6)
    ('Prioritization', 'Focus on the highest-impact work and sequence effectively.', 'Execution'),
    ('Project Management', 'Plan, track, and deliver predictable outcomes on schedule.', 'Execution'),
    ('Problem Solving', 'Frame problems, evaluate options, and drive to decisions.', 'Execution'),
    ('Decision Making', 'Decide with clarity, tradeoffs, and accountability.', 'Execution'),
    ('Time Management', 'Manage time and energy to meet commitments reliably.', 'Execution'),
    ('Process Improvement', 'Continuously refine processes to reduce waste and risk.', 'Execution')
)
INSERT INTO public.capabilities (name, description, category)
SELECT s.name, s.description, s.category
FROM seeds s
LEFT JOIN public.capabilities c ON c.name = s.name
WHERE c.name IS NULL;