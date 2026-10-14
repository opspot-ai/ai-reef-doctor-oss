import * as React from "react";
import Svg, { Path, Circle } from "react-native-svg";
import { colors } from "@/theme/tokens";

/**
 * A tiny inline-SVG icon set (via react-native-svg) so we avoid a heavy icon
 * dependency. Mirrors the lucide glyphs the web app uses on these surfaces.
 * Each icon accepts size / color / strokeWidth.
 */
export interface IconProps {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

function Stroke({
  size = 20,
  color = colors.text,
  strokeWidth = 2,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </Svg>
  );
}

export function FishIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M16.5 12c.5-2.5-1.5-5.5-5-6.5C7 4 3.5 6.5 2.5 8.5c1 2 4.5 4.5 9 3.5 3.5-1 5.5-4 5-6.5" />
      <Path d="M16.5 12c.5 2.5-1.5 5.5-5 6.5-4.5 1-8-1.5-9-3.5" />
      <Path d="M18 12h4l-2.5 3M18 12l1.5-3" />
      <Circle cx="6" cy="10" r="0.6" fill={props.color ?? colors.text} />
    </Stroke>
  );
}

export function WavesIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M2 6c1.5-1.5 3-1.5 4.5 0S9.5 7.5 11 6s3-1.5 4.5 0S18.5 7.5 20 6" />
      <Path d="M2 12c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
      <Path d="M2 18c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0 3 1.5 4.5 0" />
    </Stroke>
  );
}

export function MessageIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M21 11.5a8.38 8.38 0 0 1-9 8.3 9 9 0 0 1-3.8-.7L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z" />
    </Stroke>
  );
}

export function CameraIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M14.5 4l1.5 2h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l1.5-2z" />
      <Circle cx="12" cy="13" r="3.2" />
    </Stroke>
  );
}

export function FlaskIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M9 3h6M10 3v6.5L4.5 18a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9.5V3" />
      <Path d="M7 15h10" />
    </Stroke>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.7 21a2 2 0 0 1-3.4 0" />
    </Stroke>
  );
}

export function StethoscopeIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M4 3v5a4 4 0 0 0 8 0V3" />
      <Path d="M8 15a5 5 0 0 0 10 0v-2" />
      <Circle cx="19" cy="11" r="2" />
    </Stroke>
  );
}

export function DropletIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
    </Stroke>
  );
}

export function ActivityIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M3 12h4l2.5 7 5-16 2.5 9H21" />
    </Stroke>
  );
}

export function CheckCircleIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M22 11.5V12a10 10 0 1 1-5.9-9.1" />
      <Path d="M22 4 12 14.1l-3-3" />
    </Stroke>
  );
}

export function AlertTriangleIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <Path d="M12 9v4M12 17h.01" />
    </Stroke>
  );
}

export function ShieldAlertIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="M12 8v4M12 16h.01" />
    </Stroke>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 16v-4M12 8h.01" />
    </Stroke>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M5 12h14M13 6l6 6-6 6" />
    </Stroke>
  );
}

export function CalendarClockIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Path d="M21 8V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h6" />
      <Path d="M3 10h18M16 3v4M8 3v4" />
      <Circle cx="17.5" cy="16.5" r="3.5" />
      <Path d="M17.5 15v1.5l1 1" />
    </Stroke>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Stroke {...props}>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21a8 8 0 0 1 16 0" />
    </Stroke>
  );
}
