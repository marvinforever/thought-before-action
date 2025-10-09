import { supabase } from "@/integrations/supabase/client";

export const createWinfieldEmployees = async () => {
  const employees = [
    { email: 'mhenderson@landolakes.com', full_name: 'Matt Henderson', role: 'Account Manager', phone: '731-413-7252' },
    { email: 'mswilson@landolakes.com', full_name: 'Shane Wilson', role: 'Account Manager', phone: '479-236-7477' },
    { email: 'rmtrudel@landolakes.com', full_name: 'Bob Trudel', role: 'Account Manager', phone: '2088701191' },
    { email: 'ldighans@landolakes.com', full_name: 'Luke Dighans', role: 'Account Manager', phone: '4067838549' },
    { email: 'mgadams@landolakes.com', full_name: 'Mitchel Adams', role: 'Account Manager', phone: '620-242-7827' },
    { email: 'ecchapman@landolakes.com', full_name: 'Eric Chapman', role: 'Account Manager', phone: '2198192134' },
    { email: 'mbrowning@landolakes.com', full_name: 'Michael Browning', role: 'Account Manager', phone: '2172408411' },
    { email: 'jkyllo@landolakes.com', full_name: 'Jeff Kyllo', role: 'Account Manager', phone: '7012135751' },
    { email: 'kjkarlstad@landolakes.com', full_name: 'Kasey Karlstad', role: 'Account Manager', phone: '7014300183' },
    { email: 'gbkrueger@landolakes.com', full_name: 'Garrett Krueger', role: 'Account Manager', phone: '701-898-0146' },
    { email: 'madybedahl@landolakes.com', full_name: 'Matt Dybedahl', role: 'Account Manager', phone: '605-310-2032' },
    { email: 'jdwoods@landolakes.com', full_name: 'Jonathan Woods', role: 'Account Manager', phone: '7015210153' },
    { email: 'empuckett@landolakes.com', full_name: 'Eric Puckett', role: 'Account Manager', phone: '8165918085' },
    { email: 'lgstolz@landolakes.com', full_name: 'Larry Stolz', role: 'Account Manager', phone: '402-580-7048' },
    { email: 'jdickman@landolakes.com', full_name: 'Julie Dickman', role: 'Account Manager', phone: '7856733325' },
    { email: 'jpfeffer@landolakes.com', full_name: 'Jodie Pfeffer', role: 'Administrative Assistant', phone: '651-336-0918' },
    { email: 'agutierrez@landolakes.com', full_name: 'Tres Gutierrez', role: 'Execution Lead', phone: '6207553268' },
    { email: 'kschobert@landolakes.com', full_name: 'Kris Schobert', role: 'Retail Alliance Execution Lead', phone: '605.212.2573' },
  ];

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.functions.invoke('batch-create-employees', {
    body: {
      employees,
      company_id: 'c10502b9-1892-4890-a7f6-218c370041f2', // Winfield United
    },
  });

  if (error) {
    throw error;
  }

  return data;
};
