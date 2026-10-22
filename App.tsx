import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';

import { GymTimeScreen } from './src/GymTimeScreen';
import { colors } from './src/theme';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ PressStart2P_400Regular });

  // Show the plain background for the split second the pixel font loads.
  // If the font fails, carry on with the system font rather than a blank app.
  if (!fontsLoaded && !fontError) {
    return <View style={{ flex: 1, backgroundColor: colors.sky }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <GymTimeScreen />
    </SafeAreaProvider>
  );
}
