import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { WelcomeStep } from "./onboarding/WelcomeStep";
import { CapabilityPicker } from "./onboarding/CapabilityPicker";
import { QuickGoalInput } from "./onboarding/QuickGoalInput";
import { PodcastGenerating } from "./onboarding/PodcastGenerating";
import { PodcastReady } from "./onboarding/PodcastReady";

interface Capability {
  id: string;
  name: string;
  description: string;
  category: string;
}

type WizardStep = 'welcome' | 'capabilities' | 'goal' | 'generating' | 'ready';

interface OnboardingWizardProps {
  onComplete: () => void;
  onOpenPlayer?: () => void;
  forceOpenKey?: number;
}

export function OnboardingWizard({ onComplete, onOpenPlayer, forceOpenKey }: OnboardingWizardProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<WizardStep>('welcome');
  const [userName, setUserName] = useState('');
  const [profileId, setProfileId] = useState('');
  const [companyId, setCompanyId] = useState('');
  const [selectedCapabilities, setSelectedCapabilities] = useState<Capability[]>([]);
  const [goal, setGoal] = useState('');
  const { toast } = useToast();

  const dismissKey = "onboarding_wizard_dismissed";

  useEffect(() => {
    checkIfShouldShow();
  }, []);

  useEffect(() => {
    if (typeof forceOpenKey !== 'number') return;
    // Allow re-opening even if dismissed in this session
    sessionStorage.removeItem(dismissKey);
    openWizardManually();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceOpenKey]);

  const openWizardManually = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company_id')
        .eq('id', user.id)
        .maybeSingle();

      if (!profile) return;

      const firstName = profile.full_name?.split(' ')[0] || '';
      setUserName(firstName);
      setProfileId(profile.id);
      setCompanyId(profile.company_id);

      // Reset wizard state for a clean run
      setSelectedCapabilities([]);
      setGoal('');
      setStep('welcome');
      setOpen(true);
    } catch (error) {
      console.error('Error opening onboarding wizard manually:', error);
    }
  };

  const checkIfShouldShow = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if dismissed this session
      const dismissed = sessionStorage.getItem(dismissKey);
      if (dismissed) return;

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, full_name, company_id')
        .eq('id', user.id)
        .maybeSingle();

      // If no profile exists yet (new signup flow), don't show wizard yet
      if (!profile) return;

      // Call refresh_user_completeness to update scores
      await supabase.rpc('refresh_user_completeness', {
        user_id: user.id
      });

      // Fetch the updated completeness data
      const { data: completenessData } = await supabase
        .from('user_data_completeness')
        .select('onboarding_score')
        .eq('profile_id', user.id)
        .maybeSingle();

      const onboardingScore = completenessData?.onboarding_score || 0;
      console.log('OnboardingWizard: score =', onboardingScore, 'for user', user.id);

      // Only show for new users (low onboarding score)
      if (onboardingScore >= 50) return;

      // Check if user already has any podcast episode
      const { data: existingEpisode } = await supabase
        .from('podcast_episodes')
        .select('id')
        .eq('profile_id', profile.id)
        .limit(1);

      // If they have any podcast episode, don't show wizard
      if (existingEpisode && existingEpisode.length > 0) return;

      // Extract first name from full_name
      const firstName = profile.full_name?.split(' ')[0] || '';
      setUserName(firstName);
      setProfileId(profile.id);
      setCompanyId(profile.company_id);

      // Small delay for smoother UX
      setTimeout(() => setOpen(true), 500);
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem(dismissKey, "true");
    setOpen(false);
    onComplete();
  };

  const handleCapabilitiesComplete = (caps: Capability[]) => {
    setSelectedCapabilities(caps);
    setStep('goal');
  };

  const handleGoalComplete = async (userGoal: string) => {
    setGoal(userGoal);
    setStep('generating');
    await generateWelcomePodcast(userGoal);
  };

  const generateWelcomePodcast = async (userGoal: string) => {
    try {
      const today = format(new Date(), 'yyyy-MM-dd');

      // Generate the welcome podcast
      const { data: scriptResult, error: scriptError } = await supabase.functions.invoke('generate-welcome-podcast', {
        body: {
          profileId,
          companyId,
          userName,
          selectedCapabilities: selectedCapabilities.map(c => c.name),
          personalGoal: userGoal
        }
      });

      if (scriptError) {
        console.error('generate-welcome-podcast invoke error:', scriptError);
        throw scriptError;
      }

      if (!scriptResult?.success) {
        console.error('generate-welcome-podcast returned failure:', scriptResult);
        throw new Error(scriptResult?.error || 'Failed to generate welcome podcast');
      }

      // Generate music in parallel with TTS if needed
      const [ttsResult, introResult, outroResult] = await Promise.all([
        supabase.functions.invoke('elevenlabs-tts', {
          body: {
            script: scriptResult.script,
            profileId,
            episodeDate: today,
            voice: 'jericho',
            storeAudio: true
          }
        }),
        supabase.functions.invoke('generate-podcast-music', {
          body: { type: 'intro' }
        }),
        supabase.functions.invoke('generate-podcast-music', {
          body: { type: 'outro' }
        })
      ]);

      if (ttsResult.error) {
        console.error('elevenlabs-tts invoke error:', ttsResult.error);
        throw ttsResult.error;
      }

      if (!ttsResult.data?.success) {
        console.error('elevenlabs-tts returned failure:', ttsResult.data);
        throw new Error(ttsResult.data?.error || 'Failed to generate audio');
      }

      // Save episode to database
      const { error: insertError } = await supabase
        .from('podcast_episodes')
        .upsert(
          {
            profile_id: profileId,
            company_id: companyId,
            episode_date: today,
            title: scriptResult.title || "Your Welcome Episode",
            script: scriptResult.script,
            audio_url: ttsResult.data.audioUrl,
            intro_music_url: introResult.data?.audioUrl || null,
            outro_music_url: outroResult.data?.audioUrl || null,
            duration_seconds: ttsResult.data.durationSeconds,
            content_type: 'welcome',
            topics_covered: selectedCapabilities.map(c => c.name),
            daily_challenge: scriptResult.dailyChallenge || null,
          },
          { onConflict: 'profile_id,episode_date' }
        );

      if (insertError) throw insertError;

      // Save the user's goal to ninety_day_targets
      if (userGoal) {
        const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
        const currentYear = new Date().getFullYear();
        
        await supabase
          .from('ninety_day_targets')
          .insert([{
            profile_id: profileId,
            company_id: companyId,
            goal_text: userGoal,
            category: 'primary',
            goal_number: 1,
            quarter: String(currentQuarter),
            year: currentYear,
          }]);
      }

      setStep('ready');

      toast({
        title: "Your welcome episode is ready! 🎧",
        description: "Press play to start your growth journey.",
      });
    } catch (error: unknown) {
      console.error('Error generating welcome podcast:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast({
        title: "Generation failed",
        description: errorMessage,
        variant: "destructive"
      });
      // Go back to goal step so user can retry
      setStep('goal');
    }
  };

  const handlePlay = () => {
    sessionStorage.setItem(dismissKey, "true");
    setOpen(false);
    onComplete();
    onOpenPlayer?.();
  };

  const handleContinue = () => {
    sessionStorage.setItem(dismissKey, "true");
    setOpen(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleDismiss()}>
      <DialogContent className="sm:max-w-lg p-6 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            {step === 'welcome' && (
              <WelcomeStep
                userName={userName}
                onContinue={() => setStep('capabilities')}
                onSkip={handleDismiss}
              />
            )}

            {step === 'capabilities' && (
              <CapabilityPicker
                onComplete={handleCapabilitiesComplete}
                onBack={() => setStep('welcome')}
              />
            )}

            {step === 'goal' && (
              <QuickGoalInput
                onComplete={handleGoalComplete}
                onBack={() => setStep('capabilities')}
                selectedCapabilities={selectedCapabilities}
              />
            )}

            {step === 'generating' && (
              <PodcastGenerating userName={userName} />
            )}

            {step === 'ready' && (
              <PodcastReady
                onPlay={handlePlay}
                onContinue={handleContinue}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
