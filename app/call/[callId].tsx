// app/call/[callId].tsx - Fixed Animated value access
import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Animated,
  Platform,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { RTCView } from 'react-native-webrtc';
import { Text } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import callService from '@/services/call.service';
import firestore from '@react-native-firebase/firestore';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState('connecting');
  const [isEnding, setIsEnding] = useState(false);
  
  // PIP state
  const [isPipMode, setIsPipMode] = useState(false);
  const [pipSize, setPipSize] = useState<'small' | 'large'>('small');
  const pan = useRef(new Animated.ValueXY({ x: SCREEN_WIDTH - 140, y: 100 })).current;
  const currentPanPosition = useRef({ x: SCREEN_WIDTH - 140, y: 100 });
  const lastTap = useRef(0);

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
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gestureState) => {
        // Snap to edges using the tracked position
        const currentY = currentPanPosition.current.y;
        const x = gestureState.moveX < SCREEN_WIDTH / 2 ? 20 : SCREEN_WIDTH - (pipSize === 'small' ? 140 : 200);
        
        Animated.spring(pan, {
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
          <Animated.View
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
                <View style={styles.pipPlaceholder}>
                  <Ionicons name="person" size={40} color="#FFFFFF" />
                </View>
              )}

              <TouchableOpacity
                style={styles.pipMaximizeButton}
                onPress={handleMaximize}
              >
                <Ionicons name="expand" size={16} color="#FFFFFF" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pipEndButton}
                onPress={handleEndCall}
              >
                <Ionicons name="call" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </TouchableOpacity>
          </Animated.View>
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
          <View style={styles.waitingContainer}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={64} color="#FFFFFF" />
            </View>
            <Text style={styles.statusText}>
              {callStatus === 'connecting' ? 'Connecting...' : 'Waiting...'}
            </Text>
          </View>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {localStream && !isVideoOff && (
          <View style={styles.localVideoContainer}>
            <RTCView
              streamURL={localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror={true}
            />
          </View>
        )}

        {/* Status Indicator */}
        <View style={styles.statusIndicator}>
          <View style={[styles.statusDot, callStatus === 'connected' && styles.statusDotConnected]} />
          <Text style={styles.statusIndicatorText}>
            {callStatus === 'connected' ? 'Connected' : 'Connecting'}
          </Text>
        </View>

        {/* Top Controls */}
        <View style={styles.topControls}>
          <TouchableOpacity onPress={handleMinimize} style={styles.topButton}>
            <Ionicons name="remove" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Bottom Controls */}
        <LinearGradient
          colors={['transparent', 'rgba(0,0,0,0.8)']}
          style={styles.controlsContainer}
        >
          <View style={styles.controlsRow}>
            <TouchableOpacity
              onPress={handleToggleMute}
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
            >
              <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleEndCall} style={styles.endCallButton}>
              <Ionicons name="call" size={32} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleToggleVideo}
              style={[styles.controlButton, isVideoOff && styles.controlButtonActive]}
            >
              <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {!isVideoOff && (
            <TouchableOpacity onPress={handleSwitchCamera} style={styles.switchCameraButton}>
              <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
              <Text style={styles.switchCameraText}>Switch</Text>
            </TouchableOpacity>
          )}
        </LinearGradient>
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
    backgroundColor: '#1A1A1A',
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#333',
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  localVideo: {
    flex: 1,
  },
  statusIndicator: {
    position: 'absolute',
    top: 60,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFC107',
    marginRight: 6,
  },
  statusDotConnected: {
    backgroundColor: '#4CAF50',
  },
  statusIndicatorText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  topControls: {
    position: 'absolute',
    top: 60,
    right: 132,
    flexDirection: 'row',
  },
  topButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    padding: 8,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 40,
    paddingTop: 60,
    paddingHorizontal: 32,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#E0245E',
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E0245E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchCameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    alignSelf: 'center',
  },
  switchCameraText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  // PIP Styles
  pipBackground: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  pipContainer: {
    position: 'absolute',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pipVideoContainer: {
    flex: 1,
    backgroundColor: '#1A1A1A',
  },
  pipVideo: {
    flex: 1,
  },
  pipPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#333',
  },
  pipMaximizeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 16,
    padding: 6,
  },
  pipEndButton: {
    position: 'absolute',
    bottom: 8,
    left: '50%',
    marginLeft: -20,
    backgroundColor: '#E0245E',
    borderRadius: 20,
    padding: 8,
  },
});