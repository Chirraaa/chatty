// app/call/[callId].tsx
import { useState, useEffect } from 'react';
import { StyleSheet, View, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { RTCView } from 'react-native-webrtc';
import { Layout, Text, Button } from '@ui-kitten/components';
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
  const [isEnding, setIsEnding] = useState(false);

  useEffect(() => {
    if (!callId) return;

    setupCall();
    const unsubscribe = monitorCallStatus();

    return () => {
      // Cleanup when component unmounts
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
        if (data?.status === 'ended' && !isEnding) {
          // Call was ended by the other person
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
    if (isEnding) return; // Prevent multiple calls
    
    try {
      setIsEnding(true);
      await callService.endCall(callId);
      // Small delay to ensure cleanup completes
      setTimeout(() => {
        router.replace('/(tabs)');
      }, 100);
    } catch (error) {
      console.error('Error ending call:', error);
      // Still navigate away even if there's an error
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

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <Layout style={styles.container}>
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
              <Ionicons name="person" size={64} color="#8F9BB3" />
            </View>
            <Text category='h5' style={styles.statusText}>
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
          <Text category='c1' style={styles.statusIndicatorText}>
            {callStatus === 'connected' ? '🟢 Connected' : '🟡 Connecting...'}
          </Text>
        </View>

        {/* Controls */}
        <View style={styles.controlsContainer}>
          <View style={styles.controlsRow}>
            {/* Mute Button */}
            <TouchableOpacity
              onPress={handleToggleMute}
              style={[
                styles.controlButton,
                isMuted && styles.controlButtonActive
              ]}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={28}
                color="#FFFFFF"
              />
            </TouchableOpacity>

            {/* End Call Button */}
            <TouchableOpacity
              onPress={handleEndCall}
              style={styles.endCallButton}
            >
              <Ionicons name="call" size={32} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Video Toggle Button */}
            <TouchableOpacity
              onPress={handleToggleVideo}
              style={[
                styles.controlButton,
                isVideoOff && styles.controlButtonActive
              ]}
            >
              <Ionicons
                name={isVideoOff ? 'videocam-off' : 'videocam'}
                size={28}
                color="#FFFFFF"
              />
            </TouchableOpacity>
          </View>

          {/* Switch Camera Button */}
          {!isVideoOff && (
            <Button
              onPress={handleSwitchCamera}
              style={styles.switchCameraButton}
              appearance='outline'
            >
              Switch Camera
            </Button>
          )}
        </View>
      </Layout>
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
    backgroundColor: '#1A2138',
  },
  avatarPlaceholder: {
    width: 128,
    height: 128,
    backgroundColor: '#2E3A59',
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusText: {
    color: '#FFFFFF',
  },
  localVideoContainer: {
    position: 'absolute',
    top: 48,
    right: 16,
    width: 128,
    height: 192,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  localVideo: {
    flex: 1,
  },
  statusIndicator: {
    position: 'absolute',
    top: 48,
    left: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusIndicatorText: {
    color: '#FFFFFF',
  },
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 48,
    paddingHorizontal: 32,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  controlButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2E3A59',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButtonActive: {
    backgroundColor: '#FF3D71',
  },
  endCallButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FF3D71',
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchCameraButton: {
    marginTop: 16,
  },
});