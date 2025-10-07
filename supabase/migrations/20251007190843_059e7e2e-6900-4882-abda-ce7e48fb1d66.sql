-- Update UK spelling to US spelling for Organisational category
UPDATE capabilities
SET category = 'Organizational'
WHERE category = 'Organisational';