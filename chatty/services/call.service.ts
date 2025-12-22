// services/call.service.ts
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  MediaStream,
  mediaDevices,
} from 'react-native-webrtc';
import firestore from '@react-native-firebase/firestore';
import { auth } from '@/config/firebase';

interface CallData {
  callId: string;
  callerId: string;
  receiverId: string;
  status: 'calling' | 'connected' | 'ended';
  isVideo: boolean;
}

class CallService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private remoteStream: MediaStream | null = null;

  // WebRTC Configuration with STUN servers
  private configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ],
  };

  /**
   * Initialize local media stream
   */
  async initializeCall(isVideo: boolean): Promise<MediaStream> {
    try {
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: isVideo
          ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              frameRate: { ideal: 30 },
              facingMode: 'user',
            }
          : false,
      });

      return this.localStream;
    } catch (error) {
      console.error('Error getting user media:', error);
      throw new Error('Failed to access camera/microphone');
    }
  }

  /**
   * Create a new call
   */
  async createCall(receiverId: string, isVideo: boolean): Promise<string> {
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) throw new Error('Not authenticated');

      // Get local stream
      await this.initializeCall(isVideo);

      // Create call document
      const callRef = await firestore().collection('calls').add({
        callerId: currentUser.uid,
        receiverId,
        status: 'calling',
        isVideo,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      const callId = callRef.id;

      // Create peer connection
      this.peerConnection = new RTCPeerConnection(this.configuration);

      // Add local stream to peer connection
      if (this.localStream) {
        this.localStream.getTracks().forEach((track) => {
          this.peerConnection!.addTrack(track, this.localStream!);
        });
      }

      // Handle remote stream
      this.peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
        }
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          await firestore()
            .collection('calls')
            .doc(callId)
            .collection('callerCandidates')
            .add(event.candidate.toJSON());
        }
      };

      // Create and set offer
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: isVideo,
      });
      await this.peerConnection.setLocalDescription(offer);

      // Save offer to Firestore
      await callRef.update({
        offer: {
          type: offer.type,
          sdp: offer.sdp,
        },
      });

      // Listen for answer
      this.listenForAnswer(callId);

      // Listen for remote ICE candidates
      this.listenForRemoteCandidates(callId, 'answererCandidates');

      return callId;
    } catch (error) {
      console.error('Error creating call:', error);
      this.endCall();
      throw error;
    }
  }

  /**
   * Answer an incoming call
   */
  async answerCall(callId: string): Promise<void> {
    try {
      const callDoc = await firestore().collection('calls').doc(callId).get();
      const callData = callDoc.data();

      if (!callData) throw new Error('Call not found');

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
      this.peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          this.remoteStream = event.streams[0];
        }
      };

      // Handle ICE candidates
      this.peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
          await firestore()
            .collection('calls')
            .doc(callId)
            .collection('answererCandidates')
            .add(event.candidate.toJSON());
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
      });

      // Listen for remote ICE candidates
      this.listenForRemoteCandidates(callId, 'callerCandidates');
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

        if (data.answer && !this.peerConnection?.currentRemoteDescription) {
          const answer = new RTCSessionDescription(data.answer);
          await this.peerConnection?.setRemoteDescription(answer);
        }
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
   * End the call
   */
  async endCall(callId?: string) {
    try {
      // Stop all tracks
      this.localStream?.getTracks().forEach((track) => track.stop());
      this.remoteStream?.getTracks().forEach((track) => track.stop());

      // Close peer connection
      this.peerConnection?.close();

      // Update call status in Firestore
      if (callId) {
        await firestore().collection('calls').doc(callId).update({
          status: 'ended',
          endedAt: firestore.FieldValue.serverTimestamp(),
        });
      }

      // Reset state
      this.localStream = null;
      this.remoteStream = null;
      this.peerConnection = null;
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
      // @ts-ignore - _switchCamera is available in react-native-webrtc
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
}

export default new CallService();