// hooks/use-pip.ts - React hook for Picture-in-Picture
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import pipService from '@/services/pip.service';

export function usePipMode() {
  const [isInPipMode, setIsInPipMode] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);

  useEffect(() => {
    // Check PiP support
    const checkSupport = async () => {
      if (Platform.OS === 'android') {
        const supported = await pipService.isPipSupported();
        setIsPipSupported(supported);
      }
    };

    checkSupport();

    // Listen for PiP mode changes
    pipService.setOnPipModeChanged((isInPip) => {
      setIsInPipMode(isInPip);
    });

    return () => {
      pipService.setOnPipModeChanged(() => {});
    };
  }, []);

  const enterPipMode = async (width: number = 16, height: number = 9) => {
    if (Platform.OS !== 'android') {
      console.warn('PiP is only supported on Android');
      return false;
    }

    return await pipService.enterPipMode(width, height);
  };

  return {
    isInPipMode,
    isPipSupported,
    enterPipMode,
  };
}