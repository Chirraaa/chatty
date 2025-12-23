// app/(tabs)/profile.tsx - With clear messages option
import React, { useState, useEffect } from 'react';
import { StyleSheet, ScrollView, View, Alert } from 'react-native';
import { router } from 'expo-router';
import { Layout, Text, Button, Card, Divider, Spinner } from '@ui-kitten/components';
import { Ionicons } from '@expo/vector-icons';
import authService from '@/services/auth.service';
import { auth } from '@/config/firebase';
import { clearAllMyMessagesAndResetKeys } from '@/utils/clear-messages';

export default function ProfileScreen() {
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const currentUser = auth().currentUser;

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      if (currentUser) {
        console.log('Loading profile for user:', currentUser.uid);
        const profile = await authService.getUserProfile(currentUser.uid);
        console.log('Profile loaded:', profile);
        setUserProfile(profile);
        
        if (!profile) {
          console.warn('Profile is null, user may not have completed registration');
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleClearMessages = () => {
    Alert.alert(
      'Clear Messages & Reset Keys',
      'This will:\n• Delete all your messages\n• Generate new encryption keys\n• Update your public key in Firebase\n\nOther users will be able to send you new encrypted messages after this.\n\nAre you sure?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Clear & Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearing(true);
              const deletedCount = await clearAllMyMessagesAndResetKeys();
              Alert.alert(
                'Success',
                `Deleted ${deletedCount} messages and generated new encryption keys. You can now send and receive encrypted messages.`,
                [{ text: 'OK' }]
              );
            } catch (error) {
              console.error('Error clearing messages:', error);
              Alert.alert('Error', 'Failed to clear messages and reset keys');
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await authService.signOut();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <Layout style={styles.container}>
        <View style={styles.header}>
          <Text category='h4'>Profile</Text>
        </View>
        <View style={styles.loadingContainer}>
          <Spinner size='large' />
          <Text category='s1' appearance='hint' style={styles.loadingText}>
            Loading profile...
          </Text>
        </View>
      </Layout>
    );
  }

  return (
    <Layout style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text category='h4'>Profile</Text>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          <View style={styles.avatar}>
            <Text category='h1' style={styles.avatarText}>
              {userProfile?.username?.charAt(0).toUpperCase() || currentUser?.email?.charAt(0).toUpperCase() || '?'}
            </Text>
          </View>

          <Text category='h5' style={styles.username}>
            {userProfile?.username || 'No username set'}
          </Text>

          <Text category='s1' appearance='hint'>
            {currentUser?.email}
          </Text>
        </View>

        {/* Account Info Card */}
        <Card style={styles.card}>
          <Text category='h6' style={styles.cardTitle}>Account Information</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="person-circle-outline" size={24} color="#3366FF" />
            <View style={styles.infoContent}>
              <Text category='s2'>User ID</Text>
              <Text appearance='hint' numberOfLines={1}>
                {currentUser?.uid.substring(0, 20)}...
              </Text>
            </View>
          </View>

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark-outline" size={24} color="#00D68F" />
            <View style={styles.infoContent}>
              <Text category='s2'>Security</Text>
              <Text style={styles.securityText}>End-to-end encrypted</Text>
            </View>
          </View>
        </Card>

        {/* About Card */}
        <Card style={styles.card}>
          <Text category='h6' style={styles.cardTitle}>About</Text>
          <Text appearance='hint' style={styles.aboutText}>
            This app uses end-to-end encryption. Your messages are encrypted on 
            your device and can only be decrypted by the recipient. Even we 
            cannot read your messages.
          </Text>
          
          <Text appearance='hint' style={[styles.aboutText, styles.aboutTextSpaced]}>
            Video and voice calls are also end-to-end encrypted using WebRTC.
          </Text>
        </Card>

        {/* Troubleshooting Card */}
        <Card style={styles.card}>
          <Text category='h6' style={styles.cardTitle}>Troubleshooting</Text>
          
          <Text appearance='hint' style={styles.troubleshootText}>
            If you see "🔒 Cannot decrypt this message" errors, it means those 
            messages were encrypted with old keys. Clear messages and reset your 
            encryption keys to start fresh.
          </Text>
          
          <Button
            style={styles.clearButton}
            status='warning'
            appearance='outline'
            onPress={handleClearMessages}
            disabled={clearing}
          >
            {clearing ? 'Clearing...' : 'Clear Messages & Reset Keys'}
          </Button>
        </Card>

        {/* Sign Out Button */}
        <Button
          style={styles.signOutButton}
          status='danger'
          onPress={handleSignOut}
        >
          Sign Out
        </Button>
      </ScrollView>
    </Layout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  header: {
    paddingTop: 20,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  profileSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#3366FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 40,
  },
  username: {
    marginBottom: 4,
  },
  card: {
    marginVertical: 8,
  },
  cardTitle: {
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  divider: {
    marginVertical: 12,
  },
  securityText: {
    color: '#00D68F',
  },
  aboutText: {
    lineHeight: 20,
  },
  aboutTextSpaced: {
    marginTop: 12,
  },
  troubleshootText: {
    lineHeight: 20,
    marginBottom: 16,
  },
  clearButton: {
    marginTop: 8,
  },
  signOutButton: {
    marginTop: 16,
    marginBottom: 32,
  },
});