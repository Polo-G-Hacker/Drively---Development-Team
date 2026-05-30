import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import LottieView from 'lottie-react-native';

import carAnimation from '../assets/car-movement.json';

type AuthHeroCarProps = {
  width: number;
};

const LOOP_DURATION_MS = 10000;

export default function AuthHeroCar({ width }: AuthHeroCarProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const stageWidth = Math.min(width, 360);
  const stageHeight = Math.min(Math.max(stageWidth * 0.45, 142), 178);
  const carWidth = Math.min(Math.max(stageWidth * 0.84, 248), 312);

  useEffect(() => {
    let isMounted = true;
    let currentAnimation: Animated.CompositeAnimation | null = null;

    const runLoop = () => {
      progress.setValue(0);

      currentAnimation = Animated.timing(progress, {
        toValue: 1,
        duration: LOOP_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      });

      currentAnimation.start(({ finished }) => {
        if (finished && isMounted) {
          runLoop();
        }
      });
    };

    progress.setValue(0);
    runLoop();

    return () => {
      isMounted = false;
      currentAnimation?.stop();
    };
  }, [progress]);

  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [stageWidth, -carWidth],
  });

  const translateY = progress.interpolate({
    inputRange: [0, 0.18, 0.34, 0.52, 0.7, 0.86, 1],
    outputRange: [8, -8, 5, -7, 7, -5, 8],
  });

  const rotate = progress.interpolate({
    inputRange: [0, 0.18, 0.34, 0.52, 0.7, 0.86, 1],
    outputRange: ['0deg', '-2deg', '1.6deg', '-1.8deg', '2deg', '-1deg', '0deg'],
  });

  return (
    <View style={[styles.stage, { width: stageWidth, height: stageHeight }]}>
      <Animated.View
        style={[
          styles.carTrack,
          {
            width: carWidth,
            height: stageHeight,
            transform: [{ translateX }, { translateY }, { rotate }],
          },
        ]}
      >
        <LottieView
          source={carAnimation}
          autoPlay
          loop
          style={[styles.carAnimation, { width: carWidth, height: stageHeight }]}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    position: 'relative',
    overflow: 'hidden',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  carTrack: {
    position: 'absolute',
    left: 0,
    top: 0,
    justifyContent: 'center',
  },
  carAnimation: {
    backgroundColor: 'transparent',
  },
});
