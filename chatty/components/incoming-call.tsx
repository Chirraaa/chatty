// components/incoming-call.tsx
import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Alert } from 'react-native';
import { router } from 'expo-router';
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

// Firebase error type
interface FirebaseError extends Error {
  code?: string;
}

export function IncomingCallListener() {
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);

  useEffect(() => {
    const currentUser = auth().currentUser;
    if (!currentUser) return;

    // Listen for incoming calls
    const unsubscribe = firestore()
      .collection('calls')
      .where('receiverId', '==', currentUser.uid)
      .where('status', '==', 'calling')
      .onSnapshot(
        async (snapshot) => {
          // Check if snapshot is null or invalid
          if (!snapshot) {
            console.warn('⚠️ Received null snapshot in incoming call listener');
            return;
          }

          try {
            for (const change of snapshot.docChanges()) {
              if (change.type === 'added') {
                const callData = change.doc.data();
                
                // Get caller info
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
          
          // Provide helpful error message
          if (error.code === 'permission-denied') {
            console.error('💡 Permission denied: Check your Firestore security rules');
          } else if (error.code) {
            console.error(`💡 Firebase error code: ${error.code}`);
          }
        }
      );

    return unsubscribe;
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
      <View className="flex-1 bg-black/80 items-center justify-center px-8">
        <View className="bg-white dark:bg-gray-800 rounded-3xl p-8 w-full max-w-sm items-center">
          {/* Caller Icon */}
          <View className="w-24 h-24 bg-blue-500 rounded-full items-center justify-center mb-6">
            <Text className="text-white text-4xl font-bold">
              {incomingCall.callerName.charAt(0).toUpperCase()}
            </Text>
          </View>

          {/* Caller Name */}
          <Text className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {incomingCall.callerName}
          </Text>

          {/* Call Type */}
          <View className="flex-row items-center mb-8">
            <Ionicons
              name={incomingCall.isVideo ? 'videocam' : 'call'}
              size={20}
              color="#6B7280"
            />
            <Text className="text-gray-600 dark:text-gray-400 ml-2">
              Incoming {incomingCall.isVideo ? 'video' : 'voice'} call
            </Text>
          </View>

          {/* Action Buttons */}
          <View className="flex-row gap-4 w-full">
            <TouchableOpacity
              onPress={handleDecline}
              className="flex-1 bg-red-500 rounded-full py-4"
            >
              <View className="items-center">
                <Ionicons name="close" size={24} color="white" />
                <Text className="text-white font-semibold mt-1">Decline</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleAccept}
              className="flex-1 bg-green-500 rounded-full py-4"
            >
              <View className="items-center">
                <Ionicons name="checkmark" size={24} color="white" />
                <Text className="text-white font-semibold mt-1">Accept</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}