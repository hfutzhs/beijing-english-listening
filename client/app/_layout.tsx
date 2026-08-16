import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LogBox, AppState } from 'react-native';
import Toast from 'react-native-toast-message';
import { Provider } from '@/components/Provider';
import { useUpdateChecker } from '@/hooks/useOTAUpdate';
import { UpdateModal } from '@/components/UpdateModal';

import '../global.css';

LogBox.ignoreLogs([
  "TurboModuleRegistry.getEnforcing(...): 'RNMapsAirModule' could not be found",
]);

function OTAUpdateHandler() {
  const { status, message, applyUpdate } = useUpdateChecker();
  const [dismissed, setDismissed] = useState(false);

  const shouldShowModal =
    !dismissed &&
    (status === 'available' || status === 'downloading' || status === 'ready' || status === 'error');

  if (!shouldShowModal) return null;

  return (
    <UpdateModal
      visible={shouldShowModal}
      status={status}
      message={message}
      onUpdate={applyUpdate}
      onLater={() => setDismissed(true)}
    />
  );
}

export default function RootLayout() {
  return (
    <Provider>
      <Stack
        screenOptions={{
          animation: 'slide_from_right',
          gestureEnabled: true,
          gestureDirection: 'horizontal',
          headerShown: false
        }}
      >
        <Stack.Screen name="(tabs)" options={{ title: "" }} />
        <Stack.Screen name="practice-answer" options={{ title: "" }} />
        <Stack.Screen name="exam-flow" options={{ title: "" }} />
        <Stack.Screen name="history-detail" options={{ title: "" }} />
        <Stack.Screen name="scoring-guide" options={{ title: "" }} />
      </Stack>
      <Toast />
      <OTAUpdateHandler />
    </Provider>
  );
}
