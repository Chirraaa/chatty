// components/incoming-call.tsx - Clean minimalistic incoming call UI
import { useEffect, useState } from 'react';
import { StyleSheet, View, Modal, Alert, TouchableOpacity, Image, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming,
  Easing 
} from 'react-native-reanimated';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import authService from '@/services/auth.service';
import callService from '@/services/call.service';

// Firebase error type interface - ADDED
interface FirebaseError extends Error {
  code?: string;
}

// Helper function to check if error is a Firebase error - ADDED
function isFirebaseError(error: any): error is FirebaseError {
  return error && typeof error.code === 'string';
}

interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerPicture?: string;
  isVideo: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function IncomingCallListener() {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    pulseScale.value = withRepeat(
      withTiming(1.1, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  useEffect(() => {
    const currentUser = auth().currentUser;
    
    if (!currentUser) {
      return;
    }

    const unsubscribe = firestore()
      .collection('calls')
      .where('receiverId', '==', currentUser.uid)
      .where('status', '==', 'calling')
      .onSnapshot(
        async (snapshot) => {
          if (!snapshot) return;

          try {
            for (const change of snapshot.docChanges()) {
              if (change.type === 'added') {
                const callData = change.doc.data();
                
                const callerProfile = await authService.getUserProfile(callData.callerId);
                const customNickname = await authService.getCustomNickname(callData.callerId);
                
                setIncomingCall({
                  callId: change.doc.id,
                  callerId: callData.callerId,
                  callerName: customNickname || callerProfile?.username || 'Unknown',
                  callerPicture: callerProfile?.profilePicture,
                  isVideo: callData.isVideo,
                });
              }
            }
          } catch (error) {
            console.error('❌ Error processing incoming call:', error);
          }
        },
        (error) => {
          // Use type guard for Firebase error - FIXED
          if (isFirebaseError(error) && error.code === 'permission-denied') {
            return;
          }
          console.error('❌ Error in incoming call listener:', error);
        }
      );

    return () => unsubscribe();
  }, []);

  const handleAccept = async () => {
    if (!incomingCall) return;

    try {
      await callService.answerCall(incomingCall.callId);
      setIncomingCall(null);
      router.push(`/call/${incomingCall.callId}`);
    } catch (error) {
      console.error('Error accepting call:', error);
      Alert.alert('Error', 'Failed to accept call');
      handleDecline();
    }
  };

  const handleDecline = async () => {
    if (!incomingCall) return;

    try {
      await firestore()
        .collection('calls')
        .doc(incomingCall.callId)
        .update({ status: 'ended' });
      
      setIncomingCall(null);
    } catch (error) {
      console.error('Error declining call:', error);
    }
  };

  const avatarAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: pulseScale.value }],
    };
  });

  if (!incomingCall) return null;

  return (
    <Modal visible={true} transparent animationType="fade" statusBarTranslucent>
      <BlurView intensity={100} style={styles.container}>
        <View style={styles.content}>
          {/* Avatar with pulse animation */}
          <Animated.View style={[styles.avatarWrapper, avatarAnimatedStyle]}>
            <LinearGradient
              colors={['#667eea', '#764ba2']}
              style={styles.avatarGradient}
            >
              {incomingCall.callerPicture ? (
                <Image
                  source={{ uri: `data:image/jpeg;base64,${incomingCall.callerPicture}` }}
                  style={styles.avatar}
                />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {incomingCall.callerName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </Animated.View>

          {/* Caller Info */}
          <View style={styles.infoContainer}>
            <Text style={styles.callerName} numberOfLines={1}>
              {incomingCall.callerName}
            </Text>
            <View style={styles.callTypeRow}>
              <Ionicons
                name={incomingCall.isVideo ? 'videocam' : 'call'}
                size={16}
                color="#8E8E93"
              />
              <Text style={styles.callType}>
                {incomingCall.isVideo ? 'Video' : 'Voice'} Call
              </Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            {/* Decline Button */}
            <TouchableOpacity
              onPress={handleDecline}
              style={styles.actionButton}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FF3B30', '#C7001E']}
                style={styles.buttonGradient}
              >
                <Ionicons name="close" size={32} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.actionLabel}>Decline</Text>
            </TouchableOpacity>

            {/* Accept Button */}
            <TouchableOpacity
              onPress={handleAccept}
              style={styles.actionButton}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#34C759', '#248A3D']}
                style={styles.buttonGradient}
              >
                <Ionicons 
                  name={incomingCall.isVideo ? 'videocam' : 'call'} 
                  size={32} 
                  color="#FFFFFF" 
                />
              </LinearGradient>
              <Text style={styles.actionLabel}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  content: {
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  avatarWrapper: {
    marginBottom: 32,
  },
  avatarGradient: {
    width: 140,
    height: 140,
    borderRadius: 70,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: {
    width: 132,
    height: 132,
    borderRadius: 66,
  },
  avatarPlaceholder: {
    width: 132,
    height: 132,
    borderRadius: 66,
    backgroundColor: '#1C1C1E',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 56,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  infoContainer: {
    alignItems: 'center',
    marginBottom: 48,
  },
  callerName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  callTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callType: {
    fontSize: 16,
    color: '#8E8E93',
    fontWeight: '500',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
    width: '100%',
  },
  actionButton: {
    alignItems: 'center',
    gap: 12,
  },
  buttonGradient: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});