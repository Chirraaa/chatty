// services/pip.service.ts - Native Picture-in-Picture service
import { Platform, NativeModules, NativeEventEmitter, AppState } from 'react-native';

const { PipHandler } = NativeModules;

class PipService {
  private isEnabled: boolean = false;
  private eventEmitter: NativeEventEmitter | null = null;
  private pipModeListener: any = null;
  private appStateListener: any = null;
  private onPipModeChanged: ((isInPip: boolean) => void) | null = null;

  constructor() {
    if (Platform.OS === 'android' && PipHandler) {
      this.eventEmitter = new NativeEventEmitter(PipHandler);
      this.setupListeners();
    }
  }

  /**
   * Setup event listeners for PiP state changes
   */
  private setupListeners(): void {
    if (!this.eventEmitter) return;

    this.pipModeListener = this.eventEmitter.addListener(
      'onPictureInPictureModeChanged',
      (data: { isInPictureInPictureMode: boolean }) => {
        console.log('📺 PiP mode changed:', data.isInPictureInPictureMode);
        this.isEnabled = data.isInPictureInPictureMode;
        
        if (this.onPipModeChanged) {
          this.onPipModeChanged(data.isInPictureInPictureMode);
        }
      }
    );

    // Monitor app state for automatic PiP
    this.appStateListener = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' && !this.isEnabled) {
        console.log('📺 App going to background - checking if should enter PiP');
      }
    });
  }

  /**
   * Enter native Picture-in-Picture mode (Android only)
   */
  async enterPipMode(width: number = 16, height: number = 9): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('📺 PiP is only supported on Android');
      return false;
    }

    if (!PipHandler) {
      console.warn('📺 PipHandler module not available');
      return false;
    }

    try {
      console.log('📺 Entering PiP mode...');
      const result = await PipHandler.enterPipMode(width, height);
      this.isEnabled = true;
      console.log('✅ Entered PiP mode successfully');
      return result;
    } catch (error) {
      console.error('❌ Failed to enter PiP mode:', error);
      return false;
    }
  }

  /**
   * Check if device supports PiP
   */
  async isPipSupported(): Promise<boolean> {
    if (Platform.OS !== 'android') return false;
    
    if (!PipHandler || !PipHandler.isPipSupported) return false;

    try {
      return await PipHandler.isPipSupported();
    } catch (error) {
      console.error('Error checking PiP support:', error);
      return false;
    }
  }

  /**
   * Check if currently in PiP mode
   */
  isPipActive(): boolean {
    return this.isEnabled;
  }

  /**
   * Set callback for PiP mode changes
   */
  setOnPipModeChanged(callback: (isInPip: boolean) => void): void {
    this.onPipModeChanged = callback;
  }

  /**
   * Configure auto-enter PiP when app goes to background
   */
  configureAutoEnter(shouldAutoEnter: boolean): void {
    if (Platform.OS !== 'android' || !PipHandler) return;

    if (shouldAutoEnter && !this.appStateListener) {
      this.setupListeners();
    }
  }

  /**
   * Cleanup listeners
   */
  cleanup(): void {
    if (this.pipModeListener) {
      this.pipModeListener.remove();
      this.pipModeListener = null;
    }

    if (this.appStateListener) {
      this.appStateListener.remove();
      this.appStateListener = null;
    }
  }
}

export default new PipService();