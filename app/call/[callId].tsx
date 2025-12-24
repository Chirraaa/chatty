// app/call/[callId].tsx - Clean minimalistic calling interface
import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Animated as RNAnimated,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { RTCView } from 'react-native-webrtc';
import { Text } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import callService from '@/services/call.service';
import firestore from '@react-native-firebase/firestore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const insets = useSafeAreaInsets();
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState('connecting');
  const [isEnding, setIsEnding] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  
  // PIP state
  const [isPipMode, setIsPipMode] = useState(false);
  const [pipSize, setPipSize] = useState<'small' | 'large'>('small');
  const pan = useRef(new RNAnimated.ValueXY({ x: SCREEN_WIDTH - 140, y: 100 })).current;
  const currentPanPosition = useRef({ x: SCREEN_WIDTH - 140, y: 100 });
  const lastTap = useRef(0);

  // Call duration timer
  useEffect(() => {
    if (callStatus !== 'connected') return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callStatus]);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Track pan position changes
  useEffect(() => {
    const listenerId = pan.addListener((value) => {
      currentPanPosition.current = value;
    });
    
    return () => {
      pan.removeListener(listenerId);
    };
  }, []);

  // PIP Pan Responder
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isPipMode,
      onPanResponderMove: RNAnimated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        const currentY = currentPanPosition.current.y;
        const x = gestureState.moveX < SCREEN_WIDTH / 2 ? 20 : SCREEN_WIDTH - (pipSize === 'small' ? 140 : 200);
        
        RNAnimated.spring(pan, {
          toValue: { x, y: currentY },
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (!callId) return;

    setupCall();
    const unsubscribe = monitorCallStatus();

    return () => {
      if (!isEnding) {
        callService.endCall(callId).catch(console.error);
      }
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [callId]);

  const setupCall = async () => {
    try {
      const local = callService.getLocalStream();
      const remote = callService.getRemoteStream();

      setLocalStream(local);
      setRemoteStream(remote);

      const interval = setInterval(() => {
        const updatedRemote = callService.getRemoteStream();
        if (updatedRemote && updatedRemote !== remoteStream) {
          setRemoteStream(updatedRemote);
          setCallStatus('connected');
          clearInterval(interval);
        }
      }, 500);

      setTimeout(() => clearInterval(interval), 30000);
    } catch (error) {
      console.error('Call setup error:', error);
      router.back();
    }
  };

  const monitorCallStatus = () => {
    const unsubscribe = firestore()
      .collection('calls')
      .doc(callId)
      .onSnapshot((snapshot) => {
        const data = snapshot.data();
        if (data?.status === 'ended' && !isEnding) {
          setIsEnding(true);
          callService.endCall(callId).catch(console.error);
          setTimeout(() => {
            router.replace('/(tabs)');
          }, 100);
        } else if (data?.status === 'connected') {
          setCallStatus('connected');
        }
      });

    return unsubscribe;
  };

  const handleEndCall = async () => {
    if (isEnding) return;
    
    try {
      setIsEnding(true);
      await callService.endCall(callId);
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    } catch (error) {
      console.error('Error ending call:', error);
      router.replace('/(tabs)');
    }
  };

  const handleToggleMute = () => {
    const enabled = callService.toggleMicrophone();
    setIsMuted(!enabled);
  };

  const handleToggleVideo = () => {
    const enabled = callService.toggleCamera();
    setIsVideoOff(!enabled);
  };

  const handleSwitchCamera = async () => {
    try {
      await callService.switchCamera();
    } catch (error) {
      console.error('Switch camera error:', error);
    }
  };

  const handlePipDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      setPipSize(pipSize === 'small' ? 'large' : 'small');
    }
    lastTap.current = now;
  };

  const handleMinimize = () => {
    setIsPipMode(true);
  };

  const handleMaximize = () => {
    setIsPipMode(false);
  };

  // PIP Mode Rendering
  if (isPipMode) {
    const pipWidth = pipSize === 'small' ? 120 : 180;
    const pipHeight = pipSize === 'small' ? 160 : 240;

    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.pipBackground}>
          <RNAnimated.View
            style={[
              styles.pipContainer,
              {
                width: pipWidth,
                height: pipHeight,
                transform: [{ translateX: pan.x }, { translateY: pan.y }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <TouchableOpacity
              style={styles.pipVideoContainer}
              onPress={handlePipDoubleTap}
              activeOpacity={0.9}
            >
              {remoteStream ? (
                <RTCView
                  streamURL={remoteStream.toURL()}
                  style={styles.pipVideo}
                  objectFit="cover"
                  mirror={false}
                />
              ) : (
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.pipPlaceholder}
                >
                  <Ionicons name="person" size={40} color="#FFFFFF" />
                </LinearGradient>
              )}

              <View style={styles.pipControls}>
                <TouchableOpacity
                  style={styles.pipButton}
                  onPress={handleMaximize}
                >
                  <Ionicons name="expand" size={16} color="#FFFFFF" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.pipButton, styles.pipEndButton]}
                  onPress={handleEndCall}
                >
                  <Ionicons name="call" size={16} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </RNAnimated.View>
        </View>
      </>
    );
  }

  // Full Screen Mode Rendering
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.container}>
        {/* Remote Video (Full Screen) */}
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
            mirror={false}
          />
        ) : (
          <LinearGradient
            colors={['#000000', '#1A1A1A']}
            style={styles.waitingContainer}
          >
            <View style={styles.avatarPlaceholder}>
              <LinearGradient
                colors={['#667eea', '#764ba2']}
                style={styles.avatarGradient}
              >
                <Ionicons name="person" size={64} color="#FFFFFF" />
              </LinearGradient>
            </View>
            <Text style={styles.statusText}>
              {callStatus === 'connecting' ? 'Connecting...' : 'Waiting for response...'}
            </Text>
          </LinearGradient>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {localStream && !isVideoOff && (
          <Animated.View 
            entering={FadeIn} 
            exiting={FadeOut}
            style={[styles.localVideoContainer, { top: 80 + insets.top }]}
          >
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror={true}
            />
          </Animated.View>
        )}

        {/* Status Bar */}
        <View style={[styles.statusBar, { top: 60 + insets.top }]}>
          <View style={styles.statusLeft}>
            <View style={[styles.statusDot, callStatus === 'connected' && styles.statusDotConnected]} />
            <Text style={styles.statusText}>
              {callStatus === 'connected' ? formatDuration(callDuration) : 'Connecting'}
            </Text>
          </View>

          <TouchableOpacity onPress={handleMinimize} style={styles.minimizeButton}>
            <Ionicons name="remove-circle-outline" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Bottom Controls */}
        <View style={[styles.controlsContainer, { paddingBottom: Math.max(insets.bottom + 32, 48) }]}>
          <View style={styles.controlsRow}>
            {/* Mute Button */}
            <TouchableOpacity
              onPress={handleToggleMute}
              style={styles.controlWrapper}
            >
              <LinearGradient
                colors={isMuted ? ['#FF3B30', '#C7001E'] : ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
                style={styles.controlButton}
              >
                <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.controlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
            </TouchableOpacity>

            {/* End Call Button */}
            <TouchableOpacity onPress={handleEndCall} style={styles.controlWrapper}>
              <LinearGradient
                colors={['#FF3B30', '#C7001E']}
                style={styles.endCallButton}
              >
                <Ionicons name="call" size={32} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.controlLabel}>End</Text>
            </TouchableOpacity>

            {/* Video Toggle Button */}
            <TouchableOpacity
              onPress={handleToggleVideo}
              style={styles.controlWrapper}
            >
              <LinearGradient
                colors={isVideoOff ? ['#FF3B30', '#C7001E'] : ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
                style={styles.controlButton}
              >
                <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={28} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.controlLabel}>{isVideoOff ? 'Video Off' : 'Video On'}</Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Controls */}
          {!isVideoOff && (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.secondaryControls}>
              <TouchableOpacity onPress={handleSwitchCamera} style={styles.secondaryButton}>
                <Ionicons name="camera-reverse-outline" size={24} color="#FFFFFF" />
                <Text style={styles.secondaryButtonLabel}>Flip</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  remoteVideo: {
    flex: 1,
  },
  waitingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPlaceholder: {
    marginBottom: 24,
  },
  avatarGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  localVideoContainer: {
    position: 'absolute',
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 12,
  },
  localVideo: {
    flex: 1,
  },
  statusBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 24,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFC107',
  },
  statusDotConnected: {
    backgroundColor: '#34C759',
  },
  minimizeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 24,
    padding: 6,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingTop: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-end',
    marginBottom: 16,
  },
  controlWrapper: {
    alignItems: 'center',
    gap: 8,
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 12,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 8,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  secondaryButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // PIP Styles
  pipBackground: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pipContainer: {
    position: 'absolute',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 16,
    elevation: 16,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pipVideoContainer: {
    flex: 1,
  },
  pipVideo: {
    flex: 1,
  },
  pipPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipControls: {
    position: 'absolute',
    top: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  pipButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 16,
    padding: 8,
  },
  pipEndButton: {
    backgroundColor: '#FF3B30',
  },
});