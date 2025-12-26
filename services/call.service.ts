// services/call.service.ts - Enhanced with proper background call support and stream management
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';
import { Platform } from 'react-native';

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

  // WebRTC Configuration with STUN servers
  private configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  /**
   * Initialize local media stream with enhanced error handling
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

      console.log('✅ Media stream obtained successfully');
      console.log('  - Audio tracks:', this.localStream.getAudioTracks().length);
      if (isVideo) {
        console.log('  - Video tracks:', this.localStream.getVideoTracks().length);
      }

      // Mark audio session as active for background handling
      this.audioSessionActive = true;
      
      return this.localStream;
    } catch (error: any) {
      console.error('❌ Error getting user media:', error);
      console.error('  - Error name:', error.name);
      console.error('  - Error message:', error.message);
      throw new Error(`Failed to access ${isVideo ? 'camera/microphone' : 'microphone'}. Please check permissions.`);
    }
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

      // Check if video track already exists
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
      const sender = this.peerConnection.addTrack(videoTrack, this.localStream);
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
   * Renegotiate connection (for adding/removing tracks)
   */
  private async renegotiate(): Promise<void> {
    try {
      if (!this.peerConnection || !this.currentCallId) {
        throw new Error('No active connection to renegotiate');
      }

      console.log('🔄 Renegotiating connection...');

      // Create new offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await this.peerConnection.setLocalDescription(offer);

      // Update offer in Firestore
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
   * Create a new call with enhanced error handling
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
      console.log('1️⃣ Initializing media...');
      await this.initializeCall(isVideo);

      // Create call document
      console.log('2️⃣ Creating Firestore call document...');
      const callRef = await firestore().collection('calls').add({
        callerId: currentUser.uid,
        receiverId,
        status: 'calling',
        isVideo,
        createdAt: firestore.FieldValue.serverTimestamp(),
        backgroundMode: false, // Track if call was backgrounded
        platform: Platform.OS, // Track platform for compatibility
      });

      const callId = callRef.id;
      this.currentCallId = callId;
      console.log('✅ Call document created:', callId);

      // Create peer connection
      console.log('3️⃣ Creating peer connection...');
      this.peerConnection = new RTCPeerConnection(this.configuration);
      console.log('✅ Peer connection created');

      // Add local stream to peer connection
      console.log('4️⃣ Adding local stream to peer connection...');
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
          console.log('🧊 ICE candidate generated');
          try {
            await firestore()
              .collection('calls')
              .doc(callId)
              .collection('callerCandidates')
              .add(event.candidate.toJSON());
            console.log('✅ ICE candidate saved');
          } catch (error) {
            console.error('❌ Failed to save ICE candidate:', error);
          }
        }
      };

      // Handle connection state changes
      (this.peerConnection as any).onconnectionstatechange = () => {
        const state = (this.peerConnection as any).connectionState;
        console.log('🔗 Connection state changed:', state);
        
        if (state === 'connected') {
          console.log('🎉 Peer connection established');
          firestore().collection('calls').doc(callId).update({
            status: 'connected',
            connectedAt: firestore.FieldValue.serverTimestamp(),
          }).catch(console.error);
        }
      };

      // Create and set offer
      console.log('5️⃣ Creating offer...');
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });
      console.log('✅ Offer created');

      console.log('6️⃣ Setting local description...');
      await this.peerConnection.setLocalDescription(offer);
      console.log('✅ Local description set');

      // Save offer to Firestore
      console.log('7️⃣ Saving offer to Firestore...');
      await callRef.update({
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
      });
      console.log('✅ Offer saved to Firestore');

      // Listen for answer
      console.log('8️⃣ Setting up listeners...');
      this.listenForAnswer(callId);
      this.listenForRemoteCandidates(callId, 'answererCandidates');
      console.log('✅ Listeners set up');

      console.log('🎉 Call creation complete! Call ID:', callId);
      return callId;
    } catch (error: any) {
      console.error('❌ Error creating call:', error);
      console.error('  - Error name:', error.name);
      console.error('  - Error message:', error.message);
      console.error('  - Error stack:', error.stack);
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

      // Handle connection state changes
      (this.peerConnection as any).onconnectionstatechange = () => {
        const state = (this.peerConnection as any).connectionState;
        console.log('🔗 Connection state changed:', state);
        
        if (state === 'connected') {
          console.log('🎉 Peer connection established');
          firestore().collection('calls').doc(callId).update({
            status: 'connected',
            connectedAt: firestore.FieldValue.serverTimestamp(),
          }).catch(console.error);
        }
      };

      // Set remote description (offer)
      const offer = new RTCSessionDescription(callData.offer);
      await this.peerConnection.setRemoteDescription(offer);

      // Create and set answer
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      // Save answer to Firestore
      await firestore().collection('calls').doc(callId).update({
        answer: {
          type: answer.type,
          sdp: answer.sdp,
        },
        status: 'connected',
        answeredAt: firestore.FieldValue.serverTimestamp(),
      });

      // Listen for remote ICE candidates and offer updates (for renegotiation)
      this.listenForRemoteCandidates(callId, 'callerCandidates');
      this.listenForOfferUpdates(callId);
      console.log('✅ Call answered successfully');
    } catch (error) {
      console.error('Error answering call:', error);
      this.endCall();
      throw error;
    }
  }

  /**
   * Listen for answer (for caller)
   */
  private listenForAnswer(callId: string) {
    firestore()
      .collection('calls')
      .doc(callId)
      .onSnapshot(async (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        // Check if we already have a remote description
        const hasRemoteDesc = this.peerConnection && 
          (this.peerConnection as any).remoteDescription;

        if (data.answer && !hasRemoteDesc) {
          console.log('📥 Received answer from receiver');
          const answer = new RTCSessionDescription(data.answer);
          await this.peerConnection?.setRemoteDescription(answer);
          console.log('✅ Remote description set');
        }
      });
  }

  /**
   * Listen for offer updates (for answerer, during renegotiation)
   */
  private listenForOfferUpdates(callId: string) {
    let lastOfferSdp: string | null = null;

    firestore()
      .collection('calls')
      .doc(callId)
      .onSnapshot(async (snapshot) => {
        const data = snapshot.data();
        if (!data || !data.offer) return;

        // Check if offer has changed (renegotiation)
        if (data.offer.sdp !== lastOfferSdp && lastOfferSdp !== null) {
          console.log('🔄 Received updated offer (renegotiation)');
          try {
            const offer = new RTCSessionDescription(data.offer);
            await this.peerConnection?.setRemoteDescription(offer);

            // Create new answer
            const answer = await this.peerConnection?.createAnswer();
            if (answer) {
              await this.peerConnection?.setLocalDescription(answer);

              // Update answer in Firestore
              await firestore().collection('calls').doc(callId).update({
                answer: {
                  type: answer.type,
                  sdp: answer.sdp,
                },
                updatedAt: firestore.FieldValue.serverTimestamp(),
              });

              console.log('✅ Renegotiation answer sent');
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
            console.log('🧊 Received remote ICE candidate');
            const candidate = new RTCIceCandidate(data);
            await this.peerConnection?.addIceCandidate(candidate);
          }
        });
      });
  }

  /**
   * Set background mode for call - FIXED: Proper background handling
   */
  setBackgroundMode(enabled: boolean): void {
    this.backgroundMode = enabled;
    console.log('📱 Background mode:', enabled ? 'ENABLED' : 'DISABLED');
    
    if (this.currentCallId) {
      firestore()
        .collection('calls')
        .doc(this.currentCallId)
        .update({ 
          backgroundMode: enabled,
          lastBackgroundedAt: enabled ? firestore.FieldValue.serverTimestamp() : null,
        })
        .catch(console.error);
    }

    // Handle audio track when backgrounding
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        // Keep audio active in background
        audioTrack.enabled = true;
        console.log('🎤 Audio track kept active for background call');
      }
    }
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
  }

  /**
   * End the call with proper cleanup
   */
  async endCall(callId?: string) {
    try {
      console.log('🔴 Ending call...');
      
      // Cleanup media tracks
      this.cleanupMedia();

      // Close peer connection
      if (this.peerConnection) {
        this.peerConnection.close();
        console.log('  - Peer connection closed');
      }

      // Update call status in Firestore
      const targetCallId = callId || this.currentCallId;
      if (targetCallId) {
        await firestore().collection('calls').doc(targetCallId).update({
          status: 'ended',
          endedAt: firestore.FieldValue.serverTimestamp(),
          backgroundMode: this.backgroundMode,
        });
        console.log('  - Call status updated in Firestore');
      }

      // Reset state
      this.peerConnection = null;
      this.currentCallId = null;
      this.backgroundMode = false;
      
      console.log('✅ Call ended successfully');
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
   * Switch camera (front/back)
   */
  async switchCamera() {
    if (!this.localStream) return;

    const videoTrack = this.localStream.getVideoTracks()[0];
    if (videoTrack) {
      console.log('🔄 Switching camera...');
      // @ts-ignore - _switchCamera is available in react-native-webrtc
      await videoTrack._switchCamera();
      console.log('✅ Camera switched');
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

  /**
   * Get current call ID
   */
  getCurrentCallId(): string | null {
    return this.currentCallId;
  }

  /**
   * Check if call is active
   */
  isCallActive(): boolean {
    return this.currentCallId !== null && this.peerConnection !== null;
  }

  /**
   * Check if audio session is active (for background handling)
   */
  isAudioSessionActive(): boolean {
    return this.audioSessionActive;
  }
}

export default new CallService();
