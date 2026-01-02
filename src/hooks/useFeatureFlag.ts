import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useFeatureFlag(flagName: string) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkFeatureFlag = async (userId: string) => {
      try {
        // Get user's company
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', userId)
          .single();

        if (!isMounted) return;

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

        if (!isMounted) return;

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

        if (!isMounted) return;

        // Company override takes precedence, otherwise use global
        if (companyFlag) {
          setIsEnabled(companyFlag.is_enabled);
        } else {
          setIsEnabled(globalFlag.is_enabled);
        }
      } catch (error) {
        console.error('Error checking feature flag:', error);
        if (isMounted) setIsEnabled(false);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setLoading(true);
        checkFeatureFlag(session.user.id);
      } else {
        setIsEnabled(false);
        setLoading(false);
      }
    });

    // Initial check
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        checkFeatureFlag(user.id);
      } else {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [flagName]);

  return { isEnabled, loading };
}
