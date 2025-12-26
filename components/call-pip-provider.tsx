// components/call-pip-provider.tsx - Global floating PIP that works anywhere in the app
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Dimensions,
  PanResponder,
  Animated as RNAnimated,
  Image,
  AppState,
} from 'react-native';
import { router } from 'expo-router';
import { RTCView } from 'react-native-webrtc';
import { Text } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import callService from '@/services/call.service';
import firestore from '@react-native-firebase/firestore';
import authService from '@/services/auth.service';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export function CallPipProvider() {
  const insets = useSafeAreaInsets();
  const [isCallActive, setIsCallActive] = useState(false);
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [callId, setCallId] = useState<string | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isVideoCall, setIsVideoCall] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [otherUserName, setOtherUserName] = useState('Unknown');
  const [otherUserPicture, setOtherUserPicture] = useState<string | null>(null);
  const [pipSize, setPipSize] = useState<'small' | 'large'>('small');
  
  const pan = useRef(new RNAnimated.ValueXY({ x: SCREEN_WIDTH - 140, y: 100 })).current;
  const lastTap = useRef(0);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  // Monitor for active calls
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const active = callService.isCallActive();
      const currentCallId = callService.getCurrentCallId();
      
      if (active && currentCallId && !isCallActive) {
        // Call just became active
        console.log('📞 PIP: Call became active');
        setIsCallActive(true);
        setCallId(currentCallId);
        loadCallInfo(currentCallId);
        updateStreams();
      } else if (!active && isCallActive) {
        // Call ended
        console.log('📞 PIP: Call ended');
        setIsCallActive(false);
        setCallId(null);
        if (durationInterval.current) {
          clearInterval(durationInterval.current);
        }
      } else if (active) {
        // Call ongoing, update streams
        updateStreams();
      }
    }, 500);

    return () => clearInterval(checkInterval);
  }, [isCallActive]);

  // Call duration timer
  useEffect(() => {
    if (!isCallActive) {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
        durationInterval.current = null;
      }
      setCallDuration(0);
      return;
    }

    durationInterval.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, [isCallActive]);

  const updateStreams = () => {
    const local = callService.getLocalStream();
    const remote = callService.getRemoteStream();
    
    if (local !== localStream) {
      setLocalStream(local);
      
      // Check if video is enabled
      if (local) {
        const videoTrack = local.getVideoTracks()[0];
        setIsVideoEnabled(videoTrack && videoTrack.enabled);
      }
    }
    
    if (remote !== remoteStream) {
      setRemoteStream(remote);
    }
  };

  const loadCallInfo = async (callId: string) => {
    try {
      const callDoc = await firestore().collection('calls').doc(callId).get();
      const callData = callDoc.data();

      if (callData) {
        setIsVideoCall(callData.isVideo);

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

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

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

        // Snap to edge
        if (gestureState.moveX < SCREEN_WIDTH / 2) {
          finalX = 20;
        } else {
          finalX = SCREEN_WIDTH - pipWidth - 20;
        }

        // Keep in bounds
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

  const handlePipDoubleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setPipSize(pipSize === 'small' ? 'large' : 'small');
    }
    lastTap.current = now;
  };

  const handleMaximize = () => {
    if (callId) {
      router.push(`/call/${callId}`);
    }
  };

  const handleEndCall = async () => {
    try {
      if (callId) {
        await callService.endCall(callId);
      }
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  // Don't render if no active call
  if (!isCallActive || !callId) {
    return null;
  }

  const pipWidth = pipSize === 'small' ? 120 : 180;
  const pipHeight = pipSize === 'small' ? 160 : 240;

  return (
    <RNAnimated.View
      pointerEvents="box-none"
      style={[
        StyleSheet.absoluteFill,
        { zIndex: 9999 },
      ]}
    >
      <RNAnimated.View
        pointerEvents="auto"
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
          {/* Video or avatar */}
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

          {/* Local video corner */}
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

          {/* Duration */}
          <View style={styles.pipDurationBadge}>
            <Text style={styles.pipDurationText}>
              {formatDuration(callDuration)}
            </Text>
          </View>

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
            >
              <Ionicons name="call" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </RNAnimated.View>
    </RNAnimated.View>
  );
}

const styles = StyleSheet.create({
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