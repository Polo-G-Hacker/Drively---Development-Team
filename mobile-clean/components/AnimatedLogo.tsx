import React, { useEffect, useState } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type AnimatedLogoProps = {
  size?: number;
  color?: string;
};

const DRAW_DURATION_MS = 1100;
const TRACK_OPACITY = 0.16;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getSegmentProgress(progress: number, start: number, end: number) {
  return clamp((progress - start) / (end - start), 0, 1);
}

export default function AnimatedLogo({
  size = 152,
  color = '#0066FF',
}: AnimatedLogoProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let startedAt = 0;

    const animate = (timestamp: number) => {
      if (!startedAt) {
        startedAt = timestamp;
      }

      const elapsed = (timestamp - startedAt) % DRAW_DURATION_MS;
      setProgress(elapsed / DRAW_DURATION_MS);
      frameId = requestAnimationFrame(animate);
    };

    frameId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frameId);
  }, []);

  const outerWaveProgress = getSegmentProgress(progress, 0.02, 0.22);
  const innerWaveProgress = getSegmentProgress(progress, 0.14, 0.32);
  const bowlProgress = getSegmentProgress(progress, 0.28, 0.58);
  const stemProgress = getSegmentProgress(progress, 0.46, 0.66);
  const arrowProgress = getSegmentProgress(progress, 0.6, 0.82);

  return (
    <Svg viewBox="0 0 190 190" width={size} height={size}>
      <Path
        d="M24 74C54 50 88 43 118 47"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={TRACK_OPACITY}
      />
      <Path
        d="M24 74C54 50 88 43 118 47"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={[118, 118]}
        strokeDashoffset={(1 - outerWaveProgress) * 118}
      />

      <Path
        d="M46 86C72 69 97 62 121 66"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={TRACK_OPACITY}
      />
      <Path
        d="M46 86C72 69 97 62 121 66"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={[94, 94]}
        strokeDashoffset={(1 - innerWaveProgress) * 94}
      />

      <Circle
        cx={114}
        cy={105}
        r={48}
        stroke={color}
        strokeWidth={14}
        fill="none"
        opacity={TRACK_OPACITY}
      />
      <Circle
        cx={114}
        cy={105}
        r={48}
        stroke={color}
        strokeWidth={14}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={[302, 302]}
        strokeDashoffset={(1 - bowlProgress) * 302}
      />

      <Path
        d="M162 18V104"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={TRACK_OPACITY}
      />
      <Path
        d="M162 18V104"
        stroke={color}
        strokeWidth={14}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={[86, 86]}
        strokeDashoffset={(1 - stemProgress) * 86}
      />

      <Path
        d="M96 105H132M120 91L134 105L120 119"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        opacity={TRACK_OPACITY}
      />
      <Path
        d="M96 105H132M120 91L134 105L120 119"
        stroke={color}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={[58, 58]}
        strokeDashoffset={(1 - arrowProgress) * 58}
      />
    </Svg>
  );
}
