// components/incoming-call.tsx
import { useEffect, useState } from 'react';
import { StyleSheet, View, Modal, Alert, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { Card, Text, Button } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import authService from '@/services/auth.service';
import callService from '@/services/call.service';

interface IncomingCall {
  callId: string;
  callerId: string;
  callerName: string;
  isVideo: boolean;
}

interface FirebaseError extends Error {
  code?: string;
}

export function IncomingCallListener() {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    const currentUser = auth().currentUser;
    
    // Don't set up listener if user is not authenticated
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
                  isVideo: callData.isVideo,
                });
              }
            }
          } catch (error) {
            console.error('❌ Error processing incoming call:', error);
          }
        },
        (error: FirebaseError) => {
          console.error('❌ Error in incoming call listener:', error);
          
          if (error.code === 'permission-denied') {
            console.error('💡 Permission denied: User may have signed out or lacks permissions');
          } else if (error.code) {
            console.error(`💡 Firebase error code: ${error.code}`);
          }
        }
      );

    return () => {
      console.log('🧹 Cleaning up incoming call listener');
      unsubscribe();
    };
  }, []); // Empty dependency array - only run on mount/unmount

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
      <View style={styles.modalOverlay}>
        <Card style={styles.callCard}>
          {/* Caller Avatar */}
          <View style={styles.callerAvatar}>
            <Text category='h1' style={styles.avatarText}>
              {incomingCall.callerName.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Caller Name */}
          <Text category='h4' style={styles.callerName}>
            {incomingCall.callerName}
          </Text>

          {/* Call Type */}
          <View style={styles.callTypeContainer}>
            <Ionicons
              name={incomingCall.isVideo ? 'videocam' : 'call'}
              size={20}
              color="#8F9BB3"
            />
            <Text appearance='hint' style={styles.callTypeText}>
              Incoming {incomingCall.isVideo ? 'video' : 'voice'} call
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={handleDecline}
              style={styles.declineButton}
            >
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAccept}
              style={styles.acceptButton}
            >
              <Ionicons name="checkmark" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  callCard: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    padding: 32,
  },
  callerAvatar: {
    width: 96,
    height: 96,
    backgroundColor: '#3366FF',
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 40,
  },
  callerName: {
    marginBottom: 8,
    textAlign: 'center',
  },
  callTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  callTypeText: {
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#FF3D71',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#00D68F',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});