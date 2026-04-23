import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { getUserProfile, updateUserProfile } from '../auth/firestoreUtils';

const TutorialContext = createContext({});

export const useTutorial = () => {
  return useContext(TutorialContext);
};

export const TutorialProvider = ({ children }) => {
  const { currentUser } = useAuth();
  
  const [isActive, setIsActive] = useState(false);
  const [currentTour, setCurrentTour] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [completedTours, setCompletedTours] = useState([]);
  const [showTutorialOnStartup, setShowTutorialOnStartup] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadTutorialStatus = async () => {
      if (!currentUser) {
        setIsLoading(false);
        return;
      }

      try {
        const profile = await getUserProfile(currentUser.uid);
        if (profile) {
          setCompletedTours(profile.completedTours || []);
          setShowTutorialOnStartup(profile.showTutorialOnStartup !== false);
        }
      } catch (error) {
        console.error('Error loading tutorial status:', error);
        const saved = localStorage.getItem('signtify_tutorial_status');
        if (saved) {
          const parsed = JSON.parse(saved);
          setCompletedTours(parsed.completedTours || []);
          setShowTutorialOnStartup(parsed.showTutorialOnStartup !== false);
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadTutorialStatus();
  }, [currentUser]);

  useEffect(() => {
    const status = {
      completedTours,
      showTutorialOnStartup,
      lastUpdated: new Date().toISOString()
    };
    localStorage.setItem('signtify_tutorial_status', JSON.stringify(status));
  }, [completedTours, showTutorialOnStartup]);

  const markTourCompleted = useCallback(async (tourId) => {
    if (!tourId || completedTours.includes(tourId)) return;

    const newCompletedTours = [...completedTours, tourId];
    setCompletedTours(newCompletedTours);

    if (currentUser) {
      try {
        await updateUserProfile(currentUser.uid, {
          completedTours: newCompletedTours,
          tutorialCompleted: newCompletedTours.includes('main')
        });
      } catch (error) {
        console.error('Error saving tutorial completion:', error);
      }
    }
  }, [completedTours, currentUser]);

  const startTour = useCallback((tourId, startStep = 0) => {
    if (!tourId) return;
    
    setCurrentTour(tourId);
    setCurrentStep(startStep);
    setIsActive(true);
    
    document.body.style.overflow = 'hidden';
    
    console.log(`[Tutorial] Started tour: ${tourId} at step ${startStep}`);
  }, []);

  const endTour = useCallback((saveCompletion = true) => {
    if (saveCompletion && currentTour) {
      markTourCompleted(currentTour);
    }
    
    setIsActive(false);
    setCurrentTour(null);
    setCurrentStep(0);
    
    document.body.style.overflow = '';
    
    console.log(`[Tutorial] Ended tour: ${currentTour}`);
  }, [currentTour, markTourCompleted]);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => prev + 1);
  }, []);

  const prevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  }, []);

  const goToStep = useCallback((stepIndex) => {
    setCurrentStep(Math.max(0, stepIndex));
  }, []);

  const skipTour = useCallback(() => {
    endTour(false);
  }, [endTour]);

  const isTourCompleted = useCallback((tourId) => {
    return completedTours.includes(tourId);
  }, [completedTours]);

  const setShowOnStartup = useCallback(async (show) => {
    setShowTutorialOnStartup(show);
    
    if (currentUser) {
      try {
        await updateUserProfile(currentUser.uid, {
          showTutorialOnStartup: show
        });
      } catch (error) {
        console.error('Error saving tutorial preference:', error);
      }
    }
  }, [currentUser]);

  const resetAllTutorials = useCallback(async () => {
    setCompletedTours([]);
    setShowTutorialOnStartup(true);
    
    if (currentUser) {
      try {
        await updateUserProfile(currentUser.uid, {
          completedTours: [],
          tutorialCompleted: false,
          showTutorialOnStartup: true
        });
      } catch (error) {
        console.error('Error resetting tutorials:', error);
      }
    }
    
    localStorage.removeItem('signtify_tutorial_status');
    console.log('[Tutorial] All tutorials reset');
  }, [currentUser]);

  const startMainTourIfFirstTime = useCallback(() => {
    if (!isLoading && showTutorialOnStartup && !isTourCompleted('main')) {
      setTimeout(() => {
        startTour('main');
      }, 1000);
    }
  }, [isLoading, showTutorialOnStartup, isTourCompleted, startTour]);

  const value = {
    isActive,
    currentTour,
    currentStep,
    completedTours,
    showTutorialOnStartup,
    isLoading,
    startTour,
    endTour,
    nextStep,
    prevStep,
    goToStep,
    skipTour,
    markTourCompleted,
    isTourCompleted,
    setShowOnStartup,
    resetAllTutorials,
    startMainTourIfFirstTime
  };

  return (
    <TutorialContext.Provider value={value}>
      {children}
    </TutorialContext.Provider>
  );
};

export default TutorialContext;
