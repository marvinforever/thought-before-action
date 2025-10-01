-- Insert the new Agronomy Sales Excellence capability
INSERT INTO public.capabilities (name, description, category, level)
VALUES (
  'Agronomy Sales Excellence',
  'The ability to effectively sell agronomy products and services by understanding customer needs, building relationships, and demonstrating value.',
  'Agribusiness Professionals',
  'beginner'
);

-- Get the capability_id for inserting levels
DO $$
DECLARE
  v_capability_id uuid;
BEGIN
  SELECT id INTO v_capability_id
  FROM public.capabilities
  WHERE name = 'Agronomy Sales Excellence'
  LIMIT 1;

  -- Insert the 4 capability levels
  INSERT INTO public.capability_levels (capability_id, level, description) VALUES
  (
    v_capability_id,
    'foundational',
    'At the Foundational level, individuals are beginning to understand the basics of agronomy sales. They learn about common crops, basic soil science, and introductory pest management. They start to develop fundamental communication skills and learn how to identify customer needs through basic questioning techniques. At this stage, they shadow experienced sales professionals and participate in structured training programs to build their knowledge base.'
  ),
  (
    v_capability_id,
    'advancing',
    'At the Advancing level, individuals have a solid understanding of agronomy principles and can apply this knowledge in sales conversations. They can conduct thorough needs assessments, recommend appropriate products and services, and handle common objections. They begin to build their own customer base and demonstrate consistent sales performance. They understand crop rotation, soil testing interpretation, and integrated pest management strategies well enough to discuss them confidently with customers.'
  ),
  (
    v_capability_id,
    'independent',
    'At the Independent level, individuals excel at consultative selling and are recognized as trusted advisors by their customers. They can design comprehensive agronomic programs tailored to specific farm operations, considering factors like soil types, weather patterns, economic conditions, and sustainability goals. They effectively manage a diverse portfolio of customers, consistently exceed sales targets, and mentor less experienced team members. They stay current with industry trends, new products, and emerging technologies.'
  ),
  (
    v_capability_id,
    'mastery',
    'At the Mastery level, individuals are industry leaders who drive innovation in agronomy sales. They develop strategic partnerships with key customers, influence product development based on market insights, and contribute to the broader agricultural community through speaking engagements, research collaboration, or industry associations. They demonstrate exceptional business acumen, understanding not just agronomy but also farm economics, supply chain dynamics, and market forces. They shape sales strategies for their organization and develop the next generation of agronomy sales professionals.'
  );
END $$;