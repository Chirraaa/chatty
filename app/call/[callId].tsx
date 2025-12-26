// app/call/[callId].tsx - Fixed PIP with both streams and proper backgrounding
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Animated as RNAnimated,
  Alert,
  Image,
  AppState,
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
import authService from '@/services/auth.service';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const insets = useSafeAreaInsets();
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [callStatus, setCallStatus] = useState('connecting');
  const [isEnding, setIsEnding] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [otherUserName, setOtherUserName] = useState('Unknown');
  const [otherUserPicture, setOtherUserPicture] = useState<string | null>(null);

  // PIP state
  const [isPipMode, setIsPipMode] = useState(false);
  const [pipSize, setPipSize] = useState<'small' | 'large'>('small');
  const pan = useRef(new RNAnimated.ValueXY({ x: SCREEN_WIDTH - 140, y: 100 })).current;
  const lastTap = useRef(0);
  const appState = useRef(AppState.currentState);

  // Call duration timer
  useEffect(() => {
    if (callStatus !== 'connected') return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callStatus]);

  // Handle app state changes - keep call active in background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      console.log('📱 App state changed:', nextAppState);

      if (
        appState.current.match(/active/) &&
        nextAppState.match(/inactive|background/)
      ) {
        // App going to background - enable PIP mode and set background mode
        console.log('📱 App backgrounded - enabling PIP');
        setIsPipMode(true);
        callService.setBackgroundMode(true);
      } else if (
        appState.current.match(/inactive|background/) &&
        nextAppState.match(/active/)
      ) {
        // App coming to foreground
        console.log('📱 App foregrounded');
        callService.setBackgroundMode(false);
      }

      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Format duration as MM:SS
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // PIP Pan Responder with proper bounds
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: RNAnimated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();

        const pipWidth = pipSize === 'small' ? 120 : 180;
        const pipHeight = pipSize === 'small' ? 160 : 240;

        let finalX = (pan.x as any)._value;
        let finalY = (pan.y as any)._value;

        // Snap to nearest edge horizontally
        if (gestureState.moveX < SCREEN_WIDTH / 2) {
          finalX = 20;
        } else {
          finalX = SCREEN_WIDTH - pipWidth - 20;
        }

        // Keep within vertical bounds
        const maxY = SCREEN_HEIGHT - pipHeight - 20;
        const minY = insets.top + 20;
        finalY = Math.max(minY, Math.min(finalY, maxY));

        RNAnimated.spring(pan, {
          toValue: { x: finalX, y: finalY },
          useNativeDriver: false,
          tension: 50,
          friction: 8,
        }).start();
      },
    })
  ).current;

  useEffect(() => {
    if (!callId) return;

    loadCallInfo();
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

  const loadCallInfo = async () => {
    try {
      const callDoc = await firestore().collection('calls').doc(callId).get();
      const callData = callDoc.data();

      if (callData) {
        setIsVideoCall(callData.isVideo);
        setIsVideoEnabled(callData.isVideo);

        const currentUserId = authService.getCurrentUser()?.uid;
        const otherUserId = callData.callerId === currentUserId
          ? callData.receiverId
          : callData.callerId;

        const profile = await authService.getUserProfile(otherUserId);
        const nickname = await authService.getCustomNickname(otherUserId);

        setOtherUserName(nickname || profile?.username || 'Unknown');
        setOtherUserPicture(profile?.profilePicture || null);
      }
    } catch (error) {
      console.error('Error loading call info:', error);
    }
  };

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

  const handleToggleVideo = async () => {
    if (!isVideoEnabled && !isVideoCall) {
      Alert.alert(
        'Enable Video',
        'This will convert the audio call to a video call. Continue?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Enable Video',
            onPress: async () => {
              try {
                await callService.enableVideo();
                setIsVideoEnabled(true);
                setIsVideoCall(true);

                await firestore().collection('calls').doc(callId).update({
                  isVideo: true,
                });

                const local = callService.getLocalStream();
                setLocalStream(local);
              } catch (error) {
                console.error('Error enabling video:', error);
                Alert.alert('Error', 'Failed to enable video. Please check camera permissions.');
              }
            },
          },
        ]
      );
    } else {
      const enabled = callService.toggleCamera();
      setIsVideoEnabled(enabled);
    }
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

  // PIP Mode Rendering - FIXED: Show both local and remote video properly
  if (isPipMode) {
    const pipWidth = pipSize === 'small' ? 120 : 180;
    const pipHeight = pipSize === 'small' ? 160 : 240;

    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />

        {/* Floating PIP Window */}
        <View style={styles.pipOverlay} pointerEvents="box-none">
          <RNAnimated.View
            style={[
              styles.pipContainer,
              {
                width: pipWidth,
                height: pipHeight,
                transform: [
                  { translateX: pan.x },
                  { translateY: pan.y },
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <TouchableOpacity
              style={styles.pipVideoContainer}
              onPress={handlePipDoubleTap}
              activeOpacity={0.9}
            >
              {/* Main video area - show remote video or placeholder */}
              {remoteStream && isVideoCall ? (
                <RTCView
                  streamURL={remoteStream.toURL()}
                  style={styles.pipMainVideo}
                  objectFit="cover"
                  mirror={false}
                />
              ) : (
                <LinearGradient
                  colors={['#667eea', '#764ba2']}
                  style={styles.pipPlaceholder}
                >
                  {otherUserPicture ? (
                    <Image
                      source={{ uri: `data:image/jpeg;base64,${otherUserPicture}` }}
                      style={styles.pipAvatarImage}
                    />
                  ) : (
                    <Text style={styles.pipAvatarText}>
                      {otherUserName.charAt(0).toUpperCase()}
                    </Text>
                  )}
                </LinearGradient>
              )}

              {/* Local video (small corner) - Only if video enabled */}
              {localStream && isVideoEnabled && (
                <View style={styles.pipLocalVideoContainer}>
                  <RTCView
                    streamURL={localStream.toURL()}
                    style={styles.pipLocalVideo}
                    objectFit="cover"
                    mirror={true}
                  />
                </View>
              )}

              {/* Call duration badge */}
              {callStatus === 'connected' && (
                <View style={styles.pipDurationBadge}>
                  <Text style={styles.pipDurationText}>
                    {formatDuration(callDuration)}
                  </Text>
                </View>
              )}

              {/* Controls */}
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
                  disabled={isEnding}
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
        {/* Remote Video or Avatar (Full Screen) */}
        {remoteStream && isVideoCall ? (
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
                {otherUserPicture ? (
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${otherUserPicture}` }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <Ionicons name="person" size={64} color="#FFFFFF" />
                )}
              </LinearGradient>
            </View>
            <Text style={styles.callerName}>{otherUserName}</Text>
            <Text style={styles.statusText}>
              {callStatus === 'connecting' ? 'Connecting...' :
                callStatus === 'connected' ? formatDuration(callDuration) :
                  'Waiting...'}
            </Text>
          </LinearGradient>
        )}

        {/* Local Video (Picture-in-Picture) - Only show if video is enabled */}
        {localStream && isVideoEnabled && (
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
            {!isVideoCall && (
              <View style={styles.audioOnlyBadge}>
                <Ionicons name="mic" size={12} color="#FFFFFF" />
                <Text style={styles.audioOnlyText}>Audio</Text>
              </View>
            )}
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
            <TouchableOpacity
              onPress={handleEndCall}
              style={styles.controlWrapper}
              disabled={isEnding}
            >
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
                colors={!isVideoEnabled ? ['#FF3B30', '#C7001E'] : ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
                style={styles.controlButton}
              >
                <Ionicons
                  name={!isVideoEnabled ? 'videocam-off' : 'videocam'} size={28} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.controlLabel}>
                {!isVideoCall ? 'Enable' : isVideoEnabled ? 'Video On' : 'Video Off'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Controls - Only show if video is enabled */}
          {isVideoEnabled && (
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 140,
    height: 140,
    borderRadius: 70,
  },
  callerName: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
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
  audioOnlyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 4,
    paddingLeft: 8,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255, 255, 255, 0.3)',
  },
  audioOnlyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
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
  pipOverlay: {
    ...StyleSheet.absoluteFillObject,
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
    backgroundColor: '#000',
  },
  pipVideoContainer: {
    flex: 1,
  },
  pipMainVideo: {
    flex: 1,
  },
  pipPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipAvatarImage: {
    width: '100%',
    height: '100%',
  },
  pipAvatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pipLocalVideoContainer: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 40,
    height: 56,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  pipLocalVideo: {
    flex: 1,
  },
  pipDurationBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
  },
  pipDurationText: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  pipControls: {
    position: 'absolute',
    bottom: 8,
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