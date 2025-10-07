-- Move employees to correct companies

-- Move Bill Beukema, Brady Hess, Mike Jensen, Michael Ruggles, Stephanie Davis to Stateline Cooperative
UPDATE profiles 
SET company_id = 'd32f9a18-aba5-4836-aa66-1834b8cb8edd'
WHERE id IN (
  'f0c4b8fa-4ee6-424d-93b8-57e1a12bb455', -- Bill Beukema
  'e8248f66-7caa-4ed1-81e9-8bdc99d6e314', -- Brady Hess
  '05afe8b4-d5ad-4180-a973-b26dd6487d0d', -- Mike Jensen
  '71fbd8c6-379d-40b3-90f9-2410d8e6b33b', -- Michael Ruggles
  '387fc656-e365-4baf-816e-0bc6b400710e'  -- Stephanie Davis
);

-- Move Shawn VonDrehle & Jill Dooley to Logan Agri-Service
UPDATE profiles 
SET company_id = 'a89d5d2b-55df-40c8-9083-1aaeff5afff7'
WHERE id IN (
  '1ce37f97-f58d-4659-aa95-0bb92bbed94c', -- Shawn VonDrehle
  'cb36e582-0ea6-4e9e-93c7-047b45675223'  -- Jill Dooley
);