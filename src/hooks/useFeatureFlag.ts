import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useFeatureFlag(flagName: string) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkFeatureFlag = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsEnabled(false);
          setLoading(false);
          return;
        }

        // Get user's company
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.id)
          .single();

        if (!profile?.company_id) {
          setIsEnabled(false);
          setLoading(false);
          return;
        }

        // Get the global feature flag
        const { data: globalFlag } = await supabase
          .from('feature_flags')
          .select('id, is_enabled')
          .eq('flag_name', flagName)
          .single();

        if (!globalFlag) {
          setIsEnabled(false);
          setLoading(false);
          return;
        }

        // Check for company-specific override
        const { data: companyFlag } = await supabase
          .from('company_feature_flags')
          .select('is_enabled')
          .eq('flag_id', globalFlag.id)
          .eq('company_id', profile.company_id)
          .single();

        // Company override takes precedence, otherwise use global
        if (companyFlag) {
          setIsEnabled(companyFlag.is_enabled);
        } else {
          setIsEnabled(globalFlag.is_enabled);
        }
      } catch (error) {
        console.error('Error checking feature flag:', error);
        setIsEnabled(false);
      } finally {
        setLoading(false);
      }
    };

    checkFeatureFlag();
  }, [flagName]);

  return { isEnabled, loading };
}
