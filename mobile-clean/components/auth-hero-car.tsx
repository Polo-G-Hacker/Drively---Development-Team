import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

type AuthHeroCarProps = {
  width?: number;
};

function Wheel({ size }: { size: number }) {
  const spokes = [0, 45, 90, 135];
  const spokeLength = size * 0.33;
  const spokeThickness = Math.max(2, size * 0.045);

  return (
    <View
      style={[
        styles.wheelOuter,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: size * 0.16,
        },
      ]}>
      <View
        style={[
          styles.wheelInner,
          {
            borderRadius: size / 2,
          },
        ]}>
        {spokes.map((rotation) => (
          <View
            key={rotation}
            style={[
              styles.spoke,
              {
                width: spokeThickness,
                height: spokeLength,
                borderRadius: spokeThickness / 2,
                transform: [{ rotate: `${rotation}deg` }],
              },
            ]}
          />
        ))}
        <View
          style={[
            styles.wheelHub,
            {
              width: size * 0.18,
              height: size * 0.18,
              borderRadius: size * 0.09,
            },
          ]}
        />
      </View>
    </View>
  );
}

export default function AuthHeroCar({ width = 320 }: AuthHeroCarProps) {
  const motion = useSharedValue(0);
  const height = width * 0.5;
  const wheelSize = width * 0.17;
  const wheelTop = height * 0.52;
  const rearWheelLeft = width * 0.18;
  const frontWheelLeft = width * 0.66;

  useEffect(() => {
    motion.value = withRepeat(
      withTiming(1, {
        duration: 2600,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true
    );
  }, [motion]);

  const animatedCarStyle = useAnimatedStyle(() => {
    const translateX = interpolate(motion.value, [0, 1], [-width * 0.065, width * 0.065]);
    const translateY = interpolate(motion.value, [0, 0.25, 0.5, 0.75, 1], [0, -4, 0, -3, 0]);
    const scale = interpolate(motion.value, [0, 0.5, 1], [0.985, 1, 0.985]);

    return {
      transform: [{ translateX }, { translateY }, { scale }],
    };
  });

  const animatedWheelStyle = useAnimatedStyle(() => {
    const rotate = interpolate(motion.value, [0, 1], [0, 540]);

    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const animatedRoadStyle = useAnimatedStyle(() => {
    const translateX = interpolate(motion.value, [0, 1], [14, -14]);

    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={[styles.wrapper, { width, height }]}>
      <View style={styles.roadTrack}>
        <Animated.View style={[styles.roadDashes, animatedRoadStyle]}>
          {Array.from({ length: 7 }).map((_, index) => (
            <View key={index} style={styles.roadDash} />
          ))}
        </Animated.View>
      </View>

      <Animated.View style={[styles.carStage, { width, height }, animatedCarStyle]}>
        <Animated.View
          style={[
            styles.wheelPosition,
            { width: wheelSize, height: wheelSize, top: wheelTop, left: rearWheelLeft },
            animatedWheelStyle,
          ]}>
          <Wheel size={wheelSize} />
        </Animated.View>

        <Animated.View
          style={[
            styles.wheelPosition,
            { width: wheelSize, height: wheelSize, top: wheelTop, left: frontWheelLeft },
            animatedWheelStyle,
          ]}>
          <Wheel size={wheelSize} />
        </Animated.View>

        <Svg
          width={width}
          height={height}
          viewBox="0 0 340 180"
          style={styles.carBody}>
          <Defs>
            <LinearGradient id="carBodyGradient" x1="10%" y1="15%" x2="90%" y2="100%">
              <Stop offset="0%" stopColor="#76C7FF" />
              <Stop offset="55%" stopColor="#0A78FF" />
              <Stop offset="100%" stopColor="#004FCC" />
            </LinearGradient>
            <LinearGradient id="windowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#CFE6FF" stopOpacity="0.92" />
              <Stop offset="100%" stopColor="#123E7A" stopOpacity="0.9" />
            </LinearGradient>
          </Defs>

          <Ellipse cx="170" cy="152" rx="122" ry="15" fill="rgba(3, 10, 26, 0.20)" />

          <Path
            d="M29 112C44 90 72 72 112 66H214C259 66 295 82 316 108L332 124C336 128 338 134 338 138H18C18 127 22 119 29 112Z"
            fill="url(#carBodyGradient)"
          />
          <Path
            d="M53 118H302C300 108 290 99 274 95H79C67 100 58 108 53 118Z"
            fill="#005BDB"
            opacity="0.95"
          />
          <Path
            d="M92 70C112 58 153 52 207 54C246 56 277 68 297 93H222L182 68H118L86 93H55C66 82 78 75 92 70Z"
            fill="url(#windowGradient)"
          />
          <Path d="M117 68H182L150 93H85C93 83 102 74 117 68Z" fill="#0C386E" opacity="0.92" />
          <Path d="M184 68H208C234 69 257 78 276 93H220L184 68Z" fill="#0C386E" opacity="0.92" />
          <Rect x="181" y="69" width="4" height="24" rx="2" fill="#DDEFFF" opacity="0.8" />
          <Path d="M58 117C100 109 153 106 238 108C266 109 287 111 304 114" stroke="#D8F0FF" strokeWidth="3" opacity="0.34" />
          <Path d="M86 123C118 120 154 119 210 120C247 120 276 121 298 123" stroke="#083D86" strokeWidth="6" opacity="0.2" />
          <Path d="M33 113C38 106 47 101 58 101H68C64 107 63 112 63 118H32C31 116 31 115 33 113Z" fill="#DCEEFF" />
          <Path d="M308 107C317 107 325 111 330 118H304C304 114 305 110 308 107Z" fill="#EAF6FF" />
          <Rect x="228" y="94" width="26" height="4" rx="2" fill="#0E4B98" opacity="0.4" />
          <Rect x="257" y="94" width="18" height="4" rx="2" fill="#0E4B98" opacity="0.28" />
          <Path d="M75 97L95 96" stroke="#B6DFFF" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
          <Path d="M299 96L316 99" stroke="#B6DFFF" strokeWidth="3" strokeLinecap="round" opacity="0.55" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  roadTrack: {
    position: 'absolute',
    bottom: 8,
    width: '78%',
    height: 20,
    overflow: 'hidden',
  },
  roadDashes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '120%',
    height: '100%',
    alignSelf: 'center',
  },
  roadDash: {
    width: 28,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(221, 238, 255, 0.46)',
  },
  carStage: {
    justifyContent: 'flex-end',
  },
  carBody: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  wheelPosition: {
    position: 'absolute',
    zIndex: 1,
  },
  wheelOuter: {
    backgroundColor: '#091423',
    borderWidth: 4,
    borderColor: '#18283E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#03101F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  wheelInner: {
    flex: 1,
    alignSelf: 'stretch',
    backgroundColor: '#D6E7FF',
    borderWidth: 4,
    borderColor: '#59759E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spoke: {
    position: 'absolute',
    backgroundColor: '#536C92',
  },
  wheelHub: {
    backgroundColor: '#294A78',
    borderWidth: 2,
    borderColor: '#C4D8F3',
  },
});
