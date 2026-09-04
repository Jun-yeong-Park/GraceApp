import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BibleStackParamList } from '../types';
import BibleScreen from '../screens/BibleScreen';
import BibleBookChaptersScreen from '../screens/BibleBookChaptersScreen';
import BibleChapterScreen from '../screens/BibleChapterScreen';

const Stack = createNativeStackNavigator<BibleStackParamList>();

export default function BibleStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BibleMain" component={BibleScreen} />
      <Stack.Screen name="BibleBookChapters" component={BibleBookChaptersScreen} />
      <Stack.Screen name="BibleChapter" component={BibleChapterScreen} />
    </Stack.Navigator>
  );
}
