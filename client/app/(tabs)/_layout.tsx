import { Tabs } from 'expo-router';
import { Platform, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useResponsive } from '@/hooks/useResponsive';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth, isLandscape } = useResponsive();
  const isWide = screenWidth >= 768;

  // On wide screens (tablet/web), constrain the tab bar width and center it
  const maxBarWidth = isLandscape ? 840 : 720;
  const tabBarWidthStyle = isWide
    ? { maxWidth: maxBarWidth, width: '100%', alignSelf: 'center' as const, borderRadius: 0 }
    : {};

  let tabBarStyle: any = {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.92)' : '#FFFFFF',
    borderTopWidth: 0,
    height: 56 + (isWide ? 0 : insets.bottom),
    paddingBottom: isWide ? 6 : insets.bottom,
    paddingTop: 6,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
    ...tabBarWidthStyle,
  };

  if (Platform.OS === 'web') {
    tabBarStyle = {
      ...tabBarStyle,
      height: 'auto',
      paddingBottom: 6,
      backdropFilter: 'blur(20px)',
    };
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#EA580C',
        tabBarInactiveTintColor: '#A8A29E',
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          marginTop: 2,
        },
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '听后选择',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="list-check" size={17} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="listen-answer"
        options={{
          title: '听后回答',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="comment" size={17} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="listen-retell"
        options={{
          title: '听后转述',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="arrows-turn-to-dots" size={17} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="read-aloud"
        options={{
          title: '短文朗读',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="book-open" size={17} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="exam-mock"
        options={{
          title: '考试模拟',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="file-pen" size={17} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: '历史',
          tabBarIcon: ({ color }) => (
            <FontAwesome6 name="clock-rotate-left" size={17} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
