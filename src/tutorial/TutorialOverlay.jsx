import { useEffect, useState, useCallback, useRef } from 'react';
import { useTutorial } from './TutorialContext';
import { getTourSteps, getTourStepCount } from './tutorialSteps';

const TutorialOverlay = () => {
  const {
    isActive,
    currentTour,
    currentStep,
    nextStep,
    prevStep,
    endTour,
    skipTour,
    goToStep,
    completedTours
  } = useTutorial();

  const [targetElement, setTargetElement] = useState(null);
  const [targetRect, setTargetRect] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const overlayRef = useRef(null);

  const steps = getTourSteps(currentTour);
  const currentStepData = steps[currentStep];
  const totalSteps = getTourStepCount(currentTour);
  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  useEffect(() => {
    if (!isActive || !currentStepData) return;

    const findTarget = () => {
      let target = null;

      if (currentStepData.target) {
        target = document.querySelector(currentStepData.target);

        if (!target && currentStepData.fallbackTarget) {
          const fallbacks = currentStepData.fallbackTarget.split(',');
          for (const fallback of fallbacks) {
            target = document.querySelector(fallback.trim());
            if (target) break;
          }
        }
      }

      setTargetElement(target);

      if (target) {
        const rect = target.getBoundingClientRect();
        setTargetRect(rect);
        calculateTooltipPosition(rect, currentStepData.position);
      } else {
        setTargetRect(null);
        setTooltipPosition({
          top: window.innerHeight / 2,
          left: window.innerWidth / 2
        });
      }
    };

    findTarget();

    const handleResize = () => {
      findTarget();
    };

    const handleScroll = () => {
      if (targetElement) {
        const rect = targetElement.getBoundingClientRect();
        setTargetRect(rect);
        calculateTooltipPosition(rect, currentStepData.position);
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleScroll, true);

    const timer = setTimeout(() => setIsVisible(true), 100);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
      clearTimeout(timer);
    };
  }, [isActive, currentStepData, targetElement, currentStep]);

  const calculateTooltipPosition = (rect, position) => {
    const tooltipWidth = 360;
    const tooltipHeight = 200;
    const offset = 20;
    const viewportPadding = 20;

    let top, left;

    if (!rect || position === 'center') {
      setTooltipPosition({
        top: window.innerHeight / 2,
        left: window.innerWidth / 2
      });
      return;
    }

    switch (position) {
      case 'top':
        top = rect.top - tooltipHeight - offset;
        left = rect.left + rect.width / 2;
        if (top < viewportPadding) {
          top = rect.bottom + offset;
        }
        break;
      case 'bottom':
        top = rect.bottom + offset;
        left = rect.left + rect.width / 2;
        if (top + tooltipHeight > window.innerHeight - viewportPadding) {
          top = Math.min(rect.bottom + offset, window.innerHeight - tooltipHeight - viewportPadding);
          if (top < viewportPadding * 2) {
            top = window.innerHeight / 2;
            left = window.innerWidth / 2;
          }
        }
        break;
      case 'left':
        top = rect.top + rect.height / 2;
        left = rect.left - tooltipWidth - offset;
        if (left < viewportPadding) {
          left = rect.right + offset;
        }
        break;
      case 'right':
        top = rect.top + rect.height / 2;
        left = rect.right + offset;
        if (left + tooltipWidth > window.innerWidth - viewportPadding) {
          left = rect.left - tooltipWidth - offset;
        }
        break;
      default:
        top = window.innerHeight / 2;
        left = window.innerWidth / 2;
    }

    top = Math.max(viewportPadding, Math.min(top, window.innerHeight - tooltipHeight - viewportPadding));
    left = Math.max(viewportPadding, Math.min(left, window.innerWidth - tooltipWidth - viewportPadding));

    setTooltipPosition({ top, left });
  };

  const handleKeyDown = useCallback((e) => {
    if (!isActive) return;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        if (!isLastStep) nextStep();
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        if (!isFirstStep) prevStep();
        break;
      case 'Escape':
        e.preventDefault();
        skipTour();
        break;
      case 'Enter':
        if (isLastStep) {
          e.preventDefault();
          endTour();
        }
        break;
      default:
        break;
    }
  }, [isActive, isLastStep, isFirstStep, nextStep, prevStep, skipTour, endTour]);

  useEffect(() => {
    if (isActive) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isActive, handleKeyDown]);

  const handleNext = () => {
    if (currentStepData?.customNextAction) {
      endTour();
      if (currentStepData.customNextAction.startsWith('/')) {
        window.location.href = currentStepData.customNextAction;
      }
    } else if (isLastStep) {
      endTour();
    } else {
      nextStep();
    }
  };

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) {
      // skipTour();
    }
  };

  if (!isActive || !currentStepData) return null;

  const getSpotlightStyles = () => {
    if (!targetRect || currentStepData.position === 'center') {
      return {
        clipPath: 'none',
        backgroundColor: 'rgba(0, 0, 0, 0.7)'
      };
    }

    const padding = 8;
    const x = targetRect.left - padding;
    const y = targetRect.top - padding;
    const w = targetRect.width + padding * 2;
    const h = targetRect.height + padding * 2;

    return {
      clipPath: `polygon(
        0% 0%,
        100% 0%,
        100% 100%,
        0% 100%,
        0% 0%,
        ${x}px ${y}px,
        ${x}px ${y + h}px,
        ${x + w}px ${y + h}px,
        ${x + w}px ${y}px,
        ${x}px ${y}px
      )`,
      backgroundColor: 'rgba(0, 0, 0, 0.7)'
    };
  };

  const getTooltipTransform = () => {
    const position = currentStepData.position || 'center';
    switch (position) {
      case 'top':
        return 'translateX(-50%) translateY(-100%)';
      case 'bottom':
        return 'translateX(-50%)';
      case 'left':
        return 'translateX(-100%) translateY(-50%)';
      case 'right':
        return 'translateY(-50%)';
      case 'center':
      default:
        return 'translateX(-50%) translateY(-50%)';
    }
  };

  return (
    <div
      ref={overlayRef}
      className="tutorial-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        pointerEvents: 'auto',
        transition: 'opacity 0.3s ease',
        opacity: isVisible ? 1 : 0,
        ...getSpotlightStyles()
      }}
      onClick={handleOverlayClick}
    >
      {targetRect && (
        <div
          className="tutorial-spotlight-border"
          style={{
            position: 'fixed',
            top: targetRect.top - 4,
            left: targetRect.left - 4,
            width: targetRect.width + 8,
            height: targetRect.height + 8,
            border: '3px solid #3498db',
            borderRadius: '8px',
            pointerEvents: 'none',
            boxShadow: '0 0 20px rgba(52, 152, 219, 0.6), inset 0 0 20px rgba(52, 152, 219, 0.2)',
            animation: 'tutorial-pulse 2s infinite',
            zIndex: 10000
          }}
        />
      )}

      <div
        className="tutorial-tooltip"
        style={{
          position: 'fixed',
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: getTooltipTransform(),
          width: '360px',
          maxWidth: '90vw',
          backgroundColor: 'white',
          borderRadius: '12px',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
          padding: '24px',
          pointerEvents: 'auto',
          zIndex: 10001,
          transition: 'all 0.3s ease'
        }}
      >
        <button
          onClick={skipTour}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#95a5a6',
            padding: '4px',
            lineHeight: 1
          }}
          aria-label="Close tutorial"
        >
          ×
        </button>

        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: '6px',
            marginBottom: '16px'
          }}
        >
          {steps.map((_, index) => (
            <div
              key={index}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: index === currentStep ? '#3498db' : '#e0e0e0',
                transition: 'background-color 0.3s ease'
              }}
            />
          ))}
        </div>

        <h3
          style={{
            margin: '0 0 12px 0',
            fontSize: '1.25rem',
            fontWeight: '600',
            color: '#2c3e50',
            textAlign: 'center'
          }}
        >
          {currentStepData.title}
        </h3>

        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '0.95rem',
            lineHeight: 1.6,
            color: '#555',
            textAlign: 'center'
          }}
        >
          {currentStepData.content}
        </p>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          {(currentStepData.showSkip !== false) && (
            <button
              onClick={skipTour}
              style={{
                padding: '8px 16px',
                fontSize: '0.875rem',
                color: '#7f8c8d',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              Skip tour
            </button>
          )}

          <div style={{ display: 'flex', gap: '12px', marginLeft: 'auto' }}>
            {currentStepData.showPrev !== false && !isFirstStep && (
              <button
                onClick={prevStep}
                style={{
                  padding: '10px 20px',
                  fontSize: '0.9rem',
                  fontWeight: '500',
                  color: '#555',
                  backgroundColor: '#f5f5f5',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#e0e0e0'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#f5f5f5'}
              >
                Previous
              </button>
            )}

            {currentStepData.showNext !== false && (
              <button
                onClick={handleNext}
                style={{
                  padding: '10px 24px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: 'white',
                  backgroundColor: isLastStep ? '#27ae60' : '#3498db',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = isLastStep ? '#219a52' : '#2980b9';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = isLastStep ? '#27ae60' : '#3498db';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                {currentStepData.customNextLabel || (isLastStep ? 'Finish' : 'Next')}
              </button>
            )}

            {currentStepData.customNextLabel && currentStepData.showNext === false && (
              <button
                onClick={handleNext}
                style={{
                  padding: '10px 24px',
                  fontSize: '0.9rem',
                  fontWeight: '600',
                  color: 'white',
                  backgroundColor: '#27ae60',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#219a52';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = '#27ae60';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                {currentStepData.customNextLabel}
              </button>
            )}
          </div>
        </div>

        <div
          style={{
            marginTop: '16px',
            textAlign: 'center',
            fontSize: '0.8rem',
            color: '#95a5a6'
          }}
        >
          Step {currentStep + 1} of {totalSteps}
          {completedTours.includes(currentTour) && (
            <span style={{ marginLeft: '8px', color: '#27ae60' }}>
              (Replay)
            </span>
          )}
        </div>

        <div
          style={{
            marginTop: '8px',
            textAlign: 'center',
            fontSize: '0.75rem',
            color: '#bdc3c7'
          }}
        >
          Use arrow keys to navigate, ESC to skip
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
