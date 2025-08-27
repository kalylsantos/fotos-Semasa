import React from 'react';
import Svg, { Path } from 'react-native-svg';

interface IconProps {
  size?: number;
  color?: string;
}

export const CameraIcon: React.FC<IconProps> = ({ size = 24, color = 'white' }) => (
  <Svg height={size} width={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.776 48.776 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
    <Path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008v-.008z" />
  </Svg>
);

export const BarcodeScannerIcon: React.FC<IconProps> = ({ size = 24, color = 'white' }) => (
  <Svg height={size} width={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.5a.75.75 0 00-.75.75v13.5a.75.75 0 00.75.75h16.5a.75.75 0 00.75-.75V5.25a.75.75 0 00-.75-.75H3.75zM8.25 8.25V15.75" />
    <Path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v7.5" />
    <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 8.25v7.5" />
  </Svg>
);

export const PencilSquareIcon: React.FC<IconProps> = ({ size = 24, color = 'white' }) => (
    <Svg height={size} width={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </Svg>
);

export const DocumentTextIcon: React.FC<IconProps> = ({ size = 24, color = 'white' }) => (
    <Svg height={size} width={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </Svg>
);

export const ArrowPathIcon: React.FC<IconProps> = ({ size = 24, color = 'white' }) => (
  <Svg height={size} width={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color}>
    <Path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0011.664 0l3.181-3.183m-11.664 0l3.181-3.183a8.25 8.25 0 00-11.664 0l3.181 3.183" />
  </Svg>
);

export const XMarkIcon: React.FC<IconProps> = ({ size = 24, color = 'white' }) => (
    <Svg height={size} width={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </Svg>
);

export const ChevronLeftIcon: React.FC<IconProps> = ({ size = 24, color = 'white' }) => (
    <Svg height={size} width={size} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke={color}>
        <Path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </Svg>
);
