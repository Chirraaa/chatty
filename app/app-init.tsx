// app/app-init.tsx - Initialize services when app starts
import { useEffect } from 'react';
import notificationService from '@/services/notification.service';

export function AppInit() {
  useEffect(() => {
    // Initialize notification service
    notificationService.initialize().catch(console.error);
    
    // Cleanup on unmount
    return () => {
      notificationService.cleanup();
    };
  }, []);

  return null;
}