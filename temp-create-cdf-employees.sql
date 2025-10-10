-- Step 1: Call the batch-create-employees edge function via Supabase client
-- This needs to be done through the application, not SQL
-- The employee data is in import_cdf_employees.json

-- Step 2: After employees are created, insert diagnostic responses
-- This SQL assumes the employees have been created and profile_ids exist

-- Mapping guide:
-- Workload: "Somewhat manageable" -> 'manageable', "Very manageable" -> 'very_manageable'
-- Learning: "Online courses" -> 'visual', "Reading" -> 'reading', "In-person training" -> 'hands_on', "Other" -> 'mixed'

-- Tristan Florey
INSERT INTO diagnostic_responses (
  company_id, profile_id, role_clarity_score, has_written_job_description,
  most_important_job_aspect, confidence_score, natural_strength, biggest_difficulty,
  skill_to_master, workload_status, burnout_frequency,
  learning_preference, weekly_development_hours, learning_motivation,
  needed_training, growth_barrier, listens_to_podcasts, watches_youtube,
  reads_books_articles, sees_growth_path, feels_valued,
  would_stay_if_offered_similar, retention_improvement_suggestion,
  sees_leadership_path, three_year_goal, company_supporting_goal, biggest_work_obstacle,
  biggest_frustration, why_people_leave_opinion, what_enjoy_most,
  leadership_should_understand, recent_accomplishment, recent_challenge,
  needed_training_for_effectiveness, twelve_month_growth_goal,
  support_needed_from_leadership, one_year_vision, typeform_response_id,
  typeform_start_date, typeform_submit_date, submitted_at,
  mental_drain_frequency, focus_quality, work_life_sacrifice_frequency,
  energy_drain_area, daily_energy_level, manager_support_quality
) 
SELECT 
  '971e5580-4c3f-4645-b25d-74d92ba7083a'::uuid, p.id, 9, false,
  'Growing the business and team building with my employees to make a more efficient and happy work place environment',
  7, 'One on one talks with my customers. Problem solving', 'Employee management at times.',
  'Being a better leader.', 'manageable', 'Occasionally (monthly)',
  'visual', 2, 'Skill improvement', 'Time management. Team leading.',
  'Health.', true, false, true, true, true, 10,
  'The company itself is doing a great job. Honestly I feel there is nothing they need to do to keep me long term.',
  true, 'To become a better manager and salesman.', true, 'My own self.',
  'Unsure at this time.', 'Burned out.', 'The people, and the challenges',
  'I think my leaders understand my experience very well.',
  'The growth of the business as a whole.',
  'Influx of customers having more issues this year than previous years.',
  'Being a better leader', 'Health and leadership',
  'My leaders are doing a great job. The Momentum company is one of the resources they provided me with.',
  'Lost weight, became a better leader, grew the business.',
  'b4uwqapqba2cb4uiscvx1mv9vxbhiscc', '2025-10-08 13:53:23'::timestamptz,
  '2025-10-08 14:26:18'::timestamptz, now(),
  'Sometimes', 'Very well', 'Sometimes',
  'Mainly it''s during the busy times of the year. If I feel we are falling behind I will stay at work and try to get as much done in a day as possible.',
  7, 'Excellent'
FROM profiles p
WHERE LOWER(p.email) = 'tfloreydfc@bektel.com' AND p.company_id = '971e5580-4c3f-4645-b25d-74d92ba7083a'::uuid;

-- Cordell Schmitz
INSERT INTO diagnostic_responses (
  company_id, profile_id, role_clarity_score, has_written_job_description,
  most_important_job_aspect, confidence_score, natural_strength, biggest_difficulty,
  skill_to_master, workload_status, burnout_frequency,
  learning_preference, weekly_development_hours, learning_motivation,
  needed_training, growth_barrier, listens_to_podcasts, watches_youtube,
  reads_books_articles, sees_growth_path, feels_valued,
  would_stay_if_offered_similar, retention_improvement_suggestion,
  sees_leadership_path, three_year_goal, company_supporting_goal,
  biggest_frustration, why_people_leave_opinion, what_enjoy_most,
  leadership_should_understand, recent_accomplishment, recent_challenge,
  needed_training_for_effectiveness, twelve_month_growth_goal,
  support_needed_from_leadership, one_year_vision, typeform_response_id,
  typeform_start_date, typeform_submit_date, submitted_at,
  mental_drain_frequency, focus_quality, work_life_sacrifice_frequency,
  energy_drain_area, daily_energy_level, manager_support_quality
) 
SELECT 
  '971e5580-4c3f-4645-b25d-74d92ba7083a'::uuid, p.id, 7, false,
  'Helping grow the business by assisting the managers to be more efficient, confident and effective. Also to help take things off my boss''s plate to allow him to more effectively manage the company and look at bigger opportunities.',
  8, 'Consulting with other peers and figuring out efficient ways to make their job/life easier.',
  'Learning the expectations of the role, without stepping over the line of what I was expected to do',
  'Efficiency/time management', 'manageable', 'Rarely (less than monthly)',
  'reading', 2, 'Skill improvement',
  'Time management', 'Clarity on the professional side', false, false, true, true, true, 10, 'They have', true,
  'Continue to grow effectively into the new role and expand my capabilities for the company',
  true, 'Clarify or defined expectations and goals',
  'Previously I believe it was due to staffing limitations',
  'Excellent culture, treated like a person instead of a number, growth mindset',
  'Think they have done well here', 'Expanded role',
  'Helping staff transition into their new roles or having new leadership',
  'Role transition, and how to provide clarity to staff on our expectations of them',
  'To build the relationships with peers that I worked beside and am now their "boss". To have the relationship good enough they''ll still communicate and be open with me.',
  'Clarity', 'Grown into a great father and husband, while expanding my capabilities for the company',
  'mf1e6eq5f2h8buibvc49mf1e6e3ykany', '2025-10-08 13:14:09'::timestamptz,
  '2025-10-08 14:04:56'::timestamptz, now(),
  'Sometimes', 'Moderately well', 'Sometimes',
  'Personnel management', 10, 'Excellent'
FROM profiles p
WHERE LOWER(p.email) = 'cschmitzdfc@bektel.com' AND p.company_id = '971e5580-4c3f-4645-b25d-74d92ba7083a'::uuid;

-- Aaron Pepple
INSERT INTO diagnostic_responses (
  company_id, profile_id, role_clarity_score, has_written_job_description,
  most_important_job_aspect, confidence_score, natural_strength, biggest_difficulty,
  skill_to_master, workload_status, burnout_frequency,
  learning_preference, weekly_development_hours, learning_motivation,
  needed_training, growth_barrier, listens_to_podcasts, watches_youtube,
  reads_books_articles, sees_growth_path, feels_valued,
  would_stay_if_offered_similar, retention_improvement_suggestion,
  sees_leadership_path, three_year_goal, company_supporting_goal, biggest_work_obstacle,
  biggest_frustration, why_people_leave_opinion, what_enjoy_most,
  leadership_should_understand, recent_accomplishment, recent_challenge,
  needed_training_for_effectiveness, twelve_month_growth_goal,
  support_needed_from_leadership, one_year_vision, typeform_response_id,
  typeform_start_date, typeform_submit_date, submitted_at,
  mental_drain_frequency, focus_quality, work_life_sacrifice_frequency,
  energy_drain_area, daily_energy_level, manager_support_quality
) 
SELECT 
  '971e5580-4c3f-4645-b25d-74d92ba7083a'::uuid, p.id, 10, true,
  'Leading the people on my team to help reach my goals', 9,
  'Talking to customers', 'Dealing with employees', 'Being a better leader',
  'manageable', 'Frequently (weekly)',
  'mixed', 2, 'Personal interest', 'Patience', 'Available time', true, true, true,
  true, true, 10, 'Find more help', true,
  'I want to be the largest location within dfc', true,
  'Being understaffed and not being able to spend time doing the things I should be doing',
  'My biggest frustration is not having enough help', 'The hours and schedule',
  'I love everything about agriculture and I enjoy helping my customers raise a crop and be successful',
  'I feel like they understand my experience very well but I would say just how overwhelming are days are with lack of help',
  'My sales numbers', 'Lack of help, experienced help, or help that wants to be there and better themselves',
  'For me it would being able to be more patient and how to lead my team better',
  'I would like to implement some of the things I learned in the in-person training event and become a better leader.',
  'I feel I have the resources and support I just need to take the time to work on the things I need to',
  'Professionally I would like to grow my business and personally learning to take the time to enjoy life',
  'jltonuwk7wrck9ysv4jltonm5m62fx61', '2025-10-08 02:09:41'::timestamptz,
  '2025-10-08 02:30:02'::timestamptz, now(),
  'Always', 'Very well', 'Often',
  'Employees', 8, 'Good'
FROM profiles p
WHERE LOWER(p.email) = 'apeppledfc@bektel.com' AND p.company_id = '971e5580-4c3f-4645-b25d-74d92ba7083a'::uuid;

-- Travis Stanton
INSERT INTO diagnostic_responses (
  company_id, profile_id, role_clarity_score, has_written_job_description,
  most_important_job_aspect, confidence_score, natural_strength, biggest_difficulty,
  skill_to_master, workload_status, burnout_frequency,
  learning_preference, weekly_development_hours, learning_motivation,
  needed_training, growth_barrier, listens_to_podcasts, watches_youtube,
  reads_books_articles, sees_growth_path, feels_valued,
  would_stay_if_offered_similar, retention_improvement_suggestion,
  sees_leadership_path, three_year_goal, company_supporting_goal, biggest_work_obstacle,
  biggest_frustration, why_people_leave_opinion, what_enjoy_most,
  leadership_should_understand, recent_accomplishment, recent_challenge,
  needed_training_for_effectiveness, twelve_month_growth_goal,
  support_needed_from_leadership, one_year_vision, typeform_response_id,
  typeform_start_date, typeform_submit_date, submitted_at,
  mental_drain_frequency, focus_quality, work_life_sacrifice_frequency,
  energy_drain_area, daily_energy_level, manager_support_quality
) 
SELECT 
  '971e5580-4c3f-4645-b25d-74d92ba7083a'::uuid, p.id, 10, true,
  'Managing and growing our business while keeping the customers best interests in mind.',
  8, 'Agronomic advice', 'Keeping track of the some of the numbers in the business',
  'Managing people and keeping the business growing', 'very_manageable', 'Occasionally (monthly)',
  'hands_on', 2, 'Skill improvement',
  'time management for myself and employees', 'Time of year and my own distractions',
  true, true, true, true, true, 10, 'NA', true,
  'Grow the business by 3 million dollars', true, 'Time management is',
  'things that are out of my control', 'career advancement', 'the culture',
  'I am capable of certain tasks and would like to handle them',
  'growing the business and meeting goals i set for myself', 'weather and prices',
  'not sure', 'keeping a healthy work life balance', 'help training young staff',
  'id have been a more engaged husband and still managed to grow the business',
  'o93i8ye22mzgex3mo93i89xfcfutl0ww', '2025-10-07 17:40:15'::timestamptz,
  '2025-10-07 17:52:36'::timestamptz, now(),
  'Sometimes', 'Moderately well', 'Sometimes',
  'Keeping the employees productive and occupied', 8, 'Good'
FROM profiles p
WHERE LOWER(p.email) = 'tstantondfc@bektel.com' AND p.company_id = '971e5580-4c3f-4645-b25d-74d92ba7083a'::uuid;

-- Andrew Kreidt
INSERT INTO diagnostic_responses (
  company_id, profile_id, role_clarity_score, has_written_job_description,
  most_important_job_aspect, confidence_score, natural_strength, biggest_difficulty,
  skill_to_master, workload_status, burnout_frequency,
  learning_preference, weekly_development_hours, learning_motivation,
  needed_training, growth_barrier, listens_to_podcasts, watches_youtube,
  reads_books_articles, sees_growth_path, feels_valued,
  would_stay_if_offered_similar, retention_improvement_suggestion,
  sees_leadership_path, three_year_goal, company_supporting_goal, biggest_work_obstacle,
  biggest_frustration, why_people_leave_opinion, what_enjoy_most,
  leadership_should_understand, recent_accomplishment, recent_challenge,
  needed_training_for_effectiveness, twelve_month_growth_goal,
  support_needed_from_leadership, one_year_vision, typeform_response_id,
  typeform_start_date, typeform_submit_date, submitted_at,
  mental_drain_frequency, focus_quality, work_life_sacrifice_frequency,
  energy_drain_area, daily_energy_level, manager_support_quality
) 
SELECT 
  '971e5580-4c3f-4645-b25d-74d92ba7083a'::uuid, p.id, 7, false,
  'Maintaining the day to day operations of my location. Making sure we deliver on our promises to our customers',
  7, 'Working with and fixing equipment',
  'Making sure everyone is working on a task. Keeping a list of tasks that need to be done ready to assign to employees',
  'People Management', 'very_manageable', 'Occasionally (monthly)',
  'mixed', 2, 'Personal interest',
  'skills to better manage my team', 'not being intentional and sticking with it',
  true, true, false, true, true, 10,
  'At the moment just continue to keep focusing on people and making us feel appreciated and valued',
  true, 'Increasing our seed sales by $500,000', true, 'Doubting myself',
  'Hard to deal with customers', 'Don''t like or can''t handle the seasonal work hours.',
  'Seeing where we can take this company. The flexibility we have in the off season. Sales rewards. The people we get to work with',
  'Juggling the work/life balance',
  'Making it through the spring season with minimal issues. Just about making seed budget. Total sales being above what we budgeted',
  'Keeping my team on task and working with them to do the best we can',
  'Employee Mangement', 'Being a better manager', 'Extra training',
  'Gaining new customers for the business. Having energy left at the end of the day to complete tasks at home',
  'j6tx0jqx3xero66qvj6txfzprs8x987x', '2025-10-07 16:44:31'::timestamptz,
  '2025-10-07 17:13:44'::timestamptz, now(),
  'Sometimes', 'Poorly', 'Sometimes',
  'keeping everyone busy and sales calls', 8, 'Good'
FROM profiles p
WHERE LOWER(p.email) = 'andrewkreidt@gmail.com' AND p.company_id = '971e5580-4c3f-4645-b25d-74d92ba7083a'::uuid;
