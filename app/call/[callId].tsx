// app/call/[callId].tsx - Updated with native PiP support
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
  AppState,
} from 'react-native';
import { useLocalSearchParams, router, Stack, useFocusEffect } from 'expo-router';
import { RTCView } from 'react-native-webrtc';
import { Text } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import callService from '@/services/call.service';
import pipService from '@/services/pip.service';
import firestore from '@react-native-firebase/firestore';
import authService from '@/services/auth.service';

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
  const [isInPipMode, setIsInPipMode] = useState(false);
  const appStateRef = useRef(AppState.currentState);

  // Call duration timer
  useEffect(() => {
    if (callStatus !== 'connected') return;

    const interval = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [callStatus]);

  useEffect(() => {
    if (!callId) return;

    loadCallInfo();
    setupCall();
    const unsubscribe = monitorCallStatus();

    // Setup PiP mode listener
    pipService.setOnPipModeChanged((isInPip) => {
      console.log('📺 PiP mode changed in call screen:', isInPip);
      setIsInPipMode(isInPip);
    });

    // Setup app state listener for automatic PiP
    const appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appStateRef.current === 'active' &&
        (nextAppState === 'background' || nextAppState === 'inactive') &&
        callStatus === 'connected' &&
        !isEnding
      ) {
        // App is going to background during an active call - enter PiP
        console.log('📺 App going to background during call - entering PiP mode');
        await enterPipMode();
      }
      
      appStateRef.current = nextAppState;
    });

    return () => {
      if (!isEnding) {
        console.log('📱 Navigating away from call screen - call will continue');
      }
      if (unsubscribe) {
        unsubscribe();
      }
      appStateSubscription?.remove();
    };
  }, [callId, callStatus, isEnding]);

  // Check PiP support on mount
  useEffect(() => {
    checkPipSupport();
  }, []);

  const checkPipSupport = async () => {
    if (Platform.OS === 'android') {
      const supported = await pipService.isPipSupported();
      console.log('📺 PiP supported:', supported);
    }
  };

  const enterPipMode = async () => {
    if (Platform.OS !== 'android') {
      console.log('📺 PiP only supported on Android');
      return;
    }

    try {
      // Use 16:9 aspect ratio for video calls, 9:16 for portrait
      const success = await pipService.enterPipMode(16, 9);
      if (success) {
        console.log('✅ Successfully entered native PiP mode');
      } else {
        console.log('❌ Failed to enter PiP mode');
      }
    } catch (error) {
      console.error('Error entering PiP mode:', error);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

        const displayName = nickname || profile?.username || 'Unknown';
        setOtherUserName(displayName);
        setOtherUserPicture(profile?.profilePicture || null);

        callService.setCallerName(displayName);
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
                Alert.alert('Error', 'Failed to enable video.');
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

  const handleMinimize = async () => {
    if (Platform.OS === 'android') {
      // Try to enter PiP mode before navigating away
      await enterPipMode();
    }
    // Navigate away - the call will continue
    router.back();
  };

  // Simplified UI when in PiP mode (Android only)
  if (isInPipMode && Platform.OS === 'android') {
    return (
      <View style={styles.pipModeContainer}>
        {remoteStream && isVideoCall ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.pipVideo}
            objectFit="cover"
            mirror={false}
          />
        ) : (
          <LinearGradient
            colors={['#667eea', '#764ba2']}
            style={styles.pipVideoPlaceholder}
          >
            {otherUserPicture ? (
              <Image
                source={{ uri: `data:image/jpeg;base64,${otherUserPicture}` }}
                style={styles.pipAvatarImage}
              />
            ) : (
              <Ionicons name="person" size={48} color="#FFFFFF" />
            )}
          </LinearGradient>
        )}
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.container}>
        {/* Remote Video or Avatar */}
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

        {/* Local Video PIP */}
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
            {/* Mute */}
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

            {/* End Call */}
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

            {/* Video */}
            <TouchableOpacity
              onPress={handleToggleVideo}
              style={styles.controlWrapper}
            >
              <LinearGradient
                colors={!isVideoEnabled ? ['#FF3B30', '#C7001E'] : ['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.05)']}
                style={styles.controlButton}
              >
                <Ionicons
                  name={!isVideoEnabled ? 'videocam-off' : 'videocam'} 
                  size={28} 
                  color="#FFFFFF" 
                />
              </LinearGradient>
              <Text style={styles.controlLabel}>
                {!isVideoCall ? 'Enable' : isVideoEnabled ? 'Video On' : 'Video Off'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Secondary Controls */}
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
  pipModeContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  pipVideo: {
    flex: 1,
  },
  pipVideoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipAvatarImage: {
    width: '100%',
    height: '100%',
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
});