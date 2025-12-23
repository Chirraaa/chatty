// components/incoming-call.tsx - Minimalistic clean design
import { useEffect, useState } from 'react';
import { StyleSheet, View, Modal, Alert, TouchableOpacity, Image, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import authService from '@/services/auth.service';
import callService from '@/services/call.service';

interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string;
  callerPicture?: string;
  isVideo: boolean;
}

interface FirebaseError extends Error {
  code?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function IncomingCallListener() {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    const currentUser = auth().currentUser;
    
    if (!currentUser) {
      console.log('👤 No user, skipping incoming call listener setup');
      return;
    }

    console.log('📞 Setting up incoming call listener for:', currentUser.uid);

    const unsubscribe = firestore()
      .collection('calls')
      .where('receiverId', '==', currentUser.uid)
      .where('status', '==', 'calling')
      .onSnapshot(
        async (snapshot) => {
          if (!snapshot) {
            console.warn('⚠️ Received null snapshot in incoming call listener');
            return;
          }

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
        (error: FirebaseError) => {
          if (error.code === 'permission-denied') {
            console.log('🔒 Incoming call listener closed (expected after sign out)');
            return;
          }
          
          console.error('❌ Error in incoming call listener:', error);
          
          if (error.code) {
            console.error(`💡 Firebase error code: ${error.code}`);
          }
        }
      );

    return () => {
      console.log('🧹 Cleaning up incoming call listener');
      unsubscribe();
    };
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

  if (!incomingCall) return null;

  return (
    <Modal
      visible={true}
      transparent
      animationType="fade"
    >
      <BlurView intensity={100} style={styles.modalOverlay}>
        <View style={styles.callCard}>
          {/* Caller Avatar */}
          <View style={styles.avatarContainer}>
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
          </View>

          {/* Caller Name */}
          <Text style={styles.callerName}>
            {incomingCall.callerName}
          </Text>

          {/* Call Type */}
          <View style={styles.callTypeContainer}>
            <Ionicons
              name={incomingCall.isVideo ? 'videocam' : 'call'}
              size={16}
              color="#8E8E93"
            />
            <Text style={styles.callTypeText}>
              Incoming {incomingCall.isVideo ? 'video' : 'voice'} call
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={handleDecline}
              style={styles.declineButton}
            >
              <Ionicons name="close" size={32} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAccept}
              style={styles.acceptButton}
            >
              <Ionicons name="call" size={32} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  callCard: {
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    padding: 40,
    backgroundColor: 'rgba(28, 28, 30, 0.95)',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    backgroundColor: '#667eea',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '600',
  },
  callerName: {
    fontSize: 28,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  callTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
  },
  callTypeText: {
    marginLeft: 8,
    fontSize: 15,
    color: '#8E8E93',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 24,
    width: '100%',
    justifyContent: 'center',
  },
  declineButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF3B30',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  acceptButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#34C759',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#34C759',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
});