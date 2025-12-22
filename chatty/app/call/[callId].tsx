// app/call/[callId].tsx
import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { RTCView } from 'react-native-webrtc';
import { Ionicons } from '@expo/vector-icons';
import callService from '@/services/call.service';
import firestore from '@react-native-firebase/firestore';

export default function CallScreen() {
  const { callId } = useLocalSearchParams<{ callId: string }>();
  const [localStream, setLocalStream] = useState<any>(null);
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callStatus, setCallStatus] = useState('connecting');

  useEffect(() => {
    if (!callId) return;

    setupCall();
    monitorCallStatus();

    return () => {
      callService.endCall(callId);
    };
  }, [callId]);

  const setupCall = async () => {
    try {
      // Get streams from call service
      const local = callService.getLocalStream();
      const remote = callService.getRemoteStream();

      setLocalStream(local);
      setRemoteStream(remote);

      // Poll for remote stream updates
      const interval = setInterval(() => {
        const updatedRemote = callService.getRemoteStream();
        if (updatedRemote && updatedRemote !== remoteStream) {
          setRemoteStream(updatedRemote);
          setCallStatus('connected');
          clearInterval(interval);
        }
      }, 500);

      // Clear interval after 30 seconds
      setTimeout(() => clearInterval(interval), 30000);
    } catch (error) {
      console.error('Call setup error:', error);
      Alert.alert('Call Failed', 'Unable to establish connection');
      router.back();
    }
  };

  const monitorCallStatus = () => {
    const unsubscribe = firestore()
      .collection('calls')
      .doc(callId)
      .onSnapshot((snapshot) => {
        const data = snapshot.data();
        if (data?.status === 'ended') {
          handleEndCall();
        } else if (data?.status === 'connected') {
          setCallStatus('connected');
        }
      });

    return unsubscribe;
  };

  const handleEndCall = async () => {
    await callService.endCall(callId);
    router.back();
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View className="flex-1 bg-black">
        {/* Remote Video (Full Screen) */}
        {remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={{ flex: 1 }}
            objectFit="cover"
            mirror={false}
          />
        ) : (
          <View className="flex-1 items-center justify-center">
            <View className="w-32 h-32 bg-gray-700 rounded-full items-center justify-center mb-4">
              <Ionicons name="person" size={64} color="#9CA3AF" />
            </View>
            <Text className="text-white text-xl font-semibold">
              {callStatus === 'connecting' ? 'Connecting...' : 'Waiting...'}
            </Text>
          </View>
        )}

        {/* Local Video (Picture-in-Picture) */}
        {localStream && !isVideoOff && (
          <View className="absolute top-12 right-4 w-32 h-48 rounded-2xl overflow-hidden border-2 border-white shadow-lg">
            <RTCView
              streamURL={localStream.toURL()}
              style={{ flex: 1 }}
              objectFit="cover"
              mirror={true}
            />
          </View>
        )}

        {/* Status Indicator */}
        <View className="absolute top-12 left-4 bg-black/50 px-4 py-2 rounded-full">
          <Text className="text-white text-sm">
            {callStatus === 'connected' ? '🟢 Connected' : '🟡 Connecting...'}
          </Text>
        </View>

        {/* Controls */}
        <View className="absolute bottom-0 left-0 right-0 pb-12 px-8">
          <View className="flex-row justify-around items-center">
            {/* Mute Button */}
            <TouchableOpacity
              onPress={handleToggleMute}
              className={`w-16 h-16 rounded-full items-center justify-center ${
                isMuted ? 'bg-red-500' : 'bg-gray-700'
              }`}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={28}
                color="white"
              />
            </TouchableOpacity>

            {/* End Call Button */}
            <TouchableOpacity
              onPress={handleEndCall}
              className="w-20 h-20 bg-red-500 rounded-full items-center justify-center"
            >
              <Ionicons name="call" size={32} color="white" />
            </TouchableOpacity>

            {/* Video Toggle Button */}
            <TouchableOpacity
              onPress={handleToggleVideo}
              className={`w-16 h-16 rounded-full items-center justify-center ${
                isVideoOff ? 'bg-red-500' : 'bg-gray-700'
              }`}
            >
              <Ionicons
                name={isVideoOff ? 'videocam-off' : 'videocam'}
                size={28}
                color="white"
              />
            </TouchableOpacity>
          </View>

          {/* Switch Camera Button (only when video is on) */}
          {!isVideoOff && (
            <TouchableOpacity
              onPress={handleSwitchCamera}
              className="mt-4 bg-gray-700 py-3 rounded-full"
            >
              <Text className="text-white text-center font-semibold">
                Switch Camera
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </>
  );
}