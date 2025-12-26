// services/call.service.ts - ENHANCED: Full background call support with notifications
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import { Platform, AppState } from 'react-native';
import * as Notifications from 'expo-notifications';

interface CallData {
  callId: string;
  callerId: string;
  receiverId: string;
  status: 'calling' | 'connected' | 'ended';
  isVideo: boolean;
  backgroundMode?: boolean;
}

class CallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;
  private currentCallId: string | null = null;
  private backgroundMode: boolean = false;
  private videoTrackAdded: boolean = false;
  private audioSessionActive: boolean = false;
  private appStateListener: any = null;
  private callNotificationId: string | null = null;
  private callStartTime: number | null = null;
  private durationInterval: any = null;
  private otherUserName: string = 'Unknown';

  // WebRTC Configuration
  private configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  constructor() {
    this.setupAppStateListener();
  }

  /**
   * Setup app state listener for automatic background handling
   */
  private setupAppStateListener(): void {
    this.appStateListener = AppState.addEventListener('change', (nextAppState) => {
      console.log('📱 CallService: App state changed to:', nextAppState);
      
      if (this.isCallActive()) {
        if (nextAppState === 'background' || nextAppState === 'inactive') {
          console.log('📱 App backgrounded - enabling background mode');
          this.enableBackgroundMode();
        } else if (nextAppState === 'active') {
          console.log('📱 App foregrounded');
          this.disableBackgroundMode();
        }
      }
    });
  }

  /**
   * Set caller name for notifications
   */
  setCallerName(name: string): void {
    this.otherUserName = name;
  }

  /**
   * Show ongoing call notification
   */
  private async showCallNotification(): Promise<void> {
    try {
      const duration = this.callStartTime 
        ? Math.floor((Date.now() - this.callStartTime) / 1000)
        : 0;
      
      const mins = Math.floor(duration / 60);
      const secs = duration % 60;
      const durationText = `${mins}:${secs.toString().padStart(2, '0')}`;

      this.callNotificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: `📞 Call with ${this.otherUserName}`,
          body: `Duration: ${durationText} - Tap to return`,
          data: {
            type: 'ongoing_call',
            callId: this.currentCallId,
          },
          sound: false,
          priority: Notifications.AndroidNotificationPriority.HIGH,
          sticky: true,
        },
        trigger: null,
      });

      console.log('📢 Ongoing call notification shown:', this.callNotificationId);
    } catch (error) {
      console.error('❌ Error showing call notification:', error);
    }
  }

  /**
   * Update call notification with duration
   */
  private async updateCallNotification(): Promise<void> {
    if (!this.callNotificationId || !this.backgroundMode) return;

    try {
      await this.dismissCallNotification();
      await this.showCallNotification();
    } catch (error) {
      console.error('❌ Error updating call notification:', error);
    }
  }

  /**
   * Dismiss call notification
   */
  private async dismissCallNotification(): Promise<void> {
    if (this.callNotificationId) {
      try {
        await Notifications.dismissNotificationAsync(this.callNotificationId);
        this.callNotificationId = null;
        console.log('🔕 Call notification dismissed');
      } catch (error) {
        console.error('❌ Error dismissing call notification:', error);
      }
    }

    // Clear duration interval
    if (this.durationInterval) {
      clearInterval(this.durationInterval);
      this.durationInterval = null;
    }
  }

  /**
   * Initialize local media stream with background audio support
   */
  async initializeCall(isVideo: boolean): Promise<MediaStream> {
    try {
      console.log('🎥 Requesting media permissions:', isVideo ? 'video + audio' : 'audio only');
      
      // Stop any existing tracks first
      this.cleanupMedia();
      
      this.localStream = await mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: isVideo
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
              facingMode: 'user',
            }
          : false,
      });

      console.log('✅ Media stream obtained');
      console.log('  - Audio tracks:', this.localStream.getAudioTracks().length);
      if (isVideo) {
        console.log('  - Video tracks:', this.localStream.getVideoTracks().length);
      }

      // Mark audio session as active
      this.audioSessionActive = true;
      this.callStartTime = Date.now();
      
      // Configure audio track to continue in background
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
        console.log('🎤 Audio track configured for background playback');
      }
      
      return this.localStream;
    } catch (error: any) {
      console.error('❌ Error getting user media:', error);
      throw new Error(`Failed to access ${isVideo ? 'camera/microphone' : 'microphone'}. Please check permissions.`);
    }
  }

  /**
   * Enable background mode - keeps audio active when app is backgrounded
   */
  enableBackgroundMode(): void {
    if (!this.isCallActive()) {
      console.log('⚠️ No active call to enable background mode for');
      return;
    }

    console.log('🔊 Enabling background audio mode...');
    this.backgroundMode = true;
    
    // Keep audio track active in background
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = true;
        console.log('✅ Audio track kept active for background');
      }

      // Disable video in background to save battery
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        console.log('📹 Disabling video in background to save battery');
        videoTrack.enabled = false;
      }
    }

    // Show persistent notification
    this.showCallNotification();

    // Update notification every 5 seconds with duration
    this.durationInterval = setInterval(() => {
      this.updateCallNotification();
    }, 5000);

    // Update Firestore
    if (this.currentCallId) {
      firestore()
        .collection('calls')
        .doc(this.currentCallId)
        .update({ 
          backgroundMode: true,
          lastBackgroundedAt: firestore.FieldValue.serverTimestamp(),
        })
        .catch(console.error);
    }

    console.log('✅ Background mode enabled with notification');
  }

  /**
   * Disable background mode - restore normal operation when app is foregrounded
   */
  disableBackgroundMode(): void {
    if (!this.isCallActive()) {
      return;
    }

    console.log('🔊 Disabling background audio mode...');
    this.backgroundMode = false;
    
    // Dismiss notification
    this.dismissCallNotification();
    
    // Re-enable video if it was enabled before backgrounding
    if (this.localStream && this.videoTrackAdded) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack && !videoTrack.enabled) {
        console.log('📹 Re-enabling video after foreground');
        videoTrack.enabled = true;
      }
    }

    // Update Firestore
    if (this.currentCallId) {
      firestore()
        .collection('calls')
        .doc(this.currentCallId)
        .update({ 
          backgroundMode: false,
        })
        .catch(console.error);
    }

    console.log('✅ Background mode disabled');
  }

  /**
   * Enable video during an audio call
   */
  async enableVideo(): Promise<void> {
    try {
      console.log('📹 Enabling video...');
      
      if (!this.peerConnection || !this.localStream) {
        throw new Error('No active call');
      }

      const existingVideoTrack = this.localStream.getVideoTracks()[0];
      if (existingVideoTrack) {
        console.log('📹 Video track already exists, enabling it');
        existingVideoTrack.enabled = true;
        this.videoTrackAdded = true;
        return;
      }

      // Get video stream
      const videoStream = await mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
      });

      const videoTrack = videoStream.getVideoTracks()[0];
      
      if (!videoTrack) {
        throw new Error('Failed to get video track');
      }

      // Add video track to existing stream
      this.localStream.addTrack(videoTrack);
      
      // Add track to peer connection
      this.peerConnection.addTrack(videoTrack, this.localStream);
      console.log('✅ Video track added to peer connection');
      
      this.videoTrackAdded = true;
      
      // Renegotiate
      await this.renegotiate();

      console.log('✅ Video enabled successfully');
    } catch (error: any) {
      console.error('❌ Error enabling video:', error);
      throw new Error('Failed to enable video. Please check camera permissions.');
    }
  }

  /**
   * Renegotiate connection
   */
  private async renegotiate(): Promise<void> {
    try {
      if (!this.peerConnection || !this.currentCallId) {
        throw new Error('No active connection to renegotiate');
      }

      console.log('🔄 Renegotiating connection...');

      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await this.peerConnection.setLocalDescription(offer);

      await firestore()
        .collection('calls')
        .doc(this.currentCallId)
        .update({
          offer: {
            type: offer.type,
            sdp: offer.sdp,
          },
          updatedAt: firestore.FieldValue.serverTimestamp(),
        });

      console.log('✅ Renegotiation complete');
    } catch (error) {
      console.error('❌ Error renegotiating:', error);
      throw error;
    }
  }

  /**
   * Create a new call
   */
  async createCall(receiverId: string, isVideo: boolean): Promise<string> {
    try {
      console.log('📞 Creating call...');
      const currentUser = auth().currentUser;
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      console.log('  - Caller:', currentUser.uid);
      console.log('  - Receiver:', receiverId);
      console.log('  - Type:', isVideo ? 'video' : 'audio');

      // Get local stream
      await this.initializeCall(isVideo);

      // Create call document
      const callRef = await firestore().collection('calls').add({
        callerId: currentUser.uid,
        receiverId,
        status: 'calling',
        isVideo,
        createdAt: firestore.FieldValue.serverTimestamp(),
        backgroundMode: false,
        platform: Platform.OS,
      });

      const callId = callRef.id;
      this.currentCallId = callId;
      console.log('✅ Call document created:', callId);

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(this.configuration);

      // Add local stream to peer connection
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          console.log('  - Adding track:', track.kind);
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }

      // Handle remote stream
      (this.peerConnection as any).ontrack = (event: any) => {
        console.log('📥 Received remote track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
          console.log('✅ Remote stream set');
        }
      };

      // Handle ICE candidates
      (this.peerConnection as any).onicecandidate = async (event: any) => {
        if (event.candidate) {
          await firestore()
            .collection('calls')
            .doc(callId)
            .collection('callerCandidates')
            .add(event.candidate.toJSON());
        }
      };

      // Handle connection state changes
      (this.peerConnection as any).onconnectionstatechange = () => {
        const state = (this.peerConnection as any).connectionState;
        console.log('🔗 Connection state:', state);
        
        if (state === 'connected') {
          firestore().collection('calls').doc(callId).update({
            status: 'connected',
            connectedAt: firestore.FieldValue.serverTimestamp(),
          }).catch(console.error);
        }
      };

      // Create offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });

      await this.peerConnection.setLocalDescription(offer);

      // Save offer
      await callRef.update({
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
      });

      // Setup listeners
      this.listenForAnswer(callId);
      this.listenForRemoteCandidates(callId, 'answererCandidates');

      console.log('✅ Call created successfully');
      return callId;
    } catch (error: any) {
      console.error('❌ Error creating call:', error);
      this.endCall();
      throw error;
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(callId: string): Promise<void> {
    try {
      console.log('📞 Answering call:', callId);
      const callDoc = await firestore().collection('calls').doc(callId).get();
      const callData = callDoc.data();

      if (!callData) throw new Error('Call not found');

      this.currentCallId = callId;

      // Get local stream
      await this.initializeCall(callData.isVideo);

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(this.configuration);

      // Add local stream
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }

      // Handle remote stream
      (this.peerConnection as any).ontrack = (event: any) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
        }
      };

      // Handle ICE candidates
      (this.peerConnection as any).onicecandidate = async (event: any) => {
        if (event.candidate) {
          await firestore()
            .collection('calls')
            .doc(callId)
            .collection('answererCandidates')
            .add(event.candidate.toJSON());
        }
      };

      // Handle connection state
      (this.peerConnection as any).onconnectionstatechange = () => {
        const state = (this.peerConnection as any).connectionState;
        console.log('🔗 Connection state:', state);
        
        if (state === 'connected') {
          firestore().collection('calls').doc(callId).update({
            status: 'connected',
            connectedAt: firestore.FieldValue.serverTimestamp(),
          }).catch(console.error);
        }
      };

      // Set remote description
      const offer = new RTCSessionDescription(callData.offer);
      await this.peerConnection.setRemoteDescription(offer);

      // Create answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Save answer
      await firestore().collection('calls').doc(callId).update({
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
        status: 'connected',
        answeredAt: firestore.FieldValue.serverTimestamp(),
      });

      // Listen for remote candidates and offer updates
      this.listenForRemoteCandidates(callId, 'callerCandidates');
      this.listenForOfferUpdates(callId);
      
      console.log('✅ Call answered');
    } catch (error) {
      console.error('Error answering call:', error);
      this.endCall();
      throw error;
    }
  }

  /**
   * Listen for answer
   */
  private listenForAnswer(callId: string) {
    firestore()
      .collection('calls')
      .doc(callId)
      .onSnapshot(async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        const hasRemoteDesc = this.peerConnection && 
          (this.peerConnection as any).remoteDescription;

        if (data.answer && !hasRemoteDesc) {
          console.log('📥 Received answer');
          const answer = new RTCSessionDescription(data.answer);
          await this.peerConnection?.setRemoteDescription(answer);
        }
      });
  }

  /**
   * Listen for offer updates
   */
  private listenForOfferUpdates(callId: string) {
    let lastOfferSdp: string | null = null;

    firestore()
      .collection('calls')
      .doc(callId)
      .onSnapshot(async (snapshot) => {
        const data = snapshot.data();
        if (!data || !data.offer) return;

        if (data.offer.sdp !== lastOfferSdp && lastOfferSdp !== null) {
          console.log('🔄 Received updated offer');
          try {
            const offer = new RTCSessionDescription(data.offer);
            await this.peerConnection?.setRemoteDescription(offer);

            const answer = await this.peerConnection?.createAnswer();
            if (answer) {
              await this.peerConnection?.setLocalDescription(answer);

              await firestore().collection('calls').doc(callId).update({
                answer: {
                  type: answer.type,
                  sdp: answer.sdp,
                },
                updatedAt: firestore.FieldValue.serverTimestamp(),
              });
            }
          } catch (error) {
            console.error('❌ Error handling offer update:', error);
          }
        }

        lastOfferSdp = data.offer.sdp;
      });
  }

  /**
   * Listen for remote ICE candidates
   */
  private listenForRemoteCandidates(callId: string, collection: string) {
    firestore()
      .collection('calls')
      .doc(callId)
      .collection(collection)
      .onSnapshot((snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const candidate = new RTCIceCandidate(data);
            await this.peerConnection?.addIceCandidate(candidate);
          }
        });
      });
  }

  /**
   * Cleanup media tracks
   */
  private cleanupMedia(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.localStream = null;
    }
    
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.remoteStream = null;
    }
    
    this.audioSessionActive = false;
    this.videoTrackAdded = false;
    this.callStartTime = null;
  }

  /**
   * End the call
   */
  async endCall(callId?: string) {
    try {
      console.log('🔴 Ending call...');
      
      // Disable background mode and dismiss notification
      this.backgroundMode = false;
      this.dismissCallNotification();
      
      // Cleanup media
      this.cleanupMedia();

      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
      }

      // Update call status
      const targetCallId = callId || this.currentCallId;
      if (targetCallId) {
        await firestore().collection('calls').doc(targetCallId).update({
          status: 'ended',
          endedAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      // Reset state
      this.peerConnection = null;
      this.currentCallId = null;
      this.otherUserName = 'Unknown';
      
      console.log('✅ Call ended');
    } catch (error) {
      console.error('Error ending call:', error);
    }
  }

  /**
   * Toggle microphone
   */
  toggleMicrophone(): boolean {
    if (!this.localStream) return false;

    const audioTrack = this.localStream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      console.log('🎤 Microphone:', audioTrack.enabled ? 'ON' : 'OFF');
      return audioTrack.enabled;
    }
    return false;
  }

  /**
   * Toggle camera
   */
  toggleCamera(): boolean {
    if (!this.localStream) return false;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      console.log('📹 Camera:', videoTrack.enabled ? 'ON' : 'OFF');
      return videoTrack.enabled;
    }
    return false;
  }

  /**
   * Switch camera
   */
  async switchCamera() {
    if (!this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      console.log('🔄 Switching camera...');
      // @ts-ignore
      await videoTrack._switchCamera();
    }
  }

  /**
   * Get streams
   */
  getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  getRemoteStream(): MediaStream | null {
    return this.remoteStream;
  }

  getCurrentCallId(): string | null {
    return this.currentCallId;
  }

  isCallActive(): boolean {
    return this.currentCallId !== null && this.peerConnection !== null;
  }

  isAudioSessionActive(): boolean {
    return this.audioSessionActive;
  }

  isInBackgroundMode(): boolean {
    return this.backgroundMode;
  }

  getCallDuration(): number {
    if (!this.callStartTime) return 0;
    return Math.floor((Date.now() - this.callStartTime) / 1000);
  }

  cleanup(): void {
    if (this.appStateListener) {
      this.appStateListener.remove();
    }
    this.dismissCallNotification();
  }
}

export default new CallService();